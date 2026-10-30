// 投影牆的天空與遠景，配色取自日南稻站 CIS：
// 海線藍的天空（日南的傍晚，不是一片黑）、地平線一層米紙白的薄霧、遠方一條海線藍的鐵道，
// 站點橙的光點沿著鐵道「移動、停靠、返回」（CIS 動態規範），停在三個站點上，呼應場內導覽地圖。
// 整片用一張全螢幕 shader 畫：舊版每一格都重畫 2D canvas 再上傳成貼圖，
// 1080p 投影一秒要搬 60 張整螢幕的圖，現在只更新幾個 uniform。
import * as THREE from 'three';

const STATIONS = [0.2, 0.5, 0.8];
const LEG_MS = 7200;
const DWELL_MS = 2800;
const ROUTE = [
  [0, 1],
  [1, 2],
  [2, 1],
  [1, 0],
];

function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

// 光點在三站之間來回：每到一站先停靠，再開往下一站。
function trainPosition(timeMs) {
  const legMs = LEG_MS + DWELL_MS;
  const t = timeMs % (ROUTE.length * legMs);
  const leg = Math.floor(t / legMs);
  const within = t - leg * legMs;
  const [from, to] = ROUTE[leg];
  if (within < DWELL_MS) return STATIONS[from];
  const k = easeInOut((within - DWELL_MS) / LEG_MS);
  return STATIONS[from] + (STATIONS[to] - STATIONS[from]) * k;
}

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uHorizon;   // 花園後緣在畫面上的高度（0 = 底、1 = 頂），霧線畫在這裡
  uniform vec2 uResolution; // CSS 像素，線寬才不會因為 devicePixelRatio 變細
  uniform float uTrainX;
  uniform vec3 uSkyTop;
  uniform vec3 uSkyMid;
  uniform vec3 uHaze;
  uniform vec3 uGlow;
  uniform vec3 uEarthFar;
  uniform vec3 uEarthNear;
  uniform vec3 uRail;
  uniform vec3 uStation;
  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float railY(float x) {
    return uHorizon - 0.032 + sin(x * 3.1 + 0.6) * 0.005;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;
    float px = 1.0 / uResolution.y;
    float d = uv.y - uHorizon;

    // 天空：地平線的霧 → 海線藍 → 深藍
    float ts = clamp(d / max(1.0 - uHorizon, 0.05), 0.0, 1.0);
    vec3 sky = mix(uHaze, uSkyMid, smoothstep(0.0, 0.32, ts));
    sky = mix(sky, uSkyTop, smoothstep(0.35, 1.0, ts));

    // 遠方田野：越近地平線越淡，帶一點透視壓縮的田埂紋
    float te = clamp(-d / max(uHorizon, 0.05), 0.0, 1.0);
    vec3 earth = mix(uEarthFar, uEarthNear, smoothstep(0.0, 0.6, te));
    float furrows = sin(1.7 / (te + 0.04));
    earth *= 1.0 + furrows * 0.04 * (1.0 - smoothstep(0.0, 0.3, te));

    vec3 col = mix(earth, sky, smoothstep(-0.015, 0.02, d));
    // 地平線薄霧蓋掉天地交界，往下一點也是霧濛濛的遠田
    col = mix(col, uHaze, exp(-pow(d / 0.04, 2.0)) * 0.42);

    // 日落後的餘暉：只在地平線左側留一點暖光
    vec2 g = vec2((uv.x - 0.2) * aspect * 0.5, d * 1.5);
    col += uGlow * exp(-dot(g, g) * 9.0) * 0.32;

    // 上半部天空稀疏的星點，緩慢閃爍
    vec2 grid = uv * vec2(aspect, 1.0) * 64.0;
    vec2 cell = floor(grid);
    float star = step(0.986, hash(cell));
    float twinkle = 0.45 + 0.55 * sin(uTime * (0.5 + hash(cell + 3.1) * 1.3) + hash(cell + 7.7) * 6.283);
    float starMask = smoothstep(0.35, 0.85, ts);
    col += vec3(0.85, 0.9, 1.0) * star * smoothstep(0.14, 0.0, length(fract(grid) - 0.5)) * twinkle * 0.4 * starMask;

    // 海線鐵道：一條細細的海線藍，兩端淡出
    float rail = smoothstep(1.5, 0.4, abs(uv.y - railY(uv.x)) / px);
    float ends = smoothstep(0.02, 0.12, uv.x) * smoothstep(0.98, 0.88, uv.x);
    col = mix(col, uRail, rail * 0.85 * ends);

    for (int i = 0; i < 3; i++) {
      float sx = 0.2 + float(i) * 0.3;
      float sd = length((uv - vec2(sx, railY(sx))) * vec2(aspect, 1.0)) / px;
      col = mix(col, uStation, smoothstep(3.8, 2.6, sd) * 0.85);
    }

    // 沿線移動的站點橙光點：核心刻意超過 1.0，讓 bloom 把它暈成一盞燈
    float td = length((uv - vec2(uTrainX, railY(uTrainX))) * vec2(aspect, 1.0)) / px;
    col += uStation * (smoothstep(4.6, 2.2, td) * 2.4 + exp(-td * td / 700.0) * 0.5);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export class Backdrop {
  constructor() {
    const color = (hex) => new THREE.Color(hex);
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uHorizon: { value: 0.55 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uTrainX: { value: STATIONS[0] },
        uSkyTop: { value: color('#1a2c40') },
        uSkyMid: { value: color('#3d6283') },
        uHaze: { value: color('#bdb9aa') },
        uGlow: { value: color('#e8b46a') },
        uEarthFar: { value: color('#6a6555') },
        uEarthNear: { value: color('#231d16') },
        uRail: { value: color('#456c90') },
        uStation: { value: color('#d99531') },
      },
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -100;
  }

  resize(width, height) {
    this.material.uniforms.uResolution.value.set(width, height);
  }

  setHorizon(screenFraction) {
    this.material.uniforms.uHorizon.value = screenFraction;
  }

  update(timeMs) {
    this.material.uniforms.uTime.value = timeMs / 1000;
    this.material.uniforms.uTrainX.value = trainPosition(timeMs);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
