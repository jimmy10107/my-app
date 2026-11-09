import test from 'node:test';
import assert from 'node:assert/strict';
import { plantById } from '../src/lib/plants.js';

test('甜根子草以復原韌性區別於構樹的生命力', () => {
  const miscanthus = plantById('miscanthus');
  const broussonetia = plantById('broussonetia');

  assert.equal(miscanthus.meaning, '韌性');
  assert.match(miscanthus.desc, /倒下後仍一次次重新站起的韌性/);
  assert.doesNotMatch(miscanthus.desc, /生命力/);
  assert.equal(broussonetia.meaning, '生命力');
});
