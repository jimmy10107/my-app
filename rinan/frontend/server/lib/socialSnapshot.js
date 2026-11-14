import { taipeiDateKey } from './socialCollect.js';

// 社群儀表板的每日快照（Supabase social_daily 表）。
// Meta API 只給「現在」的粉絲數，每日指標也只回溯 30～93 天；每天把數字存下來，儀表板才畫得出長期趨勢。
// 每次產生報表（後台打開、Vercel Cron 每天一次）都把報表期間內每一天的數字 upsert 進去，
// 所以第一次打開 28 天報表就會補齊過去 28 天，之後每天自動往後累積。

const hasValue = (obj) => Object.values(obj).some((v) => v != null);

function postsPerDay(posts = []) {
  const map = new Map();
  for (const p of posts) {
    if (p.period !== 'current') continue;
    const key = taipeiDateKey(p.createdAt);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

// 把 collectSocialData() 的結果攤成 social_daily 的列。粉絲數只放在最後一天（＝快照當下的總數），
// 其它日子不帶 followers 欄位，upsert 時就不會把以前存的粉絲數蓋成空值。
export function snapshotRows(raw) {
  const rows = [];
  const lastDay = raw.range?.current?.end;

  if (!raw.facebook?.error) {
    const posts = postsPerDay(raw.facebook.posts);
    for (const d of raw.facebook.daily || []) {
      const metrics = { views: d.views, reach: d.reach, engagements: d.engagements, newFollows: d.newFollows };
      if (!hasValue(metrics)) continue;
      rows.push({ day: d.date, platform: 'facebook', metrics: { ...metrics, posts: posts.get(d.date) || 0 } });
    }
    if (lastDay && raw.facebook.page?.followers != null) {
      upsertFollowers(rows, lastDay, 'facebook', raw.facebook.page.followers);
    }
  }

  if (!raw.instagram?.error) {
    const posts = postsPerDay(raw.instagram.posts);
    for (const d of raw.instagram.daily || []) {
      const metrics = { reach: d.reach, newFollowers: d.newFollowers };
      if (!hasValue(metrics)) continue;
      rows.push({ day: d.date, platform: 'instagram', metrics: { ...metrics, posts: posts.get(d.date) || 0 } });
    }
    if (lastDay && raw.instagram.account?.followers != null) {
      upsertFollowers(rows, lastDay, 'instagram', raw.instagram.account.followers);
    }
  }

  for (const d of raw.plantings?.daily || []) {
    rows.push({ day: d.date, platform: 'plantings', metrics: { count: d.count } });
  }
  return rows;
}

function upsertFollowers(rows, day, platform, followers) {
  const row = rows.find((r) => r.day === day && r.platform === platform);
  if (row) row.followers = followers;
  else rows.push({ day, platform, followers, metrics: {} });
}

export function isMissingTable(error) {
  const message = error?.message || '';
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    (/social_daily/.test(message) && /not find|does not exist/.test(message))
  );
}

// 分兩批寫：有粉絲數的列整列更新；沒有的只更新 metrics，保留之前存的粉絲數。
export async function saveSnapshot(client, raw, now = new Date()) {
  const rows = snapshotRows(raw).map((r) => ({ ...r, updated_at: now.toISOString() }));
  const withFollowers = rows.filter((r) => 'followers' in r);
  const withoutFollowers = rows.filter((r) => !('followers' in r));
  for (const batch of [withFollowers, withoutFollowers]) {
    if (batch.length === 0) continue;
    const { error } = await client.from('social_daily').upsert(batch, { onConflict: 'day,platform' });
    if (error) throw error;
  }
  return { saved: rows.length, days: [...new Set(rows.map((r) => r.day))].length };
}

// 讀回歷史，整理成「一天一列、三個來源並排」給儀表板畫圖。
export function historyByDay(rows) {
  const days = new Map();
  for (const r of rows) {
    if (!days.has(r.day)) days.set(r.day, { date: r.day });
    days.get(r.day)[r.platform] = { followers: r.followers, ...(r.metrics || {}) };
  }
  return [...days.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}
