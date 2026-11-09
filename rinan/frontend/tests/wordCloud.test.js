import test from 'node:test';
import assert from 'node:assert/strict';
import { extractTerms, buildCloud } from '../src/lib/wordCloud.js';
import { layoutCloud } from '../src/lib/wordCloudLayout.js';

test('自我介紹、虛詞與數量片段不會透過短句備援回到文字雲', () => {
  for (const message of ['我是', '我是舊', '大家一起', '我們都是', '這是一個', '一切都很好']) {
    assert.deepEqual(extractTerms(message), [], message);
  }
  assert.deepEqual(extractTerms('我是日南人'), ['日南人']);
});

test('地名、植物名與完整概念不拆成「日南稻」「站長出」等片段', () => {
  assert.deepEqual(extractTerms('日南稻站長出整片花園'), ['日南稻站', '花園']);
  assert.deepEqual(extractTerms('日南車站旁的舊鐵橋'), ['日南車站', '舊鐵橋']);
  assert.deepEqual(extractTerms('九降風吹著甜根子草'), ['九降風', '甜根子草']);
  for (const term of ['九降風', '甜根子草', '台灣欒樹', '人情味', '大甲芋頭', '日常生活']) {
    assert.deepEqual(extractTerms(term), [term]);
  }
  assert.deepEqual(extractTerms('日南，田好香'), ['日南', '田好香']);
  assert.deepEqual(extractTerms('火車站，回家的路'), ['火車站', '回家']);
});

test('同一則完整關鍵詞只算一次，保留新留言亮起及植物象徵詞', () => {
  const words = buildCloud([
    { id: 'a', plant_type: 'rice', message: '我是日南人，日南稻站日南稻站' },
    { id: 'b', plant_type: 'taro', message: '日南稻站' },
  ], { freshIds: new Set(['b']) });
  assert.equal(words.find((w) => w.term === '日南稻站').count, 2);
  assert.equal(words.find((w) => w.term === '日南稻站').fresh, true);
  assert.ok(!words.some((w) => ['我是', '日南稻', '站長出'].includes(w.term)));
  for (const term of ['守護', '耕作', '實踐', '日常', '韌性', '生命力']) assert.ok(words.some((w) => w.term === term));
});

test('沒有內建中文分詞時，仍保留完整地方詞並排除虛詞', async () => {
  const original = Intl.Segmenter;
  try {
    Intl.Segmenter = undefined;
    const { extractTerms: fallback } = await import('../src/lib/wordCloud.js?without-segmenter');
    assert.deepEqual(fallback('大家一起'), []);
    assert.deepEqual(fallback('我是日南人'), ['日南人']);
    assert.deepEqual(fallback('日南車站旁的舊鐵橋'), ['日南車站', '舊鐵橋']);
  } finally { Intl.Segmenter = original; }
});

test('投影文字全部留在天空帶，避開標題與搜尋按鈕且彼此不重疊', () => {
  const words = ['日南稻站', '日南車站', '家鄉', '人情味', '火車站', '生命力', '九降風', '舊鐵橋', '芋頭', '回家', '耕作', '守護']
    .map((term, i) => ({ term, weight: 4 - i * 0.2 }));
  for (const [width, height, titleWidth, titleHeight] of [[1700, 246, 600, 105], [920, 246, 450, 125]]) {
    const exclusions = [{ x0: 0, x1: titleWidth, y0: 0, y1: titleHeight }, { x0: width - 140, x1: width, y0: 0, y1: 50 }];
    const options = { exclusions, maxFontSize: 60, skyBand: true };
    const placed = layoutCloud(words, width, height, new Map(), options);
    assert.ok(placed.length >= 5);
    for (const p of placed) {
      const r = p.rect;
      assert.ok(r.x0 >= 0 && r.x1 <= width && r.y0 >= 0 && r.y1 <= height);
      const edge = Math.max(Math.abs((r.x0 - width / 2) / (width / 2)), Math.abs((r.x1 - width / 2) / (width / 2)));
      assert.ok(r.y0 >= height * 0.55 * edge ** 2);
      for (const other of [...exclusions, ...placed.filter((q) => q !== p).map((q) => q.rect)]) {
        assert.ok(!(r.x0 < other.x1 && r.x1 > other.x0 && r.y0 < other.y1 && r.y1 > other.y0));
      }
    }
    assert.deepEqual(layoutCloud(words, width, height, new Map(placed.map((p) => [p.term, p])), options)
      .map(({ term, x, y }) => ({ term, x, y })), placed.map(({ term, x, y }) => ({ term, x, y })));
  }
});
