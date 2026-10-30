import { Router } from 'express';
import { db } from '../lib/db.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { env } from '../env.js';
import { startOfTaipeiDay } from '../lib/time.js';
import { fetchAll } from '../lib/fetchAll.js';

export const visitsRouter = Router();

// 入口感測裝置（ESP32 + VL53L1X）回報事件，只帶裝置密鑰與計數，不含任何身分資訊。
visitsRouter.post('/', async (req, res) => {
  // 沒設定密鑰時一律拒絕：否則「沒帶 header」跟「沒設定密鑰」都是 undefined，會被當成相符。
  if (!env.visitDeviceSecret) {
    return res.status(503).json({ error: '尚未設定 VISIT_DEVICE_SECRET，感測裝置暫不開放回報' });
  }
  const secret = req.headers['x-device-secret'];
  if (secret !== env.visitDeviceSecret) {
    return res.status(401).json({ error: '裝置密鑰錯誤' });
  }

  const { deviceId, count = 1 } = req.body || {};
  const { error } = await db().from('visits').insert({
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
  const startOfToday = startOfTaipeiDay();

  const [{ data: todayRows, error: todayError }, { data: totalRows, error: totalError }] = await Promise.all([
    fetchAll(() => db().from('visits').select('count').gte('event_time', startOfToday.toISOString()).order('id')),
    fetchAll(() => db().from('visits').select('count').order('id')),
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
