import test from 'node:test';
import assert from 'node:assert/strict';
import { linkedPlantingId, wallPathForPlanting } from '../src/lib/plantingLink.js';

test('完成頁的定位連結可還原同一筆種植紀錄，不以可能重複的暱稱定位', () => {
  const first = '11111111-1111-4111-8111-111111111111';
  const second = '22222222-2222-4222-8222-222222222222';
  for (const id of [first, second]) {
    const path = wallPathForPlanting(id);
    assert.ok(path.startsWith('/wall?'));
    assert.equal(linkedPlantingId(path.slice(path.indexOf('?'))), id);
  }
  assert.notEqual(wallPathForPlanting(first), wallPathForPlanting(second));
});

test('空白或無效編號不送入資料庫，也不破壞整座花園入口', () => {
  for (const id of [undefined, null, '', '皮皮', 'x&status=approved', '../admin']) {
    assert.equal(wallPathForPlanting(id), '/wall');
  }
  assert.equal(linkedPlantingId('?plant=not-a-uuid'), null);
  assert.equal(linkedPlantingId(''), null);
});
