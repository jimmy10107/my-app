import { env } from '../config/env.js';

/**
 * 驗證前端 liff.getAccessToken() 拿到的 token 確實屬於這個 LIFF Channel，
 * 並取回 LINE 使用者的 userId / displayName。絕對不要相信前端直接送來的
 * userId —— 一律以這支伺服器端驗證結果為準，避免有人偽造身分洗版。
 */
export async function verifyLiffAccessToken(accessToken) {
  if (!accessToken) {
    throw new LiffAuthError('缺少 LINE access token');
  }

  const verifyRes = await fetch(
    `https://api.line.me/oauth2/v2.1/verify?access_token=${encodeURIComponent(accessToken)}`
  );

  if (!verifyRes.ok) {
    throw new LiffAuthError('LINE access token 無效或已過期');
  }

  const verifyData = await verifyRes.json();

  if (verifyData.client_id !== env.liffChannelId) {
    throw new LiffAuthError('access token 不屬於本 LIFF Channel');
  }

  const profileRes = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!profileRes.ok) {
    throw new LiffAuthError('無法取得 LINE 使用者資料');
  }

  const profile = await profileRes.json();

  return {
    userId: profile.userId,
    displayName: profile.displayName,
  };
}

export class LiffAuthError extends Error {}
