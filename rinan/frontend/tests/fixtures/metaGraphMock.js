import assert from 'node:assert/strict';
import { taipeiDateKey } from '../../server/lib/socialCollect.js';

// 測試用的假 Graph API：回應格式照真實 Graph API（每日數值、lifetime 洞察、錯誤物件），
// 並模擬幾種 Meta 實際會發生的狀況——指標已汰換、follower_count 只給 30 天、單篇洞察拿不到。
// 2026-11-13 15:00 台灣時間
export const NOW = Date.parse('2026-11-13T07:00:00Z');
export const CONFIG = { pageId: 'PAGE', token: 'TOKEN', igUserId: undefined, appSecret: 'SECRET', version: 'v25.0' };

export const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
const graphErr = (message, code = 100) => json({ error: { message, code, type: 'OAuthException' } }, 400);

// 依 since／until 產生每日數值，end_time 落在美西午夜（UTC 08:00），跟真實 Graph API 一樣。
function dailyValues(since, until, valueFor) {
  const out = [];
  for (let t = since * 1000; t < until * 1000; t += 86400000) {
    const day = new Date(t + 8 * 3600000).toISOString().slice(0, 10); // 台灣日期
    const end = new Date(`${day}T08:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    out.push({ value: valueFor(day), end_time: end.toISOString().replace('.000Z', '+0000') });
  }
  return out;
}

const iso = (s) => new Date(s).toISOString();
const FB_POSTS = [
  // 本期（10/16 ～ 11/12）
  { id: 'PAGE_1', message: '木麻黃守護日南的海線 #日南稻站', created_time: iso('2026-11-10T11:00:00Z'), status_type: 'added_video', reactions: 90, comments: 12, shares: 20 },
  { id: 'PAGE_2', message: '展覽開幕', created_time: iso('2026-11-05T04:00:00Z'), status_type: 'added_photos', reactions: 30, comments: 2, shares: 3 },
  { id: 'PAGE_3', message: '活動連結', created_time: iso('2026-10-30T04:00:00Z'), status_type: 'shared_story', reactions: 8, comments: 0, shares: 1 },
  { id: 'PAGE_4', message: '影片花絮 #日南稻站', created_time: iso('2026-10-25T11:30:00Z'), status_type: 'added_video', reactions: 70, comments: 9, shares: 15 },
  { id: 'PAGE_6', message: '現場一隅', created_time: iso('2026-10-20T04:00:00Z'), status_type: 'added_photos', reactions: 12, comments: 1, shares: 0 },
  // 上一期
  { id: 'PAGE_5', message: '預告', created_time: iso('2026-10-01T04:00:00Z'), status_type: 'added_photos', reactions: 10, comments: 1, shares: 0 },
];
const IG_MEDIA = [
  { id: 'M1', caption: '芋頭的實踐 #日南稻站 #往返', media_type: 'CAROUSEL_ALBUM', media_product_type: 'FEED', timestamp: iso('2026-11-11T11:00:00Z'), like_count: 120, comments_count: 10 },
  { id: 'M2', caption: '種下就上牆', media_type: 'VIDEO', media_product_type: 'REELS', timestamp: iso('2026-11-06T11:00:00Z'), like_count: 200, comments_count: 25 },
  { id: 'M3', caption: '現場照片', media_type: 'IMAGE', media_product_type: 'FEED', timestamp: iso('2026-10-28T03:00:00Z'), like_count: 40, comments_count: 1 },
  { id: 'M4', caption: '舊貼文', media_type: 'IMAGE', media_product_type: 'FEED', timestamp: iso('2026-09-20T03:00:00Z'), like_count: 10, comments_count: 0 },
];
const MEDIA_INSIGHTS = { M1: { reach: 1500, views: 2400, saved: 80, shares: 40 }, M2: { reach: 5000, views: 9000, saved: 60, shares: 90 }, M3: { reach: 900, views: 1100, saved: 2, shares: 1 } };
const POST_INSIGHTS = { PAGE_1: [3000, 1800], PAGE_2: [1500, 900], PAGE_3: [600, 400], PAGE_4: [2600, 1500], PAGE_6: [900, 600] };

export function mockGraph() {
  const calls = [];
  const fetchImpl = async (url) => {
    const u = new URL(url);
    calls.push(u);
    assert.equal(u.searchParams.get('access_token'), 'TOKEN');
    assert.match(u.searchParams.get('appsecret_proof'), /^[0-9a-f]{64}$/);
    const path = u.pathname.replace('/v25.0/', '');
    const q = Object.fromEntries(u.searchParams);
    const metrics = (q.metric || '').split(',');
    const since = Number(q.since);
    const until = Number(q.until);

    if (path === 'PAGE') return json({ name: '日南稻站', followers_count: 1200, link: 'https://facebook.com/rinan', instagram_business_account: { id: 'IG1' } });
    if (path === 'PAGE/insights') {
      if (metrics.includes('page_views_total')) return graphErr('(#100) The value must be a valid insights metric');
      return json({
        data: metrics.map((name) => ({
          name,
          period: 'day',
          values: dailyValues(since, until, (day) => {
            const recent = day >= '2026-10-16';
            return { page_media_view: recent ? 500 : 300, page_total_media_view_unique: recent ? 200 : 150, page_post_engagements: recent ? 40 : 20, page_daily_follows_unique: 3, page_daily_unfollows_unique: 1 }[name];
          }),
        })),
      });
    }
    if (path === 'PAGE/posts') {
      const rows = FB_POSTS.filter((p) => Date.parse(p.created_time) / 1000 >= since).map((p) => ({
        id: p.id,
        message: p.message,
        created_time: p.created_time,
        status_type: p.status_type,
        permalink_url: `https://facebook.com/${p.id}`,
        shares: { count: p.shares },
        reactions: { data: [], summary: { total_count: p.reactions } },
        comments: { data: [], summary: { total_count: p.comments } },
      }));
      return json({ data: rows });
    }
    const postInsight = path.match(/^(PAGE_\d)\/insights$/);
    if (postInsight) {
      if (metrics.includes('post_clicks')) return graphErr('(#100) post_clicks is deprecated');
      const [views, reach] = POST_INSIGHTS[postInsight[1]];
      const value = { post_media_view: views, post_total_media_view_unique: reach };
      return json({ data: metrics.map((name) => ({ name, period: 'lifetime', values: [{ value: value[name] }] })) });
    }
    if (path === 'IG1') return json({ username: 'rinan.station', followers_count: 3400, media_count: 80 });
    if (path === 'IG1/insights') {
      const recent = since * 1000 >= Date.parse('2026-10-15T16:00:00Z');
      if (q.metric_type === 'total_value') {
        if (metrics.includes('profile_links_taps') && metrics.length > 1) return graphErr('(#100) metric not supported');
        if (metrics[0] === 'profile_links_taps') return graphErr('(#100) metric not supported');
        const totals = { reach: recent ? 9000 : 6000, views: recent ? 20000 : 15000, accounts_engaged: recent ? 800 : 500, total_interactions: recent ? 1200 : 700, likes: 900, comments: 60, shares: 140, saves: 150 };
        return json({ data: metrics.map((name) => ({ name, period: 'day', total_value: { value: totals[name] } })) });
      }
      if (!recent && metrics.includes('follower_count')) return graphErr('(#100) follower_count only supports the last 30 days');
      return json({ data: metrics.map((name) => ({ name, period: 'day', values: dailyValues(since, until, () => (name === 'reach' ? 300 : 5)) })) });
    }
    if (path === 'IG1/media') {
      return json({ data: IG_MEDIA.map((m) => ({ ...m, permalink: `https://instagram.com/p/${m.id}` })) });
    }
    const mediaInsight = path.match(/^(M\d)\/insights$/);
    if (mediaInsight) {
      const values = MEDIA_INSIGHTS[mediaInsight[1]];
      if (metrics.includes('total_interactions')) {
        if (metrics.length > 1) return graphErr('(#100) total_interactions unavailable');
        return graphErr('(#100) total_interactions unavailable');
      }
      return json({ data: metrics.map((name) => ({ name, period: 'lifetime', values: [{ value: values[name] }] })) });
    }
    return graphErr(`unexpected path ${path}`, 803);
  };
  return { fetchImpl, calls };
}

// 植生牆：發文日（含隔天）明顯比較多人種
export function loadPlantings() {
  const rows = [];
  const postDays = new Set(['2026-10-20', '2026-10-21', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-05', '2026-11-06', '2026-11-07', '2026-10-30', '2026-10-31', '2026-10-25', '2026-10-26', '2026-10-28', '2026-10-29']);
  for (let t = Date.parse('2026-09-18T00:00:00Z'); t < NOW; t += 86400000) {
    const day = taipeiDateKey(t);
    const n = day < '2026-10-16' ? 1 : postDays.has(day) ? 6 : 2;
    for (let i = 0; i < n; i++) rows.push({ created_at: new Date(t + i * 60000).toISOString() });
  }
  return Promise.resolve(rows);
}
