import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { buildStage, disposeGroup } from './plantModels.js';
import { growthState } from './growth.js';
import { plantById } from '../lib/plants.js';
import { AmbientBackground } from './ambientBackground.js';

const GROUND_RADIUS = 2.6;
const PARTICLE_COUNT = 48;

function hashToUnit(id, salt = 0) {
  let hash = salt;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return (hash % 10000) / 10000;
}

function makeGroundTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.5);
  grad.addColorStop(0, '#26301f');
  grad.addColorStop(0.55, '#161d14');
  grad.addColorStop(1, '#0a0d0a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 900; i += 1) {
    ctx.fillStyle = Math.random() > 0.5 ? '#3a4a2c' : '#0a0a08';
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSpriteTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,220,160,0.9)');
  grad.addColorStop(1, 'rgba(255,220,160,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export class GardenScene {
  constructor(canvas, { onSelect } = {}) {
    this.canvas = canvas;
    this.onSelect = onSelect;
    this.entries = new Map();
    this.clock = new THREE.Clock();
    this.cameraAngle = Math.random() * Math.PI * 2;
    this._destroyed = false;

    this._initRenderer();
    this._initScene();
    this._initGround();
    this._initLights();
    this._initParticles();
    this._bindPointer();
  }

  _initRenderer() {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 50);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(new THREE.Scene(), this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.65, 0.55, 0.18);
    this.composer.addPass(this.bloom);
  }

  _initScene() {
    this.scene = new THREE.Scene();
    // 背景不用純色，改用會緩緩漂浮的展覽識別色（CIS）色塊＋粒子，畫在一張
    // canvas texture 上，避免整片死黑、也讓 Wall 頁呼應現場其他視覺色調。
    this.ambientBg = new AmbientBackground();
    this.scene.background = this.ambientBg.texture;
    this.scene.fog = new THREE.FogExp2('#12181d', 0.12);
    this.composer.passes[0].scene = this.scene;

    this.plantsRoot = new THREE.Group();
    this.scene.add(this.plantsRoot);
  }

  _initGround() {
    const geo = new THREE.CircleGeometry(GROUND_RADIUS, 48);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 1 });
    this.ground = new THREE.Mesh(geo, mat);
    this.scene.add(this.ground);
  }

  _initLights() {
    const hemi = new THREE.HemisphereLight('#3a4a3a', '#0a0806', 0.65);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight('#e3b873', 1.1);
    sun.position.set(2.2, 3, 1.4);
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight('#6f93a8', 0.35);
    rim.position.set(-2, 1.5, -2);
    this.scene.add(rim);
  }

  _initParticles() {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    this._particleSeed = [];
    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * GROUND_RADIUS;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = Math.random() * 1.6;
      positions[i * 3 + 2] = Math.sin(a) * r;
      this._particleSeed.push({ speed: 0.05 + Math.random() * 0.08, drift: Math.random() * Math.PI * 2, baseY: positions[i * 3 + 1] });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.045,
      map: makeSpriteTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.particles = new THREE.Points(geo, mat);
    this.scene.add(this.particles);
  }

  _bindPointer() {
    this.raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
    this._handleClick = (event) => {
      const rect = this.canvas.getBoundingClientRect();
      this._pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this._pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this._pointer, this.camera);
      const hits = this.raycaster.intersectObjects(this.plantsRoot.children, true);
      if (hits.length === 0) return;
      let obj = hits[0].object;
      while (obj && !obj.userData.entryId) obj = obj.parent;
      if (obj && this.onSelect) this.onSelect(obj.userData.entryId);
    };
    this.canvas.addEventListener('click', this._handleClick);
  }

  resize(width, height) {
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    // 相機距離／高度原本是照桌機／投影機的寬螢幕（16:10 上下）調的。手機直向螢幕
    // 又窄又高，同一組距離會讓畫面裡的植物顯得又小又稀疏，所以窄螢幕時把相機拉近一些。
    const aspect = width / height;
    const TUNED_ASPECT = 1.6;
    this._cameraScale = Math.min(1, Math.max(0.42, aspect / TUNED_ASPECT));

    this.ambientBg.resize(width, height);
  }

  _positionFor(id) {
    const a = hashToUnit(id, 1) * Math.PI * 2;
    const r = 0.35 + hashToUnit(id, 2) * (GROUND_RADIUS - 0.5);
    return { x: Math.cos(a) * r, z: Math.sin(a) * r };
  }

  setEntries(rows) {
    const seen = new Set();
    rows.forEach((row) => {
      seen.add(row.id);
      if (!this.entries.has(row.id)) this._addEntry(row);
    });
    Array.from(this.entries.keys()).forEach((id) => {
      if (!seen.has(id)) this._removeEntry(id);
    });
  }

  _addEntry(row) {
    const plant = plantById(row.plant_type);
    if (!plant) return;
    const pos = this._positionFor(row.id);
    const root = new THREE.Group();
    root.position.set(pos.x, 0, pos.z);
    root.userData.entryId = row.id;
    root.scale.setScalar(0.0001);

    const stageGroups = [0, 1, 2, 3].map((stage) => {
      const group = buildStage(row.plant_type, stage, plant.stageColors);
      group.visible = false;
      const materials = [];
      group.traverse((obj) => {
        if (obj.isMesh) materials.push(obj.material);
      });
      root.add(group);
      return { group, materials };
    });

    this.plantsRoot.add(root);
    this.entries.set(row.id, {
      row,
      root,
      stageGroups,
      createdAtMs: new Date(row.created_at).getTime(),
      cycleSeconds: plant.cycleSeconds,
    });
  }

  _removeEntry(id) {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.plantsRoot.remove(entry.root);
    entry.stageGroups.forEach(({ group }) => disposeGroup(group));
    this.entries.delete(id);
  }

  _updatePlants(nowMs) {
    this.entries.forEach((entry) => {
      const g = growthState(entry.cycleSeconds, entry.createdAtMs, nowMs);
      entry.root.scale.setScalar(Math.max(0.0001, g.scale));

      entry.stageGroups.forEach(({ group, materials }, stage) => {
        if (stage === g.formA) {
          group.visible = true;
          const op = (1 - g.formT) * g.opacity;
          materials.forEach((m) => { m.opacity = op; });
        } else if (stage === g.formB && g.formB !== g.formA) {
          group.visible = true;
          const op = g.formT * g.opacity;
          materials.forEach((m) => { m.opacity = op; });
        } else {
          group.visible = false;
        }
      });
    });
  }

  _updateParticles(elapsed) {
    const pos = this.particles.geometry.attributes.position;
    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      const seed = this._particleSeed[i];
      const y = (seed.baseY + elapsed * seed.speed) % 1.7;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  }

  _updateCamera(elapsed) {
    this.cameraAngle += 0.00035;
    const scale = this._cameraScale ?? 1;
    const radius = 3.6 * scale;
    const height = (2.05 + Math.sin(elapsed * 0.12) * 0.08) * Math.max(0.65, scale);
    this.camera.position.set(Math.cos(this.cameraAngle) * radius, height, Math.sin(this.cameraAngle) * radius);
    this.camera.lookAt(0, 0.35, 0);
  }

  start() {
    const loop = () => {
      if (this._destroyed) return;
      const elapsed = this.clock.getElapsedTime();
      this.ambientBg.update(elapsed * 1000);
      this._updateCamera(elapsed);
      this._updatePlants(Date.now());
      this._updateParticles(elapsed);
      this.composer.render();
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  dispose() {
    this._destroyed = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    this.canvas.removeEventListener('click', this._handleClick);
    this.entries.forEach((entry) => entry.stageGroups.forEach(({ group }) => disposeGroup(group)));
    this.ground.geometry.dispose();
    this.ground.material.map?.dispose();
    this.ground.material.dispose();
    this.particles.geometry.dispose();
    this.particles.material.map?.dispose();
    this.particles.material.dispose();
    this.ambientBg.dispose();
    this.renderer.dispose();
  }
}
