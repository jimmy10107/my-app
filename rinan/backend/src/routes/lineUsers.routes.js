import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { adminAuth } from '../middleware/adminAuth.js';

export const lineUsersRouter = Router();

// 後台：LINE 使用者名冊統計（去重後的總人數、今日新朋友、回訪人數）
lineUsersRouter.get('/stats', adminAuth, async (_req, res) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [totalRes, newTodayRes, returningRes] = await Promise.all([
    supabaseAdmin.from('line_users').select('*', { count: 'exact', head: true }),
    supabaseAdmin
      .from('line_users')
      .select('*', { count: 'exact', head: true })
      .gte('first_seen_at', startOfToday.toISOString()),
    supabaseAdmin.from('line_users').select('*', { count: 'exact', head: true }).gt('visit_count', 1),
  ]);

  if (totalRes.error || newTodayRes.error || returningRes.error) {
    return res.status(500).json({ error: '讀取失敗' });
  }

  res.json({
    total: totalRes.count ?? 0,
    newToday: newTodayRes.count ?? 0,
    returning: returningRes.count ?? 0,
  });
});

// 後台：最近互動過的使用者名冊（不含個資最小化以外的欄位）
lineUsersRouter.get('/', adminAuth, async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('line_users')
    .select('line_user_id, display_name, first_seen_at, last_seen_at, visit_count')
    .order('last_seen_at', { ascending: false })
    .limit(200);

  if (error) {
    return res.status(500).json({ error: '讀取失敗' });
  }

  res.json({ users: data });
});
