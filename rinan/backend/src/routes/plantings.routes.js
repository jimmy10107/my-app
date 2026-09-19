import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { verifyLiffAccessToken, LiffAuthError } from '../lib/verifyLiffToken.js';
import { adminAuth } from '../middleware/adminAuth.js';

export const plantingsRouter = Router();

const PLANT_TYPES = new Set([
  'casuarina', // 木麻黃・守護
  'rice', // 水稻・耕作
  'taro', // 芋頭・實踐
  'koelreuteria', // 台灣欒樹・日常
  'miscanthus', // 甜根子草・韌性
  'broussonetia', // 構樹・生命力
]);

// 互動頁（Play）送出「種下一株」：先驗證 LIFF token，再寫入 pending 狀態等待人工審核。
plantingsRouter.post('/', async (req, res) => {
  const { accessToken, plantType, message } = req.body || {};

  if (!PLANT_TYPES.has(plantType)) {
    return res.status(400).json({ error: '未知的植物種類' });
  }

  if (typeof message !== 'string' || message.length > 60) {
    return res.status(400).json({ error: '留言需為 60 字以內的文字' });
  }

  let profile;
  try {
    profile = await verifyLiffAccessToken(accessToken);
  } catch (err) {
    if (err instanceof LiffAuthError) {
      return res.status(401).json({ error: err.message });
    }
    throw err;
  }

  const { data, error } = await supabaseAdmin
    .from('plantings')
    .insert({
      line_user_id: profile.userId,
      display_name: profile.displayName,
      plant_type: plantType,
      message,
      status: 'pending',
    })
    .select('id, status, created_at')
    .single();

  if (error) {
    return res.status(500).json({ error: '寫入失敗，請稍後再試' });
  }

  // 以 LINE userId 去重留存：新使用者建立一列，舊使用者更新最近參與時間與次數。
  const { error: touchError } = await supabaseAdmin.rpc('touch_line_user', {
    p_user_id: profile.userId,
    p_display_name: profile.displayName,
  });
  if (touchError) {
    console.error('touch_line_user failed', touchError);
  }

  res.status(201).json({
    planting: data,
    notice: '已送出，等待現場人工審核通過後會出現在投影牆上',
  });
});

// 後台：待審核清單
plantingsRouter.get('/pending', adminAuth, async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('plantings')
    .select('id, display_name, plant_type, message, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    return res.status(500).json({ error: '讀取失敗' });
  }

  res.json({ plantings: data });
});

// 後台：核准，通過後前端 Wall 頁會經由 Supabase Realtime 立即看到
plantingsRouter.post('/:id/approve', adminAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('plantings')
    .update({ status: 'approved', moderated_at: new Date().toISOString(), moderated_by: 'admin' })
    .eq('id', req.params.id)
    .eq('status', 'pending')
    .select('id, status')
    .single();

  if (error || !data) {
    return res.status(404).json({ error: '找不到待審核紀錄，或已被處理過' });
  }

  res.json({ planting: data });
});

// 後台：退件
plantingsRouter.post('/:id/reject', adminAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('plantings')
    .update({ status: 'rejected', moderated_at: new Date().toISOString(), moderated_by: 'admin' })
    .eq('id', req.params.id)
    .eq('status', 'pending')
    .select('id, status')
    .single();

  if (error || !data) {
    return res.status(404).json({ error: '找不到待審核紀錄，或已被處理過' });
  }

  res.json({ planting: data });
});
