import crypto from 'node:crypto';
import { env } from '../env.js';

// Meta Graph API（Facebook 粉專＋Instagram 專業帳號）的唯讀用戶端。
// 只用一把「粉專存取權杖」：Business Suite 底下的粉專權杖可以同時讀 FB 粉專與連結的 IG 帳號洞察。
//
// Meta 這兩年持續汰換洞察指標（2025-11 拿掉 impressions、2026-06 拿掉多數 *_unique 觸及），
// 一次查詢只要有一個指標失效就會整包 400。所以這裡的洞察查詢都「先整包、失敗再逐一」，
// 把失效指標記下來跳過，其它指標照常回傳——Meta 再改名時後台只會少一格，不會整頁壞掉。

const GRAPH_HOST = 'https://graph.facebook.com';

export class GraphError extends Error {
  constructor(message, { status, code, subcode, type } = {}) {
    super(message);
    this.name = 'GraphError';
    this.status = status;
    this.code = code;
    this.subcode = subcode;
    this.type = type;
  }

  // 190＝權杖無效或過期；10／200 系列＝權限不足。這兩類重試也沒用，要請管理者處理。
  get isAuthProblem() {
    return this.code === 190 || this.code === 10 || (this.code >= 200 && this.code < 300);
  }
}

export function metaConfig() {
  return {
    pageId: env.metaPageId,
    token: env.metaPageAccessToken,
    igUserId: env.metaIgUserId,
    appSecret: env.metaAppSecret,
    version: env.metaGraphVersion,
  };
}

export function missingMetaEnv() {
  const missing = [];
  if (!env.metaPageId) missing.push('META_PAGE_ID');
  if (!env.metaPageAccessToken) missing.push('META_PAGE_ACCESS_TOKEN');
  return missing;
}

// 有設定 App Secret 時附上 appsecret_proof：就算權杖外洩，沒有 App Secret 也不能拿去呼叫 API。
function appSecretProof(token, secret) {
  return crypto.createHmac('sha256', secret).update(token).digest('hex');
}

export function createGraphClient(config = metaConfig(), fetchImpl = globalThis.fetch) {
  const base = `${GRAPH_HOST}/${config.version}`;

  async function get(path, params = {}) {
    const url = path.startsWith('https://') ? new URL(path) : new URL(`${base}/${path.replace(/^\//, '')}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
    // paging.next 已經帶著 access_token；自己組的網址才補上
    if (!url.searchParams.has('access_token')) url.searchParams.set('access_token', config.token);
    if (config.appSecret && !url.searchParams.has('appsecret_proof')) {
      url.searchParams.set('appsecret_proof', appSecretProof(config.token, config.appSecret));
    }

    let res;
    try {
      res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
    } catch (err) {
      throw new GraphError(`連不到 Meta Graph API：${err.message}`);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      const e = data.error || {};
      throw new GraphError(e.message || `Graph API 回應 ${res.status}`, {
        status: res.status,
        code: e.code,
        subcode: e.error_subcode,
        type: e.type,
      });
    }
    return data;
  }

  // 跟著 paging.next 一路抓，直到沒有下一頁、筆數到上限，或 stopWhen 判定後面都不需要了。
  async function getAll(path, params = {}, { max = 200, stopWhen } = {}) {
    const rows = [];
    let page = await get(path, params);
    for (;;) {
      const batch = page.data || [];
      for (const row of batch) {
        if (stopWhen?.(row)) return rows;
        rows.push(row);
        if (rows.length >= max) return rows;
      }
      const next = page.paging?.next;
      if (!next || batch.length === 0) return rows;
      page = await get(next);
    }
  }

  return { get, getAll };
}

// 洞察查詢：先整包，失敗再逐一。badMetrics 在同一份報表內共用——
// 第一篇貼文試出來某指標已失效，後面幾十篇就不再浪費請求。
// 只有「同一個物件上別的指標成功、這個失敗」才判定指標失效；全部失敗代表是物件本身拿不到洞察
// （例如 IG 帳號轉成專業帳號以前的貼文），不能因此把指標當成壞掉。
export async function fetchInsights(client, objectId, metrics, params = {}, badMetrics = new Set()) {
  const wanted = metrics.filter((m) => !badMetrics.has(m));
  const result = { values: {}, unavailable: metrics.filter((m) => badMetrics.has(m)), error: null };
  if (wanted.length === 0) return result;

  try {
    const data = await client.get(`${objectId}/insights`, { ...params, metric: wanted.join(',') });
    absorb(result.values, data.data);
    return result;
  } catch (err) {
    if (err instanceof GraphError && err.isAuthProblem) throw err;
    if (wanted.length === 1) {
      result.error = err;
      return result;
    }
  }

  const settled = await Promise.allSettled(
    wanted.map((metric) => client.get(`${objectId}/insights`, { ...params, metric }))
  );
  const anyOk = settled.some((s) => s.status === 'fulfilled');
  settled.forEach((s, i) => {
    if (s.status === 'fulfilled') {
      absorb(result.values, s.value.data);
    } else {
      if (s.reason instanceof GraphError && s.reason.isAuthProblem) throw s.reason;
      if (anyOk) {
        badMetrics.add(wanted[i]);
        result.unavailable.push(wanted[i]);
      } else {
        result.error = s.reason;
      }
    }
  });
  return result;
}

function absorb(target, rows = []) {
  for (const row of rows) {
    if (row.total_value !== undefined) {
      target[row.name] = { total: numeric(row.total_value.value) };
    } else {
      target[row.name] = {
        series: (row.values || []).map((v) => ({ endTime: v.end_time, value: numeric(v.value) })),
      };
    }
  }
}

// 有些指標的 value 是物件（例如依類型拆分），統計時加總成一個數字。
function numeric(value) {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    return Object.values(value).reduce((acc, v) => acc + (typeof v === 'number' ? v : 0), 0);
  }
  return 0;
}

// 同時跑太多請求容易撞到 Graph API 的頻率限制，貼文洞察一次最多 concurrency 筆。
export async function mapLimit(items, concurrency, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      out[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return out;
}
