import { Router } from 'express';
import { db } from '../lib/db.js';

export const kioskRouter = Router();

// 一台平板正常使用時，一次互動才發一組編號；短時間內大量發號通常是有人在灌資料。
const SESSION_BURST_WINDOW_MS = 10 * 60 * 1000;
const SESSION_BURST_LIMIT = 60;

// 現場固定平板每次有人開始互動時呼叫：發一組流水編號（UNI-000123），
// 同時計入一次人流（visits），兩件事在資料庫端用同一個函式原子性完成。
kioskRouter.post('/session', async (_req, res) => {
  const since = new Date(Date.now() - SESSION_BURST_WINDOW_MS).toISOString();
  const { count, error: countError } = await db()
    .from('kiosk_sessions')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since);

  if (countError) {
    return res.status(500).json({ error: '無法建立互動編號，請稍後再試' });
  }
  if ((count ?? 0) >= SESSION_BURST_LIMIT) {
    return res.status(429).json({ error: '目前使用人數太多，請稍候一分鐘再試' });
  }

  const { data, error } = await db().rpc('create_kiosk_session');

  if (error) {
    return res.status(500).json({ error: '無法建立互動編號，請稍後再試' });
  }

  res.status(201).json({ sessionId: data });
});
