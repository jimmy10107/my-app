import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { matchingPlantings, mergeSearchResults, searchPlantings } from '../src/lib/plantSearch.js';

const row = (id, display_name, plant_type, message = '', created_at = '2026-10-31T10:00:00Z') =>
  ({ id, display_name, plant_type, message, created_at });
const plantings = [row('hao', '鄭宜豪', 'broussonetia', '一起在日南生根'),
  row('pipi', '皮皮', 'taro', '車站旁的回憶'), row('another', '另一位朋友', 'broussonetia')];

test('姓名、暱稱、留言及完整標題能辨認同種植物的不同種植者', () => {
  for (const [query, ids] of [['鄭宜豪', ['hao']], ['皮皮的芋頭', ['pipi']], ['車站', ['pipi']],
    ['構樹', ['hao', 'another']], ['不存在', []], ['  ', []]]) {
    assert.deepEqual(matchingPlantings(plantings, query).map((item) => item.id), ids);
  }
  assert.deepEqual(matchingPlantings([row('case', 'Jimmy', 'rice')], 'jimmy').map((item) => item.id), ['case']);
});

test('同名紀錄保留各株，重複查詢結果依 id 去重，完整姓名優先', () => {
  const exact = row('exact', '皮皮', 'taro');
  const other = row('second', '皮皮', 'rice');
  const partial = row('partial', '皮皮的朋友', 'taro', '', '2026-11-08T10:00:00Z');
  assert.deepEqual(mergeSearchResults([partial, exact, other, exact], '皮皮').map((item) => item.id),
    ['exact', 'second', 'partial']);
});

test('搜尋讀取已公開的歷史紀錄，完整標題限制正確物種', async () => {
  const urls = [];
  const historical = row('historical', '皮皮', 'taro', '', '2026-01-01T00:00:00Z');
  const client = createClient('https://plants.example.test', 'test-anon-key', {
    auth: { persistSession: false }, global: { fetch: async (url) => {
      const parsed = new URL(url);
      urls.push(parsed);
      return new Response(JSON.stringify(parsed.searchParams.has('display_name') ? [historical] : []), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    } },
  });
  assert.deepEqual((await searchPlantings(client, '皮皮的芋頭')).map((item) => item.id), ['historical']);
  assert.ok(urls.every((url) => url.searchParams.get('status') === 'eq.approved'));
  const byName = urls.find((url) => url.searchParams.has('display_name'));
  assert.equal(byName.searchParams.get('plant_type'), 'eq.taro');
  assert.equal(byName.searchParams.get('display_name'), 'ilike.%皮皮%');
});

test('搜尋將萬用字元視為文字，失敗時回報連線問題', async () => {
  const patterns = [];
  let fail = false;
  const client = createClient('https://plants.example.test', 'test-anon-key', {
    auth: { persistSession: false }, global: { fetch: async (url) => {
      patterns.push(new URL(url).searchParams.get('display_name'));
      return new Response(fail ? JSON.stringify({ message: 'offline' }) : '[]', {
        status: fail ? 503 : 200, headers: { 'Content-Type': 'application/json' },
      });
    } },
  });
  await searchPlantings(client, '100%_');
  assert.ok(patterns.includes('ilike.%100\\%\\_%'));
  fail = true;
  await assert.rejects(searchPlantings(client, '皮皮'), /搜尋暫時無法連線/);
});
