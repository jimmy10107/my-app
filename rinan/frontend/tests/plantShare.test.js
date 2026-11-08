import test from 'node:test';
import assert from 'node:assert/strict';
import { plantById } from '../src/lib/plants.js';
import { canSharePlantPhoto, plantShareDetails, pngDataUrlToFile } from '../src/lib/plantShare.js';
import { CloseupScene } from '../src/three/closeupScene.js';

test('分享文字包含正確種植者、固定邀請文字與種植入口', () => {
  const data = plantShareDetails(plantById('taro'), '  皮皮  ', 'https://liff.line.me/example');
  assert.equal(data.name, '皮皮的芋頭');
  assert.equal(data.filename, '皮皮的芋頭-日南生根.png');
  assert.ok(data.text.includes('「皮皮的芋頭」'));
  assert.ok(data.text.includes('一起種下日南吧！'));
  assert.ok(data.text.endsWith('https://liff.line.me/example'));
  assert.ok(!plantShareDetails(plantById('rice'), 'A/B:?', 'https://example.test').filename.includes('/'));
});

test('照片轉換保留 PNG 位元內容及圖片 MIME，不會只分享連結', async () => {
  const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const file = pngDataUrlToFile(`data:image/png;base64,${bytes.toString('base64')}`, 'plant.png');
  assert.equal(file.name, 'plant.png');
  assert.equal(file.type, 'image/png');
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), bytes);
  assert.throws(() => pngDataUrlToFile('data:text/html;base64,AAAA', 'x.png'), /格式錯誤/);
});

test('確認裝置確實支援圖片附件，無法分享或權限拒絕時保留儲存流程', () => {
  const file = new File(['png'], 'plant.png', { type: 'image/png' });
  let received;
  assert.equal(canSharePlantPhoto(file, { share() {}, canShare: (data) => { received = data; return true; } }), true);
  assert.deepEqual(received.files, [file]);
  assert.equal(canSharePlantPhoto(file, {}), false);
  assert.equal(canSharePlantPhoto(file, { share() {}, canShare() { return false; } }), false);
  assert.equal(canSharePlantPhoto(file, { share() {}, canShare() { throw new Error('denied'); } }), false);
});

test('擷取特寫前先重繪 WebGL，再複製目前角度到獨立畫布', () => {
  const previousDocument = globalThis.document;
  const events = [];
  const output = { getContext: () => ({ drawImage: (source) => events.push(['copy', source]) }) };
  globalThis.document = { createElement: () => output };
  try {
    const scene = Object.create(CloseupScene.prototype);
    scene.canvas = { width: 800, height: 500 };
    scene.model = {};
    scene.renderer = { render: () => events.push(['render']) };
    assert.equal(scene.captureFrame(), output);
    assert.deepEqual(events, [['render'], ['copy', scene.canvas]]);
    assert.equal(output.width, 800);
    assert.equal(output.height, 500);
    scene._destroyed = true;
    assert.equal(scene.captureFrame(), null);
  } finally {
    globalThis.document = previousDocument;
  }
});
