import test from 'node:test';
import assert from 'node:assert/strict';
import { createGraphClient, fetchInsights, GraphError } from '../server/lib/meta.js';
import { collectSocialData, graphDayKey, periodWindows, taipeiDateKey } from '../server/lib/socialCollect.js';
import { CONFIG, NOW, json, loadPlantings, mockGraph } from './fixtures/metaGraphMock.js';
import {
  analyzeSocial,
  daypartOf,
  engagementRate,
  hashtagsOf,
  median,
  offlineLink,
  pctChange,
  reportMarkdown,
} from '../server/lib/socialAnalysis.js';

test('期間以台灣午夜為界：今天不算，本期與上一期等長且相鄰', () => {
  const w = periodWindows(28, NOW);
  assert.equal(w.current.end.toISOString(), '2026-11-12T16:00:00.000Z');
  assert.equal(taipeiDateKey(w.current.start), '2026-10-16');
  assert.equal(w.previous.end.getTime(), w.current.start.getTime());
  assert.equal(graphDayKey('2026-11-13T08:00:00+0000'), '2026-11-12');
  assert.equal(graphDayKey('2026-11-13T07:00:00+0000'), '2026-11-12');
});

test('洞察查詢：整包失敗時逐一重試，只把真正失效的指標標記起來', async () => {
  const { fetchImpl, calls } = mockGraph();
  const client = createGraphClient(CONFIG, fetchImpl);
  const bad = new Set();
  const r = await fetchInsights(client, 'PAGE_1', ['post_media_view', 'post_clicks'], {}, bad);
  assert.equal(r.values.post_media_view.series[0].value, 3000);
  assert.deepEqual(r.unavailable, ['post_clicks']);
  assert.ok(bad.has('post_clicks'));
  const before = calls.length;
  await fetchInsights(client, 'PAGE_2', ['post_media_view', 'post_clicks'], {}, bad);
  assert.equal(calls.length - before, 1, '已知失效的指標不再重打');
});

test('權杖失效直接丟出，不被當成單一指標失效吞掉', async () => {
  const client = createGraphClient(CONFIG, async () => json({ error: { message: 'Session has expired', code: 190 } }, 400));
  await assert.rejects(fetchInsights(client, 'PAGE', ['a', 'b']), (err) => err instanceof GraphError && err.code === 190);
});

test('完整報表：FB＋IG＋植生牆整合，產生洞察、策略與 Markdown', async () => {
  const { fetchImpl } = mockGraph();
  const raw = await collectSocialData({ days: 28, now: NOW, config: CONFIG, fetchImpl, loadPlantings });

  assert.equal(raw.range.current.start, '2026-10-16');
  assert.equal(raw.range.current.end, '2026-11-12');
  assert.equal(raw.facebook.error, null);
  assert.equal(raw.facebook.page.followers, 1200);
  assert.equal(raw.facebook.totals.current.views, 500 * 28);
  assert.equal(raw.facebook.totals.previous.views, 300 * 28);
  assert.equal(raw.facebook.totals.current.pageViews, null);
  assert.ok(raw.facebook.unavailable.includes('page_views_total'));
  assert.ok(raw.facebook.unavailable.includes('post_clicks'));
  assert.equal(raw.facebook.posts.length, 6);
  assert.equal(raw.facebook.posts.find((p) => p.id === 'PAGE_1').reach, 1800);
  assert.equal(raw.facebook.posts.find((p) => p.id === 'PAGE_5').reach, null, '上一期貼文不打洞察');

  assert.equal(raw.instagram.error, null);
  assert.equal(raw.instagram.totals.current.reach, 9000);
  assert.equal(raw.instagram.totals.current.newFollowers, 5 * 28);
  assert.equal(raw.instagram.totals.previous.newFollowers, null, 'follower_count 上一期拿不到屬正常');
  assert.equal(raw.instagram.posts.length, 4);
  const reel = raw.instagram.posts.find((p) => p.id === 'M2');
  assert.equal(reel.format, 'reel');
  assert.equal(reel.engagement, 200 + 25 + 60 + 90, 'total_interactions 拿不到時自己加總');
  assert.equal(raw.plantings.totals.current, 14 * 6 + 14 * 2);

  const a = analyzeSocial(raw);
  const fbViews = a.kpis.facebook.find((k) => k.id === 'views');
  assert.ok(Math.abs(fbViews.change - (500 / 300 - 1)) < 1e-9);
  assert.equal(a.cadence.facebook.current, 5);
  assert.equal(a.cadence.instagram.current, 3);
  assert.equal(a.formats.facebook[0].key, 'video', 'FB 影片互動率最高');
  assert.ok(a.topPosts.length > 0 && a.topPosts[0].index >= a.topPosts.at(-1).index);
  assert.ok(a.offline.reliable);
  assert.ok(a.offline.lift > 1);

  const titles = a.insights.map((i) => i.title);
  assert.ok(titles.some((t) => t.includes('Facebook觀看次數成長')), titles.join('\n'));
  assert.ok(titles.some((t) => t.includes('「影片」互動表現最好')), titles.join('\n'));
  assert.ok(titles.some((t) => t.includes('植生牆種植數多')), titles.join('\n'));
  assert.ok(titles.some((t) => t.includes('部分指標目前拿不到')));

  const actions = a.strategy.actions.map((s) => s.action);
  assert.ok(actions.some((s) => s.includes('參加連結')), actions.join('\n'));
  assert.ok(actions.some((s) => s.includes('發文提高到每週')), actions.join('\n'));
  assert.equal(a.strategy.pillars.length, 4);
  assert.ok(a.strategy.targets.some((t) => t.label === 'FB 觀看次數' && t.target === Math.round(14000 * 1.1)));

  const md = reportMarkdown(raw, a);
  assert.ok(md.startsWith('# 日南稻站 社群洞察報告（近 28 天）'));
  assert.ok(md.includes('## 後續行銷策略'));
  assert.ok(md.includes('| 觀看次數 | 14,000 | 8,400 | +67% |'));
});

test('IG 沒連結、FB 正常時，FB 照常出報表並提示 IG 設定', async () => {
  const { fetchImpl } = mockGraph();
  const wrapped = async (url) => {
    if (new URL(url).pathname === '/v25.0/PAGE') return json({ name: '日南稻站', followers_count: 1200 });
    return fetchImpl(url);
  };
  const raw = await collectSocialData({ days: 7, now: NOW, config: CONFIG, fetchImpl: wrapped });
  assert.equal(raw.facebook.error, null);
  assert.match(raw.instagram.error, /連結 IG/);
  assert.equal(raw.plantings, null);
  const a = analyzeSocial(raw);
  assert.equal(a.kpis.instagram, null);
  assert.ok(a.insights[0].tone === 'warn' && a.insights[0].scope === 'instagram');
  assert.ok(a.strategy.actions[0].action.includes('修復 Instagram'));
});

test('權杖過期：兩個平台都回報可理解的錯誤訊息', async () => {
  const raw = await collectSocialData({
    days: 7,
    now: NOW,
    config: CONFIG,
    fetchImpl: async () => json({ error: { message: 'Error validating access token', code: 190 } }, 400),
  });
  assert.match(raw.facebook.error, /權杖無效或已過期/);
  assert.ok(raw.instagram.error);
});

test('分析工具：中位數、變化率、互動率基準、時段、標籤', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(median([null, undefined]), null);
  assert.equal(pctChange(150, 100), 0.5);
  assert.equal(pctChange(10, 0), null);
  assert.equal(pctChange(null, 10), null);
  assert.deepEqual(engagementRate({ engagement: 50, reach: 1000 }, 200), { rate: 0.05, basis: 'reach' });
  assert.deepEqual(engagementRate({ engagement: 50, reach: null }, 200), { rate: 0.25, basis: 'followers' });
  assert.equal(daypartOf(2).id, 'night');
  assert.equal(daypartOf(23).id, 'night');
  assert.equal(daypartOf(19).id, 'evening');
  assert.deepEqual(hashtagsOf('#日南稻站 好 #往返 #日南稻站 #Rice_2026'), ['#日南稻站', '#往返', '#rice_2026']);
});

test('植生牆關聯：資料太少時標記為不可靠', () => {
  const raw = { plantings: { daily: [{ date: '2026-11-01', count: 2 }, { date: '2026-11-02', count: 1 }] } };
  const o = offlineLink(raw, [{ date: '2026-11-01' }]);
  assert.equal(o.reliable, false);
  assert.equal(o.onDays, 2);
});
