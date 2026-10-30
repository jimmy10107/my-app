import { Router } from 'express';
import { db } from '../lib/db.js';
import { verifyLiffAccessToken, LiffAuthError } from '../lib/verifyLiffToken.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { containsBlockedContent } from '../lib/contentFilter.js';
import { toCsv } from '../lib/csv.js';
import { fetchAll } from '../lib/fetchAll.js';

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
const MESSAGE_LIMIT = 15;
const COOLDOWN_MS = 10 * 1000; // 同一位參與者兩次種植至少間隔幾秒，擋連點與灌資料
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function kioskSessionExists(sessionId) {
  const match = /^UNI-(\d{1,12})$/.exec(sessionId);
  if (!match) return false;
  const { data, error } = await db().from('kiosk_sessions').select('id').eq('id', Number(match[1])).maybeSingle();
  return !error && Boolean(data);
}

async function plantedTooRecently(participantId) {
  const { data } = await db()
    .from('plantings')
    .select('created_at')
    .eq('line_user_id', participantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return Boolean(data) && Date.now() - new Date(data.created_at).getTime() < COOLDOWN_MS;
}

// 互動頁（LINE）／平板（Kiosk）送出「種下一株」。通過不雅字詞過濾後直接以 approved 寫入，
// 投影牆經由 Realtime（與定時重新整理）幾秒內就會讓它發芽；有問題的內容由後台一鍵下架。
plantingsRouter.post('/', async (req, res) => {
  const { accessToken, kioskSessionId, plantType, message, nickname } = req.body || {};

  if (!PLANT_TYPES.has(plantType)) {
    return res.status(400).json({ error: '未知的植物種類' });
  }

  const trimmedMessage = typeof message === 'string' ? message.trim() : '';
  if (typeof message !== 'string' || trimmedMessage.length > MESSAGE_LIMIT) {
    return res.status(400).json({ error: `留言需為 ${MESSAGE_LIMIT} 字以內的文字` });
  }

  const trimmedNickname = typeof nickname === 'string' ? nickname.trim() : '';
  if (trimmedNickname.length === 0 || trimmedNickname.length > NICKNAME_LIMIT) {
    return res.status(400).json({ error: `暱稱需為 1-${NICKNAME_LIMIT} 字` });
  }

  if (containsBlockedContent(trimmedMessage) || containsBlockedContent(trimmedNickname)) {
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
  } else if (typeof kioskSessionId === 'string' && (await kioskSessionExists(kioskSessionId))) {
    source = 'kiosk';
    participantId = kioskSessionId;
  } else if (typeof kioskSessionId === 'string') {
    return res.status(400).json({ error: '互動編號無效，請重新整理頁面' });
  } else {
    return res.status(400).json({ error: '缺少身分資訊' });
  }

  if (await plantedTooRecently(participantId)) {
    return res.status(429).json({ error: '剛剛才種下一株，請等幾秒再種下一株' });
  }

  const now = new Date().toISOString();
  const { data, error } = await db()
    .from('plantings')
    .insert({
      source,
      line_user_id: participantId,
      display_name: trimmedNickname,
      plant_type: plantType,
      message: trimmedMessage,
      status: 'approved',
      moderated_at: now,
      moderated_by: 'auto',
    })
    .select('id, status, plant_type, created_at')
    .single();

  if (error) {
    return res.status(500).json({ error: '寫入失敗，請稍後再試' });
  }

  if (source === 'line') {
    // 以 LINE userId 去重留存：新使用者建立一列，舊使用者更新最近參與時間與次數。
    // 這裡固定存「LINE 驗證過的真實顯示名稱」，跟使用者自訂公開暱稱（display_name）分開，
    // 前者給後台名冊使用，後者才是牆上看到的名字。
    const { error: touchError } = await db().rpc('touch_line_user', {
      p_user_id: participantId,
      p_display_name: verifiedDisplayName,
    });
    if (touchError) {
      console.error('touch_line_user failed', touchError);
    }
  }

  res.status(201).json({
    planting: data,
    notice: '抬頭看看投影牆：種子正從 QR 卡片飛進花園，落地就會發芽。',
  });
});

// 後台：最近的種植紀錄（含已下架），值班人員看到不當內容可以一鍵下架或恢復。
plantingsRouter.get('/recent', adminAuth, async (_req, res) => {
  const { data, error } = await db()
    .from('plantings')
    .select('id, display_name, plant_type, message, source, status, created_at, moderated_by')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return res.status(500).json({ error: '讀取失敗' });
  }

  res.json({ plantings: data });
});

// 後台：人次（總互動筆數）／人數（不重複參與者，LINE 與 Kiosk 合併去重）統計
plantingsRouter.get('/stats', adminAuth, async (_req, res) => {
  const { data, error } = await fetchAll(() =>
    db().from('plantings').select('line_user_id, source, status').order('created_at').order('id')
  );

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
    onWall: data.filter((r) => r.status === 'approved').length,
    hidden: data.filter((r) => r.status === 'rejected').length,
    bySource: {
      line: { interactions: data.filter((r) => r.source !== 'kiosk').length, participants: uniqueLine.size },
      kiosk: { interactions: data.filter((r) => r.source === 'kiosk').length, participants: uniqueKiosk.size },
    },
  });
});

// 後台：原始名單一鍵下載（CSV），所有欄位、所有狀態，供離線分析用。
plantingsRouter.get('/export', adminAuth, async (_req, res) => {
  const { data, error } = await fetchAll(() =>
    db()
      .from('plantings')
      .select('id, source, line_user_id, display_name, plant_type, message, status, created_at, moderated_at, moderated_by')
      .order('created_at', { ascending: false })
      .order('id')
  );

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

async function setStatus(req, res, status) {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(404).json({ error: '找不到這筆紀錄' });
  }

  const { data, error } = await db()
    .from('plantings')
    .update({ status, moderated_at: new Date().toISOString(), moderated_by: 'admin' })
    .eq('id', req.params.id)
    .select('id, status')
    .maybeSingle();

  if (error || !data) {
    return res.status(404).json({ error: '找不到這筆紀錄' });
  }

  res.json({ planting: data });
}

// 後台：上架（approved）—— 已下架的也可以恢復
plantingsRouter.post('/:id/approve', adminAuth, (req, res) => setStatus(req, res, 'approved'));

// 後台：下架（rejected）—— 投影牆會在下一次同步時讓它消失
plantingsRouter.post('/:id/reject', adminAuth, (req, res) => setStatus(req, res, 'rejected'));
