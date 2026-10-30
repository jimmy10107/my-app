import { Router } from 'express';
import { missingEnv } from '../env.js';
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
    return res.status(503).json({ ok: false, missing, database: 'error', detail: error.message });
  }

  res.json({ ok: true, missing, database: 'ok', plantings: count ?? 0 });
});
