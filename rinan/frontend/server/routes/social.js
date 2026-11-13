import { Router } from 'express';
import { adminAuth } from '../middleware/adminAuth.js';
import { db } from '../lib/db.js';
import { fetchAll } from '../lib/fetchAll.js';
import { missingMetaEnv } from '../lib/meta.js';
import { collectSocialData } from '../lib/socialCollect.js';
import { analyzeSocial, reportMarkdown } from '../lib/socialAnalysis.js';

export const socialRouter = Router();

const ALLOWED_DAYS = [7, 14, 28];
const CACHE_TTL_MS = 15 * 60 * 1000;

// Graph API 洞察每天才更新幾次，一份報表要打幾十個請求；同一個 Function 執行個體內快取 15 分鐘，
// 後台重新整理不會一直重打。按「重新抓取」（?refresh=1）才略過快取。
const cache = new Map();

function loadPlantings(since) {
  return fetchAll(() =>
    db().from('plantings').select('created_at').gte('created_at', since.toISOString()).order('created_at').order('id')
  ).then(({ data, error }) => {
    if (error) throw error;
    return data;
  });
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
    if (!(raw.facebook.error && raw.instagram.error)) cache.set(days, { at: Date.now(), report });
    res.json({ ...report, cached: false });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: `讀取 Meta 資料失敗：${err.message}` });
  }
});
