import { Router } from 'express';
import { adminAuth } from '../middleware/adminAuth.js';
import { env } from '../env.js';
import { db } from '../lib/db.js';
import { fetchAll } from '../lib/fetchAll.js';
import { missingMetaEnv } from '../lib/meta.js';
import { collectSocialData } from '../lib/socialCollect.js';
import { analyzeSocial, reportMarkdown } from '../lib/socialAnalysis.js';
import { historyByDay, isMissingTable, saveSnapshot } from '../lib/socialSnapshot.js';

export const socialRouter = Router();

const ALLOWED_DAYS = [7, 14, 28];
const HISTORY_DAYS = [30, 90, 180, 365];
const CACHE_TTL_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Graph API 洞察每天才更新幾次，一份報表要打幾十個請求；同一個 Function 執行個體內快取 15 分鐘，
// 儀表板每 15 分鐘自動更新也不會一直重打。按「重新抓取」（?refresh=1）才略過快取。
const cache = new Map();

function loadPlantings(since) {
  return fetchAll(() =>
    db().from('plantings').select('created_at').gte('created_at', since.toISOString()).order('created_at').order('id')
  ).then(({ data, error }) => {
    if (error) throw error;
    return data;
  });
}

// 每次真的向 Meta 抓資料，就順手把報表期間每一天的數字存進 social_daily（歷史趨勢用）。
// 存不進去（例如還沒建表）不影響報表本身。
async function snapshotQuietly(raw) {
  try {
    return await saveSnapshot(db(), raw);
  } catch (err) {
    if (!isMissingTable(err)) console.error('social snapshot failed', err);
    return null;
  }
}

// 後台：社群洞察報表（FB 粉專＋IG 專業帳號＋植生牆種植數，本期 vs 上一期）
socialRouter.get('/report', adminAuth, async (req, res) => {
  const missing = missingMetaEnv();
  if (missing.length > 0) {
    return res.json({ configured: false, missing });
  }

  const days = ALLOWED_DAYS.includes(Number(req.query.days)) ? Number(req.query.days) : 28;
  const cached = cache.get(days);
  if (req.query.refresh !== '1' && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return res.json({ ...cached.report, cached: true });
  }

  try {
    const raw = await collectSocialData({ days, loadPlantings });
    const analysis = analyzeSocial(raw);
    const report = { configured: true, ...raw, analysis, markdown: reportMarkdown(raw, analysis) };
    // 兩個平台都失敗通常是權杖問題，不要快取，修好權杖後馬上就能看到
    if (!(raw.facebook.error && raw.instagram.error)) {
      cache.set(days, { at: Date.now(), report });
      await snapshotQuietly(raw);
    }
    res.json({ ...report, cached: false });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: `讀取 Meta 資料失敗：${err.message}` });
  }
});

// 後台：每日快照歷史（粉絲數、每日觀看／觸及、種植數），儀表板畫長期趨勢用
socialRouter.get('/history', adminAuth, async (req, res) => {
  const days = HISTORY_DAYS.includes(Number(req.query.days)) ? Number(req.query.days) : 90;
  const since = new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10);
  const { data, error } = await fetchAll(() =>
    db()
      .from('social_daily')
      .select('day, platform, followers, metrics')
      .gte('day', since)
      .order('day')
      .order('platform')
  );
  if (error) {
    if (isMissingTable(error)) {
      return res.json({
        available: false,
        reason: '還沒建立 social_daily 資料表：請在 Supabase 執行 supabase/migrations/2026-11-14-social-daily.sql',
      });
    }
    return res.status(500).json({ error: '讀取歷史失敗' });
  }
  res.json({ available: true, days, history: historyByDay(data) });
});

// 每日快照：Vercel Cron 每天呼叫一次（vercel.json 的 crons）。Vercel 會帶上
// Authorization: Bearer <CRON_SECRET>；沒設定 CRON_SECRET 時一律拒絕，避免任何人都能觸發。
socialRouter.get('/snapshot', async (req, res) => {
  if (!env.cronSecret) {
    return res.status(503).json({ error: '尚未設定 CRON_SECRET，每日快照暫停' });
  }
  if (req.headers.authorization !== `Bearer ${env.cronSecret}`) {
    return res.status(401).json({ error: '排程密鑰錯誤' });
  }
  const missing = missingMetaEnv();
  if (missing.length > 0) {
    return res.status(503).json({ error: `尚未設定 ${missing.join('、')}` });
  }

  try {
    // 抓最近 7 天：Meta 的每日數字常在隔天才補齊，每天重寫一週內的數字，存下來的就是最終值
    const raw = await collectSocialData({ days: 7, loadPlantings });
    if (raw.facebook.error && raw.instagram.error) {
      return res.status(502).json({ error: raw.facebook.error });
    }
    cache.delete(7);
    const result = await saveSnapshot(db(), raw);
    res.json({ ok: true, ...result, facebook: raw.facebook.error || 'ok', instagram: raw.instagram.error || 'ok' });
  } catch (err) {
    console.error(err);
    if (isMissingTable(err)) {
      return res.status(503).json({ error: '還沒建立 social_daily 資料表' });
    }
    res.status(502).json({ error: err.message });
  }
});
