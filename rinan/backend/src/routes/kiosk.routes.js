import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

export const kioskRouter = Router();

// 現場固定平板每次有人開始互動時呼叫：發一組流水編號（UNI-000123），
// 同時計入一次人流（visits），兩件事在資料庫端用同一個函式原子性完成。
kioskRouter.post('/session', async (_req, res) => {
  const { data, error } = await supabaseAdmin.rpc('create_kiosk_session');

  if (error) {
    return res.status(500).json({ error: '無法建立互動編號，請稍後再試' });
  }

  res.status(201).json({ sessionId: data });
});
