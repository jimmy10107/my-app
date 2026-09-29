import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { growthState } from './growth.js';
import { plantById } from '../lib/plants.js';
import { PLANT_SPRITES } from '../lib/plantSprites.js';
import { AmbientBackground } from './ambientBackground.js';

const GARDEN_RADIUS = 2.4; // 植株分布範圍
const GROUND_RADIUS = 5.2; // 地面比花園大，邊緣淡出融進背景，不會看到一顆硬邊的圓頂
const PARTICLE_COUNT = 48;
const ARRIVAL_MS = 9000; // 新種下的植株：光環＋名字標籤顯示多久

const ORANGE = '#D99531';
const PAPER = '#F6F2E8';

// 真實植株從 20cm 秧苗到 8m 的木麻黃都有，直接照比例放上牆，大樹會把整座花園蓋掉；
// 用平方根壓縮高度差，保留「誰比較高」的相對感，但每一株都看得到。
function gardenHeight(realHeight) {
  return 0.4 * Math.sqrt(realHeight);
}

// FNV-1a＋最後一次混合：只差一個字元的 id 也會落在完全不同的位置（舊的 *31 雜湊會讓
// 相近 id 擠在同一點）。
function hashToUnit(id, salt = 0) {
  let h = (2166136261 ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGroundTexture() {
  return canvasTexture(1024, (ctx, size) => {
    const c = size / 2;
    const soil = ctx.createRadialGradient(c, c, 0, c, c, c);
    soil.addColorStop(0, 'rgba(62,52,38,1)');
    soil.addColorStop(0.35, 'rgba(46,39,29,0.95)');
    soil.addColorStop(0.6, 'rgba(35,31,26,0.6)');
    soil.addColorStop(1, 'rgba(35,31,26,0)');
    ctx.fillStyle = soil;
    ctx.fillRect(0, 0, size, size);

    // 土壤顆粒
    for (let i = 0; i < 5000; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * c * 0.62;
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(110,92,64,0.12)' : 'rgba(10,8,6,0.18)';
      ctx.fillRect(c + Math.cos(a) * r, c + Math.sin(a) * r, 2, 2);
    }

    // 呼應 CIS 導覽地圖：一條海線藍路徑穿過花園，站點用橙色圓點
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(69,108,144,0.38)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= size; x += 8) {
      const y = c + Math.sin((x / size) * Math.PI * 1.6 + 0.4) * size * 0.12;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    [0.3, 0.52, 0.74].forEach((fx) => {
      const x = fx * size;
      const y = c + Math.sin(fx * Math.PI * 1.6 + 0.4) * size * 0.12;
      ctx.fillStyle = 'rgba(217,149,49,0.85)';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // 外緣再蓋一層漸層，讓整塊地的邊界完全消失在背景裡
    const fade = ctx.createRadialGradient(c, c, c * 0.45, c, c, c);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';
  });
}

function makeShadowTexture() {
  return canvasTexture(128, (ctx, size) => {
    const c = size / 2;
    const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
    grad.addColorStop(0, 'rgba(0,0,0,0.6)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0.25)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  });
}

function makeGlowTexture() {
  return canvasTexture(64, (ctx, size) => {
    const c = size / 2;
    const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
    grad.addColorStop(0, 'rgba(246,232,200,0.9)');
    grad.addColorStop(1, 'rgba(246,232,200,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  });
}

function makeLabelTexture(name, plantName) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const text = `${name}．種下了${plantName}`;
  ctx.font = '600 44px "Noto Sans TC", sans-serif';
  const w = Math.min(492, ctx.measureText(text).width + 64);
  const x = (512 - w) / 2;
  ctx.fillStyle = 'rgba(21,17,13,0.82)';
  ctx.beginPath();
  ctx.roundRect(x, 24, w, 80, 40);
  ctx.fill();
  ctx.strokeStyle = ORANGE;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = PAPER;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 66, 460);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export class GardenScene {
  constructor(canvas, { onSelect } = {}) {
    this.canvas = canvas;
    this.onSelect = onSelect;
    this.entries = new Map();
    this.clock = new THREE.Clock();
    this.baseAngle = Math.random() * Math.PI * 2;
    this.textures = new Map();
    this._hasInitialRows = false;
    this._destroyed = false;

    this._initRenderer();
    this._initScene();
    this._initGround();
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

    this.camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 60);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(new THREE.Scene(), this.camera));
    // 門檻拉高：只讓真正的亮點（橙色站點、光環、粒子）發光，植株本身不要糊成一團光暈。
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.6, 0.62);
    this.composer.addPass(this.bloom);
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.ambientBg = new AmbientBackground();
    this.scene.background = this.ambientBg.texture;
    this.scene.fog = new THREE.FogExp2('#231f1a', 0.07);
    this.composer.passes[0].scene = this.scene;

    this.plantsRoot = new THREE.Group();
    this.scene.add(this.plantsRoot);

    this.shadowTexture = makeShadowTexture();
    this.shadowGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.ringGeometry = new THREE.RingGeometry(0.86, 1, 64).rotateX(-Math.PI / 2);
  }

  _initGround() {
    const geo = new THREE.CircleGeometry(GROUND_RADIUS, 96);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ map: makeGroundTexture(), transparent: true, depthWrite: false });
    this.ground = new THREE.Mesh(geo, mat);
    this.ground.renderOrder = 0;
    this.scene.add(this.ground);
  }

  _initParticles() {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    this._particleSeed = [];
    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * GARDEN_RADIUS * 1.2;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = Math.random() * 1.6;
      positions[i * 3 + 2] = Math.sin(a) * r;
      this._particleSeed.push({ speed: 0.04 + Math.random() * 0.06, baseY: positions[i * 3 + 1] });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.04,
      map: makeGlowTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.particles = new THREE.Points(geo, mat);
    this.particles.renderOrder = 4;
    this.scene.add(this.particles);
  }

  _pick(event) {
    const rect = this.canvas.getBoundingClientRect();
    this._pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this._pointer, this.camera);
    const sprites = [];
    this.entries.forEach((entry) => entry.stages.forEach((s) => s.sprite.visible && sprites.push(s.sprite)));
    const hits = this.raycaster.intersectObjects(sprites, false);
    if (hits.length === 0) return null;
    // 在多張重疊的 sprite 中，挑基部最靠近點擊位置的那株，避免大樹透明的外框搶走點擊。
    let best = hits[0];
    let bestDist = Infinity;
    hits.forEach((hit) => {
      const base = hit.object.parent.position;
      const d = hit.point.distanceTo(new THREE.Vector3(base.x, hit.point.y, base.z));
      if (d < bestDist) {
        bestDist = d;
        best = hit;
      }
    });
    return best.object.parent.userData.entryId;
  }

  _bindPointer() {
    this.raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
    this._handleClick = (event) => {
      const id = this._pick(event);
      if (id && this.onSelect) this.onSelect(id);
    };
    this._handleMove = (event) => {
      this.canvas.style.cursor = this._pick(event) ? 'pointer' : '';
    };
    this.canvas.addEventListener('click', this._handleClick);
    this.canvas.addEventListener('pointermove', this._handleMove);
  }

  resize(width, height) {
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    const aspect = width / height;
    this.camera.aspect = aspect;

    // 依畫面比例重新取景：寬螢幕／投影機用較低仰角看整座花園；手機直向螢幕改成
    // 較高的俯角＋較廣的垂直視角，只框住花園中段（兩側自然淡出），讓植株夠大、不被裁切。
    const k = Math.min(1, Math.max(0, (1.5 - aspect) / 1.0));
    this.camera.fov = lerp(38, 56, k);
    this.camera.updateProjectionMatrix();

    const elevation = THREE.MathUtils.degToRad(lerp(24, 44, k));
    const halfV = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const halfH = Math.atan(Math.tan(halfV) * aspect);
    const fitRadius = (GARDEN_RADIUS + 0.2) * lerp(1, 0.55, k);
    const distH = fitRadius / Math.tan(halfH);
    const distV = (GARDEN_RADIUS * Math.sin(elevation) + 0.9 * Math.cos(elevation) * 0.6) / Math.tan(halfV);
    // 靠近鏡頭的那一側植株因透視會被放大、往畫面下緣掉，寬螢幕多退一點避免被裁掉。
    this._cameraRig = {
      distance: Math.max(distH, distV) * lerp(1.24, 1.0, k),
      elevation,
      targetY: lerp(0.1, 0.5, k),
    };

    this.ambientBg.resize(width, height);
  }

  _positionFor(id) {
    const a = hashToUnit(id, 1) * Math.PI * 2;
    const r = 0.25 + Math.sqrt(hashToUnit(id, 2)) * (GARDEN_RADIUS - 0.25);
    return { x: Math.cos(a) * r, z: Math.sin(a) * r };
  }

  _texture(url) {
    let record = this.textures.get(url);
    if (!record) {
      record = { ready: false, texture: null };
      record.texture = new THREE.TextureLoader().load(url, () => {
        record.ready = true;
      });
      record.texture.colorSpace = THREE.SRGBColorSpace;
      this.textures.set(url, record);
    }
    return record;
  }

  setEntries(rows) {
    const seen = new Set();
    rows.forEach((row) => {
      seen.add(row.id);
      if (!this.entries.has(row.id)) this._addEntry(row, this._hasInitialRows);
    });
    Array.from(this.entries.keys()).forEach((id) => {
      if (!seen.has(id)) this._removeEntry(id);
    });
    if (rows.length > 0) this._hasInitialRows = true;
  }

  _addEntry(row, isNewArrival) {
    const plant = plantById(row.plant_type);
    const spriteDefs = PLANT_SPRITES[row.plant_type];
    if (!plant || !spriteDefs) return;
    const pos = this._positionFor(row.id);
    const root = new THREE.Group();
    root.position.set(pos.x, 0, pos.z);
    root.userData.entryId = row.id;

    const stages = spriteDefs.map((def) => {
      const record = this._texture(def.file);
      const material = new THREE.SpriteMaterial({
        map: record.texture,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      });
      const sprite = new THREE.Sprite(material);
      const k = gardenHeight(def.size[1]) / def.size[1];
      sprite.scale.set(def.size[0] * k, def.size[1] * k, 1);
      sprite.center.set(def.anchor[0], def.anchor[1]);
      sprite.renderOrder = 2;
      sprite.visible = false;
      root.add(sprite);
      return { sprite, material, record, width: def.size[0] * k };
    });

    const shadowMaterial = new THREE.MeshBasicMaterial({
      map: this.shadowTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0,
    });
    const shadow = new THREE.Mesh(this.shadowGeometry, shadowMaterial);
    shadow.position.y = 0.002;
    shadow.renderOrder = 1;
    root.add(shadow);

    const entry = {
      row,
      root,
      stages,
      shadow,
      phase: hashToUnit(row.id, 3) * Math.PI * 2,
      createdAtMs: new Date(row.created_at).getTime(),
      cycleSeconds: plant.cycleSeconds,
    };

    if (isNewArrival) {
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: ORANGE,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const ring = new THREE.Mesh(this.ringGeometry, ringMaterial);
      ring.position.y = 0.004;
      ring.renderOrder = 3;
      root.add(ring);

      const labelTexture = makeLabelTexture(row.display_name || '有人', plant.name);
      const label = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthWrite: false, toneMapped: false })
      );
      label.scale.set(1.15, 0.29, 1);
      label.center.set(0.5, 0);
      label.renderOrder = 5;
      root.add(label);
      entry.arrival = { startedAt: performance.now(), ring, label, labelTexture };
    }

    this.plantsRoot.add(root);
    this.entries.set(row.id, entry);
  }

  _removeArrival(entry) {
    const { ring, label, labelTexture } = entry.arrival;
    entry.root.remove(ring);
    entry.root.remove(label);
    ring.material.dispose();
    label.material.dispose();
    labelTexture.dispose();
    entry.arrival = null;
  }

  _removeEntry(id) {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.plantsRoot.remove(entry.root);
    entry.stages.forEach((s) => s.material.dispose());
    entry.shadow.material.dispose();
    if (entry.arrival) this._removeArrival(entry);
    this.entries.delete(id);
  }

  _updatePlants(nowMs, elapsed) {
    const perfNow = performance.now();
    this.entries.forEach((entry) => {
      const g = growthState(entry.cycleSeconds, entry.createdAtMs, nowMs);
      // 各階段圖本身就一階比一階大，root 只做輕微的縮放，避免幼苗小到看不見。
      entry.root.scale.setScalar(0.4 + 0.6 * g.scale);
      const sway = Math.sin(elapsed * 0.7 + entry.phase) * 0.025 + Math.sin(elapsed * 1.9 + entry.phase) * 0.008;

      let shadowWidth = 0;
      entry.stages.forEach((s, stage) => {
        let op = 0;
        if (stage === g.formA) op = (g.formB !== g.formA ? 1 - g.formT : 1) * g.opacity;
        else if (stage === g.formB) op = g.formT * g.opacity;
        s.sprite.visible = op > 0.004 && s.record.ready;
        s.material.opacity = op;
        s.material.rotation = sway;
        shadowWidth += s.width * op;
      });

      const shadowSize = Math.max(0.12, shadowWidth * 0.75);
      entry.shadow.scale.set(shadowSize, 1, shadowSize * 0.8);
      entry.shadow.material.opacity = Math.min(1, g.opacity * 1.1);

      if (entry.arrival) {
        const t = (perfNow - entry.arrival.startedAt) / ARRIVAL_MS;
        if (t >= 1) {
          this._removeArrival(entry);
        } else {
          const pulse = (t * 3) % 1;
          const ringScale = (0.15 + pulse * 0.55) / entry.root.scale.x;
          entry.arrival.ring.scale.set(ringScale, 1, ringScale);
          entry.arrival.ring.material.opacity = (1 - pulse) * 0.9 * (1 - t);
          const fadeIn = Math.min(1, t * 8);
          const fadeOut = Math.min(1, (1 - t) * 5);
          entry.arrival.label.material.opacity = fadeIn * fadeOut;
          entry.arrival.label.position.y = (0.55 + t * 0.12) / entry.root.scale.x;
          entry.arrival.label.scale.set(1.15 / entry.root.scale.x, 0.29 / entry.root.scale.x, 1);
        }
      }
    });
  }

  _updateParticles(elapsed) {
    const pos = this.particles.geometry.attributes.position;
    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      const seed = this._particleSeed[i];
      pos.setY(i, (seed.baseY + elapsed * seed.speed) % 1.7);
    }
    pos.needsUpdate = true;
  }

  _updateCamera(elapsed) {
    const rig = this._cameraRig;
    if (!rig) return;
    const angle = this.baseAngle + elapsed * 0.02;
    const elevation = rig.elevation + Math.sin(elapsed * 0.11) * 0.015;
    const flat = Math.cos(elevation) * rig.distance;
    this.camera.position.set(
      Math.cos(angle) * flat,
      rig.targetY + Math.sin(elevation) * rig.distance,
      Math.sin(angle) * flat
    );
    this.camera.lookAt(0, rig.targetY, 0);
  }

  start() {
    const loop = () => {
      if (this._destroyed) return;
      const elapsed = this.clock.getElapsedTime();
      this.ambientBg.update(elapsed * 1000);
      this._updateCamera(elapsed);
      this._updatePlants(Date.now(), elapsed);
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
    this.canvas.removeEventListener('pointermove', this._handleMove);
    Array.from(this.entries.keys()).forEach((id) => this._removeEntry(id));
    this.textures.forEach((record) => record.texture.dispose());
    this.shadowTexture.dispose();
    this.shadowGeometry.dispose();
    this.ringGeometry.dispose();
    this.ground.geometry.dispose();
    this.ground.material.map.dispose();
    this.ground.material.dispose();
    this.particles.geometry.dispose();
    this.particles.material.map.dispose();
    this.particles.material.dispose();
    this.ambientBg.dispose();
    this.renderer.dispose();
  }
}
