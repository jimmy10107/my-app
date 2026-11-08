import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GardenScene } from '../src/three/scene.js';

function sceneWithoutRenderer() {
  const scene = Object.create(GardenScene.prototype);
  Object.assign(scene, { entries: new Map(), _primed: true, _nextLaunchAt: 0,
    baseAngle: 0.4, focusedId: null, width: 1200, height: 800,
    _rig: { distance: 10, elevation: 0.4, targetY: 0.3 },
    _lookTarget: new THREE.Vector3(0, 0.3, 0), _lookDesired: new THREE.Vector3(),
    _cameraDesired: new THREE.Vector3(), _v: new THREE.Vector3(), _fwd: new THREE.Vector3(),
    _right: new THREE.Vector3(), camera: new THREE.PerspectiveCamera(36, 1.5, 0.1, 80),
    shadowUniforms: { uRight: { value: new THREE.Vector3() }, uCast: { value: new THREE.Vector3() } },
    backdrop: { setHorizon() {} }, overlay: { cancel() {} },
  });
  scene._placeCamera(10, 0.4, 0.3, 0.4);
  return scene;
}

test('歷史搜尋結果直接帶回場景，原本的新植株仍照常播放飛入動畫', () => {
  const scene = sceneWithoutRenderer();
  const modes = [];
  scene._addEntry = (row, options) => modes.push([row.id, options.mode]);
  scene.setEntries([{ id: 'old' }, { id: 'new' }], { existingIds: new Set(['old']) });
  assert.deepEqual(modes, [['old', 'existing'], ['new', 'fly']]);
});

test('定位特定紀錄使鏡頭靠近並置中，取消後回到整座花園', () => {
  const scene = sceneWithoutRenderer();
  const entry = { row: { id: 'mine' }, root: new THREE.Group(), height: 1.2, landed: true };
  entry.root.position.set(1.4, 0, -1.2);
  scene.entries.set('mine', entry);
  assert.equal(scene.focusEntry('mine'), true);
  for (let frame = 0; frame < 180; frame++) scene._updateCamera(frame / 60);
  assert.ok(scene._lookTarget.distanceTo(new THREE.Vector3(1.4, 0.6, -1.2)) < 0.01);
  assert.ok(scene.camera.position.distanceTo(scene._lookTarget) < 6);
  const point = scene._project(entry);
  assert.ok(Math.abs(point.x - 600) < 2);
  assert.ok(point.topY < point.y);
  assert.equal(scene.focusEntry(null), false);
  for (let frame = 180; frame < 360; frame++) scene._updateCamera(frame / 60);
  assert.ok(scene._lookTarget.distanceTo(new THREE.Vector3(0, 0.3, 0)) < 0.01);
  assert.ok(scene.camera.position.distanceTo(scene._lookTarget) > 9.9);
});

test('定位還在飛入的植物即時落地，只通知一次，不會重播到達動畫', () => {
  const scene = sceneWithoutRenderer();
  let landed = 0;
  let cancelled = 0;
  scene.onLanded = () => landed++;
  scene.overlay.cancel = () => cancelled++;
  const entry = { row: { id: 'flying' }, root: new THREE.Group(), height: 0.3,
    landed: false, launched: false, cycleSeconds: 200, appearAt: Date.now() + 10000 };
  scene.entries.set('flying', entry);
  scene.focusEntry('flying');
  scene.focusEntry('flying');
  assert.equal(landed, 1);
  assert.equal(cancelled, 1);
  assert.equal(entry.launched, true);
  assert.ok(entry.appearAt < Date.now());
  assert.equal(scene.focusEntry('missing'), false);
  assert.equal(scene.focusedId, null);
});
