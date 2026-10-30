import { Router } from 'express';
import { env, missingEnv } from '../env.js';
import { db } from '../lib/db.js';

export const healthRouter = Router();

// 部署後打開 https://你的網域/api/health 就能自我檢查：環境變數齊不齊、資料庫連不連得上。
// 只回報變數名稱與連線結果，不會洩漏任何金鑰內容。
healthRouter.get('/', async (_req, res) => {
  const missing = missingEnv();
  if (missing.length > 0) {
    return res.status(503).json({ ok: false, missing, database: 'skipped' });
  }

  const { count, error } = await db().from('plantings').select('id', { count: 'exact', head: true });
  if (error) {
    return res.status(503).json({ ok: false, missing, database: 'error', detail: error.message, ...(await probe()) });
  }

  res.json({ ok: true, missing, database: 'ok', plantings: count ?? 0 });
});

// 資料庫連不上時，再直接連一次 SUPABASE_URL，回報連的是哪個主機、卡在哪一步
// （例如 ENOTFOUND＝網址打錯或專案已刪除）。Project URL 本來就公開在網頁裡，不是機密。
async function probe() {
  let host;
  try {
    const url = new URL(env.supabaseUrl);
    host = url.host;
    if (url.protocol !== 'https:') return { host, hint: 'SUPABASE_URL 要以 https:// 開頭' };
  } catch {
    return { hint: 'SUPABASE_URL 不是有效的網址，應該長得像 https://xxxx.supabase.co' };
  }
  try {
    const r = await fetch(`https://${host}/rest/v1/`, { headers: { apikey: env.supabaseServiceRoleKey } });
    return { host, httpStatus: r.status };
  } catch (err) {
    return { host, cause: err.cause?.code || err.cause?.message || err.message };
  }
}
