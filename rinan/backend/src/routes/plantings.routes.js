import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { verifyLiffAccessToken, LiffAuthError } from '../lib/verifyLiffToken.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { containsBlockedContent } from '../lib/contentFilter.js';
import { toCsv } from '../lib/csv.js';

export const plantingsRouter = Router();

const PLANT_TYPES = new Set([
  'casuarina', // 木麻黃・守護
  'rice', // 水稻・耕作
  'taro', // 芋頭・實踐
  'koelreuteria', // 台灣欒樹・日常
  'miscanthus', // 甜根子草・韌性
  'broussonetia', // 構樹・生命力
]);

const NICKNAME_LIMIT = 16;

// 互動頁／Kiosk 送出「種下一株」：LINE 走 LIFF token 驗證，Kiosk 走現場發的流水編號。
// 兩種來源都要先過內容過濾，再寫入 pending 狀態等待人工審核。
plantingsRouter.post('/', async (req, res) => {
  const { accessToken, kioskSessionId, plantType, message, nickname } = req.body || {};

  if (!PLANT_TYPES.has(plantType)) {
    return res.status(400).json({ error: '未知的植物種類' });
  }

  if (typeof message !== 'string' || message.length > 60) {
    return res.status(400).json({ error: '留言需為 60 字以內的文字' });
  }

  const trimmedNickname = typeof nickname === 'string' ? nickname.trim() : '';
  if (trimmedNickname.length === 0 || trimmedNickname.length > NICKNAME_LIMIT) {
    return res.status(400).json({ error: `暱稱需為 1-${NICKNAME_LIMIT} 字` });
  }

  if (containsBlockedContent(message) || containsBlockedContent(trimmedNickname)) {
    return res.status(400).json({ error: '請避免使用不雅或不當字詞，修改後再種下' });
  }

  let source;
  let participantId;
  let verifiedDisplayName = null;

  if (accessToken) {
    let profile;
    try {
      profile = await verifyLiffAccessToken(accessToken);
    } catch (err) {
      if (err instanceof LiffAuthError) {
        return res.status(401).json({ error: err.message });
      }
      throw err;
    }
    source = 'line';
    participantId = profile.userId;
    verifiedDisplayName = profile.displayName;
  } else if (typeof kioskSessionId === 'string' && kioskSessionId.startsWith('UNI-')) {
    source = 'kiosk';
    participantId = kioskSessionId;
  } else {
    return res.status(400).json({ error: '缺少身分資訊' });
  }

  const { data, error } = await supabaseAdmin
    .from('plantings')
    .insert({
      source,
      line_user_id: participantId,
      display_name: trimmedNickname,
      plant_type: plantType,
      message,
      status: 'pending',
    })
    .select('id, status, created_at')
    .single();

  if (error) {
    return res.status(500).json({ error: '寫入失敗，請稍後再試' });
  }

  if (source === 'line') {
    // 以 LINE userId 去重留存：新使用者建立一列，舊使用者更新最近參與時間與次數。
    // 這裡固定存「LINE 驗證過的真實顯示名稱」，跟使用者自訂公開暱稱（display_name）分開，
    // 前者給後台名冊使用，後者才是牆上看到的名字。
    const { error: touchError } = await supabaseAdmin.rpc('touch_line_user', {
      p_user_id: participantId,
      p_display_name: verifiedDisplayName,
    });
    if (touchError) {
      console.error('touch_line_user failed', touchError);
    }
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
    .select('id, display_name, plant_type, message, source, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    return res.status(500).json({ error: '讀取失敗' });
  }

  res.json({ plantings: data });
});

// 後台：人次（總互動筆數）／人數（不重複參與者，LINE 與 Kiosk 合併去重）統計
plantingsRouter.get('/stats', adminAuth, async (_req, res) => {
  const { data, error } = await supabaseAdmin.from('plantings').select('line_user_id, source');

  if (error) {
    return res.status(500).json({ error: '讀取失敗' });
  }

  const uniqueAll = new Set();
  const uniqueLine = new Set();
  const uniqueKiosk = new Set();
  data.forEach((row) => {
    uniqueAll.add(row.line_user_id);
    if (row.source === 'kiosk') uniqueKiosk.add(row.line_user_id);
    else uniqueLine.add(row.line_user_id);
  });

  res.json({
    totalInteractions: data.length,
    uniqueParticipants: uniqueAll.size,
    bySource: {
      line: { interactions: data.filter((r) => r.source !== 'kiosk').length, participants: uniqueLine.size },
      kiosk: { interactions: data.filter((r) => r.source === 'kiosk').length, participants: uniqueKiosk.size },
    },
  });
});

// 後台：原始名單一鍵下載（CSV），所有欄位、所有狀態，供離線分析用。
plantingsRouter.get('/export', adminAuth, async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('plantings')
    .select('id, source, line_user_id, display_name, plant_type, message, status, created_at, moderated_at, moderated_by')
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: '讀取失敗' });
  }

  const csv = toCsv(data, [
    'id',
    'source',
    'line_user_id',
    'display_name',
    'plant_type',
    'message',
    'status',
    'created_at',
    'moderated_at',
    'moderated_by',
  ]);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="plantings-${Date.now()}.csv"`);
  res.send(`﻿${csv}`); // 加 BOM，Excel 開繁體中文才不會亂碼
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
