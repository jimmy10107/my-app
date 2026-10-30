import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { growthState } from './growth.js';
import { plantById } from '../lib/plants.js';
import { PLANT_SPRITES } from '../lib/plantSprites.js';
import { Backdrop } from './backdrop.js';
import { ArrivalOverlay, GO_MS } from './arrivalOverlay.js';

const GARDEN_RADIUS = 2.4; // 植株分布範圍
const GROUND_RADIUS = 5.2; // 地面比花園大，邊緣淡出融進遠景，不會看到一顆硬邊的圓頂
const FIREFLY_COUNT = 72;
const SHADOW_LAYER = 1; // 影子只畫進影子貼圖，不直接出現在主畫面
const SEEDLING_FRACTION = 0.12; // growth.js 第一階段的長度：新到的植株直接從完整的幼苗開始
const POP_MS = 1500; // 落地「冒出來」的彈跳時間
const RING_MS = 2600;
const MAX_FLYING = 8; // 同時最多幾株走飛入動畫；斷線很久一次補進很多筆時，其餘直接冒出來
const LAUNCH_GAP_MS = 900; // 同一批進來的植株錯開起飛

const ORANGE = '#D99531';

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

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeOutBack(t) {
  const c = 1.9;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
}

function makeGroundTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size / 2;

  // 中央像被站點的暖光照著，往外漸暗，視線自然落在花園中間
  const soil = ctx.createRadialGradient(c, c, 0, c, c, c);
  soil.addColorStop(0, 'rgba(92,76,54,1)');
  soil.addColorStop(0.3, 'rgba(70,58,42,1)');
  soil.addColorStop(0.55, 'rgba(52,44,34,0.85)');
  soil.addColorStop(1, 'rgba(40,34,27,0)');
  ctx.fillStyle = soil;
  ctx.fillRect(0, 0, size, size);

  // 土壤顆粒（固定亂數種子，每次重整長得一樣）
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 7000; i += 1) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * c * 0.66;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(140,118,84,0.13)' : 'rgba(20,15,10,0.2)';
    ctx.fillRect(c + Math.cos(a) * r, c + Math.sin(a) * r, 2, 2);
  }

  // 呼應 CIS 導覽地圖：一條海線藍路徑穿過花園，站點用橙色圓點
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(96,140,180,0.42)';
  ctx.lineWidth = 2.4;
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
    ctx.fillStyle = 'rgba(217,149,49,0.9)';
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // 外緣再蓋一層漸層，讓整塊地的邊界完全消失在遠景裡
  const fade = ctx.createRadialGradient(c, c, c * 0.42, c, c, c);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ---------------------------------------------------------------------------
// 影子：每株植物用自己的剪影投一道斜斜的影子到地上（光從右前上方來，影子往左後方倒），
// 再加一圈貼地的接觸陰影。所有影子先用「取最大值」疊進一張半解析度的影子貼圖，
// 地面再整片乘上去——重疊的影子不會越疊越黑，半解析度也剛好讓邊緣柔和。
// ---------------------------------------------------------------------------
const SHADOW_BLENDING = {
  transparent: true,
  depthTest: false,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendEquation: THREE.MaxEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
};

const castShadowVertex = /* glsl */ `
  uniform vec2 uAnchor;
  uniform vec2 uSize;
  uniform float uRotation;
  uniform vec3 uRight;
  uniform vec3 uCast;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec2 p = (uv - uAnchor) * uSize;
    float c = cos(uRotation);
    float s = sin(uRotation);
    p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    vec3 local = uRight * p.x + uCast * max(p.y, 0.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(local, 1.0);
  }
`;

const castShadowFragment = /* glsl */ `
  uniform sampler2D map;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    // 離根部越遠越淡、越糊，像真的影子一樣
    float lift = smoothstep(0.0, 1.0, vUv.y);
    float a = texture2D(map, vUv, lift * 3.0).a;
    float v = a * uOpacity * (1.0 - lift * 0.6);
    gl_FragColor = vec4(v, v, v, 1.0);
  }
`;

const blobShadowVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const blobShadowFragment = /* glsl */ `
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float v = pow(1.0 - smoothstep(0.0, 1.0, d), 1.7) * uOpacity;
    gl_FragColor = vec4(v, v, v, 1.0);
  }
`;

const groundVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec4 vClip;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    vClip = gl_Position;
    #include <fog_vertex>
  }
`;

const groundFragment = /* glsl */ `
  uniform sampler2D map;
  uniform sampler2D shadowMap;
  uniform vec3 uShadowTint;
  uniform vec3 uPoolColor;
  varying vec2 vUv;
  varying vec4 vClip;
  #include <fog_pars_fragment>
  void main() {
    vec4 soil = texture2D(map, vUv);
    // 花園中央一圈暖光（像站點的燈），往外自然暗下去
    float r = length(vUv - 0.5) * 2.0;
    vec3 col = soil.rgb * (1.0 + uPoolColor * exp(-r * r * 16.0));
    float s = texture2D(shadowMap, vClip.xy / vClip.w * 0.5 + 0.5).r;
    gl_FragColor = vec4(col * mix(vec3(1.0), uShadowTint, clamp(s, 0.0, 1.0)), soil.a);
    #include <fog_fragment>
  }
`;

// 螢火蟲：貼著植株高度慢慢繞、忽明忽暗；核心亮度超過 1，交給 bloom 暈開
const fireflyVertex = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime;
  uniform float uScale;
  uniform float uRadius;
  varying float vGlow;
  void main() {
    float t = uTime * (0.12 + aSeed.x * 0.16) + aSeed.w * 6.2831;
    float ang = aSeed.x * 6.2831 + t * 0.35;
    float r = (0.25 + sqrt(aSeed.y) * 0.9) * uRadius;
    vec3 p = vec3(cos(ang) * r, 0.12 + aSeed.z * 1.05, sin(ang) * r);
    p += vec3(sin(t * 1.7), sin(t * 1.1 + 1.7) * 0.6, cos(t * 1.3)) * 0.16;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float blink = 0.5 + 0.5 * sin(uTime * (0.7 + aSeed.y * 1.1) + aSeed.w * 20.0);
    vGlow = smoothstep(0.1, 1.0, blink);
    gl_PointSize = uScale * (0.55 + 0.45 * vGlow) / -mv.z;
  }
`;

const fireflyFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vGlow;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float halo = pow(max(0.0, 1.0 - d), 2.2);
    float core = smoothstep(0.32, 0.0, d);
    gl_FragColor = vec4(uColor * (halo * 0.8 + core * 2.4) * vGlow, 1.0);
  }
`;

// 最後一道：暗角＋轉成螢幕色彩空間＋極輕微的顆粒（投影機上暗部漸層才不會一圈一圈的色階）
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAspect: { value: 16 / 9 },
    uVignette: { value: 0.32 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAspect;
    uniform float uVignette;
    varying vec2 vUv;
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
      float v = smoothstep(1.15, 0.25, length(q) / sqrt(uAspect * uAspect + 1.0) * 2.0);
      c *= mix(1.0 - uVignette, 1.0, v);
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
      gl_FragColor.rgb += (hash(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0;
    }
  `,
};

export class GardenScene {
  /**
   * @param {HTMLCanvasElement} canvas WebGL 畫布
   * @param {object} options
   * @param {HTMLCanvasElement} options.overlay 疊在上面的 2D 畫布（飛入動畫、名字標籤）
   * @param {(id: string) => void} [options.onSelect] 點了某一株
   * @param {(row: object) => void} [options.onLaunch] 新的一株從 QR 卡片起飛
   * @param {(row: object) => void} [options.onLanded] 新的一株落地發芽
   */
  constructor(canvas, { overlay, onSelect, onLaunch, onLanded } = {}) {
    this.canvas = canvas;
    this.onSelect = onSelect;
    this.onLaunch = onLaunch;
    this.onLanded = onLanded;
    this.entries = new Map();
    this.clock = new THREE.Clock();
    this.baseAngle = Math.random() * Math.PI * 2;
    this.textures = new Map();
    this.width = 1;
    this.height = 1;
    this._primed = false;
    this._nextLaunchAt = 0;
    this._origin = { x: 0, y: 0 };
    this._destroyed = false;
    this._v = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();

    this.overlay = new ArrivalOverlay(overlay);
    this._initRenderer();
    this._initScene();
    this._initGround();
    this._initFireflies();
    this._bindPointer();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(1, 1, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 80);
    this.scene = new THREE.Scene();

    // 全程在線性空間合成：先畫場景、再 bloom，最後一道才轉 sRGB。
    // （舊版 bloom 直接疊在已經轉成 sRGB 的畫面上，光暈的亮度跟顏色都會偏掉。）
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.55, 0.86);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);

    this.shadowTarget = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  }

  _initScene() {
    this.backdrop = new Backdrop();
    this.scene.add(this.backdrop.mesh);
    // 霧色跟遠景地平線的薄霧同一個色調，後排的植株會自然退到霧裡，前後層次拉開
    this.scene.fog = new THREE.Fog('#77766b', 10, 30);

    this.plantsRoot = new THREE.Group();
    this.scene.add(this.plantsRoot);

    this.unitPlane = new THREE.PlaneGeometry(1, 1);
    this.groundPlane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.ringGeometry = new THREE.RingGeometry(0.88, 1, 72).rotateX(-Math.PI / 2);

    this.shadowUniforms = {
      uRight: { value: new THREE.Vector3(1, 0, 0) },
      uCast: { value: new THREE.Vector3(-0.5, 0, -0.5) },
    };
  }

  _initGround() {
    const geo = new THREE.CircleGeometry(GROUND_RADIUS, 96);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      vertexShader: groundVertex,
      fragmentShader: groundFragment,
      transparent: true,
      depthWrite: false,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          map: { value: null },
          shadowMap: { value: null },
          uShadowTint: { value: new THREE.Color('#333c4c') },
          uPoolColor: { value: new THREE.Vector3(0.75, 0.55, 0.3) },
        },
      ]),
    });
    mat.uniforms.map.value = makeGroundTexture();
    mat.uniforms.shadowMap.value = this.shadowTarget.texture;
    this.ground = new THREE.Mesh(geo, mat);
    this.ground.renderOrder = 0;
    this.scene.add(this.ground);
  }

  _initFireflies() {
    const seeds = new Float32Array(FIREFLY_COUNT * 4);
    for (let i = 0; i < seeds.length; i += 1) seeds[i] = Math.random();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FIREFLY_COUNT * 3), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    const mat = new THREE.ShaderMaterial({
      vertexShader: fireflyVertex,
      fragmentShader: fireflyFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: 60 },
        uRadius: { value: GARDEN_RADIUS * 1.05 },
        uColor: { value: new THREE.Color('#ffc978') },
      },
    });
    this.fireflies = new THREE.Points(geo, mat);
    this.fireflies.frustumCulled = false;
    this.fireflies.renderOrder = 6;
    this.scene.add(this.fireflies);
  }

  _pick(event) {
    const rect = this.canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(pointer, this.camera);
    const sprites = [];
    this.entries.forEach((entry) => entry.stages.forEach((s) => s.sprite.visible && sprites.push(s.sprite)));
    const hits = this.raycaster.intersectObjects(sprites, false);
    if (hits.length === 0) return null;
    // 在多張重疊的 sprite 中，挑基部最靠近點擊位置的那株，避免大樹透明的外框搶走點擊。
    let best = hits[0];
    let bestDist = Infinity;
    hits.forEach((hit) => {
      const base = hit.object.parent.position;
      const d = Math.hypot(hit.point.x - base.x, hit.point.z - base.z);
      if (d < bestDist) {
        bestDist = d;
        best = hit;
      }
    });
    return best.object.parent.userData.entryId;
  }

  _bindPointer() {
    this.raycaster = new THREE.Raycaster();
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

  // 飛入動畫的起點（QR 卡片），座標是相對於畫布左上角的 CSS 像素
  setArrivalOrigin(x, y) {
    this._origin = { x, y };
  }

  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setSize(this.width, this.height, false);
    this.composer.setSize(this.width, this.height);
    const buffer = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.shadowTarget.setSize(Math.ceil(buffer.x / 2), Math.ceil(buffer.y / 2));
    this.grade.uniforms.uAspect.value = this.width / this.height;
    this.backdrop.resize(this.width, this.height);
    this.overlay.resize(this.width, this.height);
    this.fireflies.material.uniforms.uScale.value = buffer.y * 0.09;
    this._frame();
  }

  // 取景：花園中心壓在畫面中線以下，上方留給天空跟文字雲。
  // 用 setViewOffset 平移畫面（透視不變），再用二分搜尋找出剛好不會被裁到的距離。
  _frame() {
    const aspect = this.width / this.height;
    const k = Math.min(1, Math.max(0, (1.5 - aspect) / 1.0)); // 0 = 寬螢幕／投影，1 = 手機直向
    const cam = this.camera;
    cam.aspect = aspect;
    cam.fov = lerp(34, 52, k);
    const shiftDown = lerp(0.1, 0.08, k) * this.height;
    // 寬螢幕往左挪一點，右下角的參加卡比較不會擋到前排植株
    const shiftLeft = lerp(0.05, 0, k) * this.width;
    cam.setViewOffset(this.width, this.height, shiftLeft, -shiftDown, this.width, this.height);
    cam.updateProjectionMatrix();

    const elevation = THREE.MathUtils.degToRad(lerp(23, 36, k));
    const targetY = lerp(0.22, 0.42, k);
    const sideRadius = (GARDEN_RADIUS + 0.35) * lerp(1, 0.62, k);
    // 前排植株的根可以壓到底部留言條後面一點點（植株本身是往上長的）；
    // 手機版底部還有一條參加按鈕，要多留空間
    const frontRadius = GARDEN_RADIUS + 0.05;
    const bottomLimit = lerp(-0.9, -0.68, k);

    const fits = (distance) => {
      this._placeCamera(distance, elevation, targetY, 0);
      for (let i = 0; i < 24; i += 1) {
        const a = (i / 24) * Math.PI * 2;
        const side = this._v.set(Math.cos(a) * sideRadius, 0, Math.sin(a) * sideRadius).project(cam);
        if (Math.abs(side.x) > 0.95) return false;
        const front = this._v.set(Math.cos(a) * frontRadius, 0, Math.sin(a) * frontRadius).project(cam);
        if (front.y < bottomLimit) return false;
      }
      return true;
    };
    let lo = 2;
    let hi = 40;
    for (let i = 0; i < 26; i += 1) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    this._rig = { distance: hi, elevation, targetY };
    this.scene.fog.near = hi - 1.5;
    this.scene.fog.far = hi + 36;
    this.overlay.flatten = Math.sin(elevation) * 1.05;
  }

  _placeCamera(distance, elevation, targetY, angle) {
    const flat = Math.cos(elevation) * distance;
    this.camera.position.set(Math.cos(angle) * flat, targetY + Math.sin(elevation) * distance, Math.sin(angle) * flat);
    this.camera.lookAt(0, targetY, 0);
    this.camera.updateMatrixWorld();
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

  /**
   * 同步牆上的植株。第一次呼叫是開機時已經在牆上的那批（直接長好）；
   * 之後才出現的 id 都當成剛種下的：從 QR 卡片飛進來、落地發芽。
   */
  setEntries(rows) {
    const now = Date.now();
    const seen = new Set();
    let flying = 0;
    this.entries.forEach((entry) => {
      if (entry.launchAt !== null && now < entry.appearAt) flying += 1;
    });

    rows.forEach((row) => {
      seen.add(row.id);
      if (this.entries.has(row.id)) return;
      if (!this._primed) {
        this._addEntry(row, { mode: 'existing', now });
      } else if (flying < MAX_FLYING) {
        const launchAt = Math.max(now, this._nextLaunchAt);
        this._nextLaunchAt = launchAt + LAUNCH_GAP_MS;
        flying += 1;
        this._addEntry(row, { mode: 'fly', now, launchAt });
      } else {
        this._addEntry(row, { mode: 'pop', now });
      }
    });

    Array.from(this.entries.keys()).forEach((id) => {
      if (!seen.has(id)) this._removeEntry(id);
    });
    this._primed = true;
  }

  _addEntry(row, { mode, now, launchAt = null }) {
    const plant = plantById(row.plant_type);
    const spriteDefs = PLANT_SPRITES[row.plant_type];
    if (!plant || !spriteDefs) return;
    const pos = this._positionFor(row.id);
    const root = new THREE.Group();
    root.position.set(pos.x, 0, pos.z);
    root.userData.entryId = row.id;

    // 越靠近花園中央越亮（像站點的燈照著），外圈稍暗，畫面自然有景深
    const radial = Math.hypot(pos.x, pos.z) / GARDEN_RADIUS;
    const tint = new THREE.Color(1, 0.985, 0.95).multiplyScalar(lerp(1.04, 0.84, radial * radial));

    const stages = spriteDefs.map((def) => {
      const record = this._texture(def.file);
      const k = gardenHeight(def.size[1]) / def.size[1];
      const width = def.size[0] * k;
      const height = def.size[1] * k;

      const material = new THREE.SpriteMaterial({
        map: record.texture,
        color: tint,
        transparent: true,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(width, height, 1);
      sprite.center.set(def.anchor[0], def.anchor[1]);
      sprite.renderOrder = 2;
      sprite.visible = false;
      root.add(sprite);

      const shadowMaterial = new THREE.ShaderMaterial({
        vertexShader: castShadowVertex,
        fragmentShader: castShadowFragment,
        ...SHADOW_BLENDING,
        uniforms: {
          map: { value: record.texture },
          uAnchor: { value: new THREE.Vector2(def.anchor[0], def.anchor[1]) },
          uSize: { value: new THREE.Vector2(width, height) },
          uRotation: { value: 0 },
          uOpacity: { value: 0 },
          uRight: this.shadowUniforms.uRight,
          uCast: this.shadowUniforms.uCast,
        },
      });
      const shadow = new THREE.Mesh(this.unitPlane, shadowMaterial);
      shadow.layers.set(SHADOW_LAYER);
      shadow.frustumCulled = false;
      shadow.visible = false;
      root.add(shadow);

      return { sprite, material, shadow, shadowMaterial, record, width, height };
    });

    const blobMaterial = new THREE.ShaderMaterial({
      vertexShader: blobShadowVertex,
      fragmentShader: blobShadowFragment,
      ...SHADOW_BLENDING,
      uniforms: { uOpacity: { value: 0 } },
    });
    const blob = new THREE.Mesh(this.groundPlane, blobMaterial);
    blob.layers.set(SHADOW_LAYER);
    root.add(blob);

    const fresh = mode !== 'existing';
    const appearAt = mode === 'fly' ? launchAt + GO_MS : mode === 'pop' ? now : -Infinity;
    const cycleMs = plant.cycleSeconds * 1000;
    const entry = {
      row,
      plant,
      root,
      stages,
      blob,
      phase: hashToUnit(row.id, 3) * Math.PI * 2,
      cycleSeconds: plant.cycleSeconds,
      // 剛種下的：從落地那一刻起算，而且直接是完整的幼苗（不用等十幾秒慢慢淡入）；
      // 時間用這台電腦自己的時鐘，不受牆面電腦跟資料庫時間差影響。
      createdAtMs: fresh ? appearAt - SEEDLING_FRACTION * cycleMs : new Date(row.created_at).getTime(),
      launchAt: mode === 'fly' ? launchAt : null,
      appearAt,
      launched: mode !== 'fly',
      landed: !fresh,
      height: 0.3,
    };

    if (fresh) {
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(ORANGE).multiplyScalar(3),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      // 光環掛在不縮放的花園層，不跟著植株「冒出來」的彈跳縮放（剛落地那一格植株縮放趨近 0）
      const ring = new THREE.Mesh(this.ringGeometry, ringMaterial);
      ring.position.set(pos.x, 0.006, pos.z);
      ring.renderOrder = 3;
      ring.visible = false;
      this.plantsRoot.add(ring);
      entry.ring = ring;
    }

    if (mode === 'fly') {
      this.overlay.add({
        id: row.id,
        startAt: launchAt,
        origin: () => this._origin,
        target: () => this._project(entry),
        name: row.display_name || '有人',
        plantName: plant.name,
        message: row.message,
      });
    }

    this.plantsRoot.add(root);
    this.entries.set(row.id, entry);
  }

  _removeEntry(id) {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.overlay.cancel(id);
    this.plantsRoot.remove(entry.root);
    entry.stages.forEach((s) => {
      s.material.dispose();
      s.shadowMaterial.dispose();
    });
    entry.blob.material.dispose();
    if (entry.ring) {
      this.plantsRoot.remove(entry.ring);
      entry.ring.material.dispose();
    }
    this.entries.delete(id);
  }

  // 植株根部跟頂端在畫面上的位置（CSS 像素），給飛入動畫跟名字標籤定位
  _project(entry) {
    const p = this._v.set(entry.root.position.x, 0, entry.root.position.z).project(this.camera);
    if (p.z > 1) return null;
    const x = ((p.x + 1) / 2) * this.width;
    const y = ((1 - p.y) / 2) * this.height;
    const top = this._v.set(entry.root.position.x, entry.height, entry.root.position.z).project(this.camera);
    return { x, y, topY: ((1 - top.y) / 2) * this.height };
  }

  _updatePlants(nowMs, elapsed) {
    this.entries.forEach((entry) => {
      if (!entry.launched && nowMs >= entry.launchAt) {
        entry.launched = true;
        this.onLaunch?.(entry.row);
      }
      if (!entry.landed && nowMs >= entry.appearAt) {
        entry.landed = true;
        this.onLanded?.(entry.row);
      }

      const sinceAppear = nowMs - entry.appearAt;
      if (sinceAppear < 0) {
        entry.root.visible = false;
        return;
      }
      entry.root.visible = true;

      const g = growthState(entry.cycleSeconds, entry.createdAtMs, nowMs);
      // 各階段圖本身就一階比一階大，root 只做輕微的縮放，避免幼苗小到看不見。
      const pop = sinceAppear < POP_MS ? Math.max(0, easeOutBack(sinceAppear / POP_MS)) : 1;
      const scale = (0.4 + 0.6 * g.scale) * pop;
      entry.root.scale.setScalar(Math.max(scale, 0.0001));
      const sway = Math.sin(elapsed * 0.7 + entry.phase) * 0.025 + Math.sin(elapsed * 1.9 + entry.phase) * 0.008;

      let shadowWidth = 0;
      let height = 0;
      entry.stages.forEach((s, stage) => {
        let op = 0;
        if (stage === g.formA) op = (g.formB !== g.formA ? 1 - g.formT : 1) * g.opacity;
        else if (stage === g.formB) op = g.formT * g.opacity;
        const visible = op > 0.004 && s.record.ready;
        s.sprite.visible = visible;
        s.material.opacity = op;
        s.material.rotation = sway;
        s.shadow.visible = visible;
        s.shadowMaterial.uniforms.uOpacity.value = op * 0.8;
        s.shadowMaterial.uniforms.uRotation.value = sway;
        shadowWidth += s.width * op;
        if (op > 0.3) height = Math.max(height, s.height);
      });
      entry.height = Math.max(0.2, height) * entry.root.scale.x;

      const blobSize = Math.max(0.14, shadowWidth * 0.7);
      entry.blob.scale.set(blobSize, 1, blobSize * 0.85);
      entry.blob.material.uniforms.uOpacity.value = Math.min(1, g.opacity) * 0.75;

      if (entry.ring) {
        const t = sinceAppear / RING_MS;
        if (t >= 1) {
          this.plantsRoot.remove(entry.ring);
          entry.ring.material.dispose();
          entry.ring = null;
        } else {
          const pulse = (t * 2) % 1;
          const ringScale = 0.1 + pulse * 0.5;
          entry.ring.visible = true;
          entry.ring.scale.set(ringScale, 1, ringScale);
          entry.ring.material.opacity = (1 - pulse) * (1 - t * 0.6);
        }
      }
    });
  }

  _updateCamera(elapsed) {
    const rig = this._rig;
    if (!rig) return;
    const angle = this.baseAngle + elapsed * 0.02;
    const elevation = rig.elevation + Math.sin(elapsed * 0.11) * 0.012;
    this._placeCamera(rig.distance, elevation, rig.targetY, angle);

    // 影子方向跟著鏡頭：光固定從畫面右前上方來（跟植株圖預先渲染時的主光同一側）
    this.camera.getWorldDirection(this._fwd);
    this._fwd.y = 0;
    this._fwd.normalize();
    this._right.crossVectors(this._fwd, THREE.Object3D.DEFAULT_UP).normalize();
    this.shadowUniforms.uRight.value.copy(this._right);
    this.shadowUniforms.uCast.value
      .copy(this._fwd)
      .multiplyScalar(0.62)
      .addScaledVector(this._right, -0.55)
      .multiplyScalar(0.95);

    // 遠景的霧線對齊花園後緣
    const far = this._v.copy(this._fwd).multiplyScalar(GROUND_RADIUS * 0.7).project(this.camera);
    this.backdrop.setHorizon(Math.min(0.9, Math.max(0.35, (far.y + 1) / 2)));
  }

  _renderShadows() {
    const { renderer, camera } = this;
    camera.layers.set(SHADOW_LAYER);
    renderer.setRenderTarget(this.shadowTarget);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, false, false);
    const fog = this.scene.fog;
    this.scene.fog = null;
    renderer.render(this.scene, camera);
    this.scene.fog = fog;
    renderer.setRenderTarget(null);
    camera.layers.set(0);
  }

  start() {
    const loop = () => {
      if (this._destroyed) return;
      const elapsed = this.clock.getElapsedTime();
      const nowMs = Date.now();
      this.backdrop.update(elapsed * 1000);
      this._updateCamera(elapsed);
      this._updatePlants(nowMs, elapsed);
      this.fireflies.material.uniforms.uTime.value = elapsed;
      this.grade.uniforms.uTime.value = elapsed;
      this._renderShadows();
      this.composer.render();
      this.overlay.draw(nowMs);
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
    this.unitPlane.dispose();
    this.groundPlane.dispose();
    this.ringGeometry.dispose();
    this.ground.geometry.dispose();
    this.ground.material.uniforms.map.value.dispose();
    this.ground.material.dispose();
    this.fireflies.geometry.dispose();
    this.fireflies.material.dispose();
    this.backdrop.dispose();
    this.shadowTarget.dispose();
    this.bloom.dispose();
    this.grade.material.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
