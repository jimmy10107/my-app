import { createGraphClient, fetchInsights, mapLimit, metaConfig, GraphError } from './meta.js';
import { startOfTaipeiDay } from './time.js';

// 把 FB 粉專、IG 專業帳號與植生牆種植數整理成同一份「本期 vs 上一期」原始資料，
// 交給 socialAnalysis.js 產生洞察與策略。每個平台各自 try/catch：IG 沒連結或權限不足時，
// FB 部分照樣出報表，錯誤訊息放在該平台的 error 欄位給後台顯示。

const DAY_MS = 24 * 60 * 60 * 1000;
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

// FB 粉專每日指標（2025-11 起 impressions → page_media_view；2026-06 起 page_impressions_unique →
// page_total_media_view_unique）。失效的會自動略過並列在 unavailable。
export const FB_PAGE_METRICS = [
  'page_media_view',
  'page_total_media_view_unique',
  'page_post_engagements',
  'page_daily_follows_unique',
  'page_daily_unfollows_unique',
  'page_views_total',
];
export const FB_POST_METRICS = ['post_media_view', 'post_total_media_view_unique', 'post_clicks'];

export const IG_TOTAL_METRICS = [
  'reach',
  'views',
  'accounts_engaged',
  'total_interactions',
  'likes',
  'comments',
  'shares',
  'saves',
  'profile_links_taps',
];
export const IG_SERIES_METRICS = ['reach', 'follower_count'];
export const IG_MEDIA_METRICS = ['reach', 'views', 'saved', 'shares', 'total_interactions'];

const MAX_POSTS = 150;
const INSIGHT_CONCURRENCY = 6;

export function periodWindows(days, now = Date.now()) {
  const end = startOfTaipeiDay(now); // 今天還沒過完，不算進統計
  const currentStart = new Date(end.getTime() - days * DAY_MS);
  const previousStart = new Date(end.getTime() - 2 * days * DAY_MS);
  return {
    current: { start: currentStart, end },
    previous: { start: previousStart, end: currentStart },
  };
}

// 台灣日期字串（YYYY-MM-DD）
export function taipeiDateKey(date) {
  return new Date(new Date(date).getTime() + TAIPEI_OFFSET_MS).toISOString().slice(0, 10);
}

// Graph API 每日數值的 end_time 是「那一天結束的時刻」（多半落在 UTC 07:00／08:00，也就是美西午夜）。
// 往前推 12 小時再取 UTC 日期，就是這筆數值代表的那一天。
export function graphDayKey(endTime) {
  return new Date(new Date(endTime).getTime() - 12 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function dateKeysBetween(start, end) {
  const keys = [];
  for (let t = start.getTime(); t < end.getTime(); t += DAY_MS) keys.push(taipeiDateKey(t));
  return keys;
}

const unix = (date) => Math.floor(date.getTime() / 1000);

function seriesByDay(values, metric) {
  const map = new Map();
  for (const point of values[metric]?.series || []) map.set(graphDayKey(point.endTime), point.value);
  return map;
}

function sumKeys(map, keys) {
  if (map.size === 0) return null;
  return keys.reduce((acc, key) => acc + (map.get(key) || 0), 0);
}

// ---------------------------------------------------------------------------
// Facebook 粉專
// ---------------------------------------------------------------------------
async function collectFacebook(client, config, windows, keys) {
  const page = await client.get(config.pageId, {
    fields: 'name,link,followers_count,fan_count,instagram_business_account',
  });

  const insights = await fetchInsights(client, config.pageId, FB_PAGE_METRICS, {
    period: 'day',
    since: unix(windows.previous.start),
    until: unix(windows.current.end),
  });

  const series = Object.fromEntries(FB_PAGE_METRICS.map((m) => [m, seriesByDay(insights.values, m)]));
  const totalsFor = (dayKeys) => ({
    views: sumKeys(series.page_media_view, dayKeys),
    reach: sumKeys(series.page_total_media_view_unique, dayKeys), // 每日不重複人數加總，跨日會重複計算
    engagements: sumKeys(series.page_post_engagements, dayKeys),
    newFollows: sumKeys(series.page_daily_follows_unique, dayKeys),
    unfollows: sumKeys(series.page_daily_unfollows_unique, dayKeys),
    pageViews: sumKeys(series.page_views_total, dayKeys),
  });

  const rawPosts = await client.getAll(
    `${config.pageId}/posts`,
    {
      fields:
        'id,message,created_time,permalink_url,full_picture,status_type,shares,' +
        'reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)',
      since: unix(windows.previous.start),
      until: unix(windows.current.end),
      limit: 50,
    },
    { max: MAX_POSTS }
  );

  const badPostMetrics = new Set();
  const posts = await mapLimit(rawPosts, INSIGHT_CONCURRENCY, async (p) => {
    const period = new Date(p.created_time) >= windows.current.start ? 'current' : 'previous';
    const post = {
      platform: 'facebook',
      id: p.id,
      createdAt: p.created_time,
      period,
      text: p.message || '',
      permalink: p.permalink_url || null,
      image: p.full_picture || null,
      format: fbFormat(p.status_type),
      reactions: p.reactions?.summary?.total_count ?? 0,
      comments: p.comments?.summary?.total_count ?? 0,
      shares: p.shares?.count ?? 0,
      saves: null,
      views: null,
      reach: null,
      clicks: null,
    };
    // 上一期的貼文只拿來算發文頻率，不額外打洞察請求
    if (period === 'current') {
      const r = await fetchInsights(client, p.id, FB_POST_METRICS, {}, badPostMetrics);
      post.views = lifetime(r.values.post_media_view);
      post.reach = lifetime(r.values.post_total_media_view_unique);
      post.clicks = lifetime(r.values.post_clicks);
    }
    post.engagement = post.reactions + post.comments + post.shares;
    return post;
  });

  return {
    page: {
      name: page.name,
      link: page.link || null,
      followers: page.followers_count ?? page.fan_count ?? null,
    },
    linkedIgUserId: page.instagram_business_account?.id || null,
    totals: { current: totalsFor(keys.current), previous: totalsFor(keys.previous) },
    daily: keys.current.map((date) => ({
      date,
      views: series.page_media_view.get(date) ?? null,
      reach: series.page_total_media_view_unique.get(date) ?? null,
      engagements: series.page_post_engagements.get(date) ?? null,
      newFollows: series.page_daily_follows_unique.get(date) ?? null,
    })),
    posts,
    unavailable: [...new Set([...insights.unavailable, ...badPostMetrics])],
    error: insights.error && Object.keys(insights.values).length === 0 ? insights.error.message : null,
  };
}

function fbFormat(statusType) {
  switch (statusType) {
    case 'added_photos':
      return 'photo';
    case 'added_video':
      return 'video';
    case 'shared_story':
      return 'link';
    case 'created_event':
      return 'event';
    default:
      return 'text';
  }
}

function lifetime(metric) {
  if (!metric) return null;
  if (metric.total !== undefined) return metric.total;
  const last = metric.series?.at(-1);
  return last ? last.value : null;
}

// ---------------------------------------------------------------------------
// Instagram 專業帳號
// ---------------------------------------------------------------------------
async function collectInstagram(client, igUserId, windows, keys) {
  const account = await client.get(igUserId, { fields: 'username,name,followers_count,follows_count,media_count' });

  const badTotal = new Set();
  const totalsFor = async (w) => {
    const r = await fetchInsights(
      client,
      igUserId,
      IG_TOTAL_METRICS,
      { metric_type: 'total_value', period: 'day', since: unix(w.start), until: unix(w.end) },
      badTotal
    );
    const pick = (m) => r.values[m]?.total ?? null;
    return {
      reach: pick('reach'),
      views: pick('views'),
      accountsEngaged: pick('accounts_engaged'),
      totalInteractions: pick('total_interactions'),
      likes: pick('likes'),
      comments: pick('comments'),
      shares: pick('shares'),
      saves: pick('saves'),
      profileLinksTaps: pick('profile_links_taps'),
      newFollowers: null,
    };
  };

  // IG 每日序列一次最多 30 天，而且 follower_count 只提供最近 30 天——上一期常常拿不到，屬正常。
  // 兩期各用自己的 badMetrics：上一期拿不到 follower_count 不代表本期也拿不到。
  const seriesFor = (w) =>
    fetchInsights(client, igUserId, IG_SERIES_METRICS, { period: 'day', since: unix(w.start), until: unix(w.end) }, new Set());

  const [current, previous, seriesCurrent, seriesPrevious] = await Promise.all([
    totalsFor(windows.current),
    totalsFor(windows.previous),
    seriesFor(windows.current),
    seriesFor(windows.previous),
  ]);

  const reachDaily = seriesByDay(seriesCurrent.values, 'reach');
  const followerDaily = seriesByDay(seriesCurrent.values, 'follower_count');
  current.newFollowers = sumKeys(followerDaily, keys.current);
  previous.newFollowers = sumKeys(seriesByDay(seriesPrevious.values, 'follower_count'), keys.previous);

  const rawMedia = await client.getAll(
    `${igUserId}/media`,
    {
      fields: 'id,caption,media_type,media_product_type,timestamp,permalink,thumbnail_url,media_url,like_count,comments_count',
      limit: 50,
    },
    { max: MAX_POSTS, stopWhen: (m) => new Date(m.timestamp) < windows.previous.start }
  );
  const inRange = rawMedia.filter((m) => new Date(m.timestamp) < windows.current.end);

  const badMedia = new Set();
  const posts = await mapLimit(inRange, INSIGHT_CONCURRENCY, async (m) => {
    const period = new Date(m.timestamp) >= windows.current.start ? 'current' : 'previous';
    const post = {
      platform: 'instagram',
      id: m.id,
      createdAt: m.timestamp,
      period,
      text: m.caption || '',
      permalink: m.permalink || null,
      image: m.thumbnail_url || (m.media_type === 'VIDEO' ? null : m.media_url) || null,
      format: igFormat(m),
      reactions: m.like_count ?? 0,
      comments: m.comments_count ?? 0,
      shares: null,
      saves: null,
      views: null,
      reach: null,
      clicks: null,
    };
    let totalInteractions = null;
    if (period === 'current') {
      const r = await fetchInsights(client, m.id, IG_MEDIA_METRICS, {}, badMedia);
      post.reach = lifetime(r.values.reach);
      post.views = lifetime(r.values.views);
      post.saves = lifetime(r.values.saved);
      post.shares = lifetime(r.values.shares);
      totalInteractions = lifetime(r.values.total_interactions);
    }
    post.engagement = totalInteractions ?? post.reactions + post.comments + (post.saves || 0) + (post.shares || 0);
    return post;
  });

  return {
    account: {
      username: account.username,
      name: account.name || null,
      followers: account.followers_count ?? null,
      mediaCount: account.media_count ?? null,
    },
    totals: { current, previous },
    daily: keys.current.map((date) => ({
      date,
      reach: reachDaily.get(date) ?? null,
      newFollowers: followerDaily.get(date) ?? null,
    })),
    posts,
    unavailable: [...new Set([...badTotal, ...seriesCurrent.unavailable, ...badMedia])],
    error: null,
  };
}

function igFormat(m) {
  if (m.media_product_type === 'REELS') return 'reel';
  if (m.media_type === 'CAROUSEL_ALBUM') return 'carousel';
  if (m.media_type === 'VIDEO') return 'video';
  return 'photo';
}

// ---------------------------------------------------------------------------
// 植生牆：每日種植數（把社群聲量跟現場參與放在一起看）
// ---------------------------------------------------------------------------
async function collectPlantings(loadPlantings, windows, keys) {
  if (!loadPlantings) return null;
  const rows = await loadPlantings(windows.previous.start);
  const byDay = new Map();
  for (const row of rows) {
    const key = taipeiDateKey(row.created_at);
    byDay.set(key, (byDay.get(key) || 0) + 1);
  }
  return {
    daily: keys.current.map((date) => ({ date, count: byDay.get(date) || 0 })),
    previousDaily: keys.previous.map((date) => ({ date, count: byDay.get(date) || 0 })),
    totals: {
      current: keys.current.reduce((a, k) => a + (byDay.get(k) || 0), 0),
      previous: keys.previous.reduce((a, k) => a + (byDay.get(k) || 0), 0),
    },
  };
}

function platformError(err) {
  if (err instanceof GraphError && err.code === 190) {
    return '粉專權杖無效或已過期，請重新產生 META_PAGE_ACCESS_TOKEN';
  }
  if (err instanceof GraphError && err.isAuthProblem) {
    return `權限不足：${err.message}（請確認權杖含 pages_read_engagement、read_insights、instagram_basic、instagram_manage_insights）`;
  }
  return err.message || String(err);
}

export async function collectSocialData({ days, now = Date.now(), config = metaConfig(), fetchImpl, loadPlantings }) {
  const client = createGraphClient(config, fetchImpl);
  const windows = periodWindows(days, now);
  const keys = {
    current: dateKeysBetween(windows.current.start, windows.current.end),
    previous: dateKeysBetween(windows.previous.start, windows.previous.end),
  };

  let facebook;
  try {
    facebook = await collectFacebook(client, config, windows, keys);
  } catch (err) {
    facebook = { error: platformError(err), posts: [], daily: [], unavailable: [] };
  }

  const igUserId = config.igUserId || facebook.linkedIgUserId;
  let instagram;
  if (!igUserId) {
    instagram = {
      error: facebook.error ? '粉專讀取失敗，無法找到連結的 IG 帳號' : '這個粉專還沒有連結 IG 專業帳號（或請設定 META_IG_USER_ID）',
      posts: [],
      daily: [],
      unavailable: [],
    };
  } else {
    try {
      instagram = await collectInstagram(client, igUserId, windows, keys);
    } catch (err) {
      instagram = { error: platformError(err), posts: [], daily: [], unavailable: [] };
    }
  }
  delete facebook.linkedIgUserId;

  let plantings = null;
  try {
    plantings = await collectPlantings(loadPlantings, windows, keys);
  } catch {
    plantings = null; // 植生牆資料只是加值比對，讀不到不影響社群報表
  }

  return {
    days,
    generatedAt: new Date(now).toISOString(),
    range: {
      current: { start: keys.current[0], end: keys.current.at(-1) },
      previous: { start: keys.previous[0], end: keys.previous.at(-1) },
    },
    facebook,
    instagram,
    plantings,
  };
}
