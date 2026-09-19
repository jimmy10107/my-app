import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { env } from '../config/env.js';

export const visitsRouter = Router();

// 入口感測裝置（ESP32 + VL53L1X）回報事件，只帶裝置密鑰與計數，不含任何身分資訊。
visitsRouter.post('/', async (req, res) => {
  const secret = req.headers['x-device-secret'];
  if (secret !== env.visitDeviceSecret) {
    return res.status(401).json({ error: '裝置密鑰錯誤' });
  }

  const { deviceId, count = 1 } = req.body || {};
  const { error } = await supabaseAdmin.from('visits').insert({
    device_id: typeof deviceId === 'string' ? deviceId : null,
    count: Number.isInteger(count) && count > 0 ? count : 1,
  });

  if (error) {
    return res.status(500).json({ error: '寫入失敗' });
  }

  res.status(201).json({ ok: true });
});

// 後台：今日／累積人流統計
visitsRouter.get('/stats', adminAuth, async (_req, res) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [{ data: todayRows, error: todayError }, { data: totalRows, error: totalError }] = await Promise.all([
    supabaseAdmin.from('visits').select('count').gte('event_time', startOfToday.toISOString()),
    supabaseAdmin.from('visits').select('count'),
  ]);

  if (todayError || totalError) {
    return res.status(500).json({ error: '讀取失敗' });
  }

  const sum = (rows) => rows.reduce((acc, row) => acc + row.count, 0);

  res.json({
    today: sum(todayRows),
    total: sum(totalRows),
  });
});
