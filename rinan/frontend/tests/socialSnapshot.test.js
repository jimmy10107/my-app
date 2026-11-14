import test from 'node:test';
import assert from 'node:assert/strict';
import { collectSocialData } from '../server/lib/socialCollect.js';
import { historyByDay, isMissingTable, saveSnapshot, snapshotRows } from '../server/lib/socialSnapshot.js';
import { CONFIG, NOW, loadPlantings, mockGraph } from './fixtures/metaGraphMock.js';

async function sampleRaw(days = 7) {
  const { fetchImpl } = mockGraph();
  return collectSocialData({ days, now: NOW, config: CONFIG, fetchImpl, loadPlantings });
}

// 模擬 Supabase upsert：以 (day, platform) 為鍵，只更新這次有帶的欄位（PostgREST 的行為）
function fakeDb() {
  const table = new Map();
  const calls = [];
  return {
    table,
    calls,
    from(name) {
      assert.equal(name, 'social_daily');
      return {
        upsert: async (rows, opts) => {
          assert.equal(opts.onConflict, 'day,platform');
          const keys = Object.keys(rows[0]).sort().join(',');
          rows.forEach((r) => assert.equal(Object.keys(r).sort().join(','), keys, '同一批的欄位要一致'));
          calls.push(rows.length);
          for (const r of rows) {
            const key = `${r.day}|${r.platform}`;
            table.set(key, { ...(table.get(key) || {}), ...r });
          }
          return { error: null };
        },
      };
    },
  };
}

test('快照：每天一列，粉絲數只放在最後一天', async () => {
  const raw = await sampleRaw(7);
  const rows = snapshotRows(raw);
  const fb = rows.filter((r) => r.platform === 'facebook');
  const ig = rows.filter((r) => r.platform === 'instagram');
  const plant = rows.filter((r) => r.platform === 'plantings');
  assert.equal(fb.length, 7);
  assert.equal(ig.length, 7);
  assert.equal(plant.length, 7);
  assert.deepEqual(
    fb.filter((r) => 'followers' in r).map((r) => [r.day, r.followers]),
    [['2026-11-12', 1200]]
  );
  assert.deepEqual(
    ig.filter((r) => 'followers' in r).map((r) => [r.day, r.followers]),
    [['2026-11-12', 3400]]
  );
  const nov10 = fb.find((r) => r.day === '2026-11-10');
  assert.equal(nov10.metrics.views, 500);
  assert.equal(nov10.metrics.posts, 1, '11/10 台灣時間有一篇 FB 貼文');
  assert.equal(ig.find((r) => r.day === '2026-11-11').metrics.posts, 1);
});

test('快照：重寫前幾天的數字時，不會把之前存的粉絲數蓋掉', async () => {
  const client = fakeDb();
  // 第一天：11/12 存了粉絲數
  await saveSnapshot(client, await sampleRaw(7), new Date(NOW));
  assert.equal(client.table.get('2026-11-12|facebook').followers, 1200);

  // 隔天：最後一天變 11/13，11/12 只更新每日數字
  const later = NOW + 24 * 3600 * 1000;
  const { fetchImpl } = mockGraph();
  const raw = await collectSocialData({ days: 7, now: later, config: CONFIG, fetchImpl, loadPlantings });
  raw.facebook.page.followers = 1210;
  await saveSnapshot(client, raw, new Date(later));
  assert.equal(client.table.get('2026-11-12|facebook').followers, 1200, '前一天的粉絲數保留');
  assert.equal(client.table.get('2026-11-13|facebook').followers, 1210);
  assert.equal(client.calls.length, 4, '每次分「有粉絲數」與「沒有」兩批寫');
});

test('平台讀取失敗時不寫空列', async () => {
  const raw = await sampleRaw(7);
  raw.instagram = { error: '權限不足', posts: [], daily: [], unavailable: [] };
  const rows = snapshotRows(raw);
  assert.equal(rows.filter((r) => r.platform === 'instagram').length, 0);
  assert.ok(rows.some((r) => r.platform === 'facebook'));
});

test('歷史整理成一天一列，三個來源並排', () => {
  const history = historyByDay([
    { day: '2026-11-02', platform: 'facebook', followers: null, metrics: { views: 10 } },
    { day: '2026-11-01', platform: 'instagram', followers: 300, metrics: { reach: 5 } },
    { day: '2026-11-01', platform: 'plantings', followers: null, metrics: { count: 4 } },
  ]);
  assert.deepEqual(history, [
    { date: '2026-11-01', instagram: { followers: 300, reach: 5 }, plantings: { followers: null, count: 4 } },
    { date: '2026-11-02', facebook: { followers: null, views: 10 } },
  ]);
});

test('辨識「還沒建表」的錯誤', () => {
  assert.ok(isMissingTable({ code: 'PGRST205', message: "Could not find the table 'public.social_daily'" }));
  assert.ok(isMissingTable({ code: '42P01', message: 'relation does not exist' }));
  assert.ok(!isMissingTable({ code: '23505', message: 'duplicate key' }));
});

test('排程端點：沒設定或帶錯 CRON_SECRET 一律拒絕', async () => {
  Object.assign(process.env, {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'x',
    LIFF_CHANNEL_ID: '1',
    ADMIN_PASSWORD: 'p',
    ADMIN_JWT_SECRET: 's',
  });
  delete process.env.CRON_SECRET;
  const { app } = await import('../server/app.js');
  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}/api/social/snapshot`;
  try {
    assert.equal((await fetch(base)).status, 503);
    process.env.CRON_SECRET = 'cron-secret';
    assert.equal((await fetch(base)).status, 401);
    assert.equal((await fetch(base, { headers: { Authorization: 'Bearer wrong' } })).status, 401);
    // 密鑰正確但沒設定 Meta：回 503 說缺什麼，不會去打 Meta
    delete process.env.META_PAGE_ID;
    const res = await fetch(base, { headers: { Authorization: 'Bearer cron-secret' } });
    assert.equal(res.status, 503);
    assert.match((await res.json()).error, /META_PAGE_ID/);
  } finally {
    server.close();
    delete process.env.CRON_SECRET;
  }
});
