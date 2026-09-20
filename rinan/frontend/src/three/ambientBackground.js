// 投影牆背景氛圍：改用日南稻站官方 CIS 色票（見 CIS 品牌識別系統設計規範 v1.0）
// 日南炭墨 #231F20、海線藍 #456C90、站點橙 #D99531、米紙白 #F6F2E8，
// 而不是隨意挑的色塊。畫面語彙直接取自 CIS 的「地圖 icon」與「動態」規範：
// 站點用橙色圓點、路徑用海線藍，動態則是「橙點沿藍線移動、停留、返回」——
// 剛好呼應場內導覽地圖的視覺語言，也符合「橙色只能當標點，不能當背景主色」的原則。
import * as THREE from 'three';

const INK = '#231F20';
const INK_LIGHT = '#2f2820';
const PAPER = '#F6F2E8';
const BLUE = '#456C90';
const ORANGE = '#D99531';

function hexToRgba(hex, a) {
  const v = hex.replace('#', '');
  const r = parseInt(v.substring(0, 2), 16);
  const g = parseInt(v.substring(2, 4), 16);
  const b = parseInt(v.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function seededRand(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

class AmbientPainter {
  constructor() {
    // 三條緩緩漂移的海線藍路徑，弧度與相位各自錯開，呼應「往返」路線意象。
    this.routes = [0, 1, 2].map((i) => ({
      baseY: 0.22 + i * 0.26,
      amp: 0.05 + i * 0.015,
      freq: 0.55 + i * 0.18,
      phase: i * 2.1,
      driftSpeed: 0.00003 + i * 0.000008,
    }));

    // 每條路線上一個橙點：沿路徑來回移動、在端點自然停留（sin 波形本身在極值處速度為零）。
    this.stations = this.routes.map((route, i) => ({
      route,
      speed: 0.00011 + seededRand(i * 4.7) * 0.00004,
      phase: seededRand(i * 9.3) * Math.PI * 2,
      range: 0.72 + seededRand(i * 2.1) * 0.2,
    }));

    this.particles = Array.from({ length: 16 }, (_, i) => ({
      x: seededRand(i * 7.1),
      y: 1 + seededRand(i * 3.3) * 0.3,
      speed: 0.00007 + seededRand(i * 5.5) * 0.00006,
      drift: (seededRand(i * 9.2) - 0.5) * 0.1,
      size: 0.8 + seededRand(i * 2.1) * 1.6,
      phase: seededRand(i * 4.4) * 10,
    }));
  }

  _routeY(route, xFrac, W, H, timeMs) {
    return (
      route.baseY * H +
      Math.sin(xFrac * Math.PI * 2 * route.freq + timeMs * route.driftSpeed * 60 + route.phase) * route.amp * H
    );
  }

  draw(ctx, W, H, timeMs) {
    ctx.clearRect(0, 0, W, H);

    const base = ctx.createRadialGradient(W * 0.5, H * 0.18, 0, W * 0.5, H * 0.18, Math.max(W, H) * 0.8);
    base.addColorStop(0, INK_LIGHT);
    base.addColorStop(0.6, INK);
    base.addColorStop(1, '#15110d');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);

    // 海線藍路徑（同一筆畫粗細，呼應導覽地圖的路徑線）
    ctx.lineCap = 'round';
    this.routes.forEach((route) => {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 14) {
        const y = this._routeY(route, x / W, W, H, timeMs);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = hexToRgba(BLUE, 0.22);
      ctx.lineWidth = 1.6;
      ctx.stroke();
    });

    // 站點橙：沿藍線移動、停留、返回——只當標點，不當背景色
    this.stations.forEach((station) => {
      const t = 0.5 + 0.5 * station.range * Math.sin(timeMs * station.speed + station.phase);
      const x = t * W;
      const y = this._routeY(station.route, t, W, H, timeMs);

      const glow = ctx.createRadialGradient(x, y, 0, x, y, 26);
      glow.addColorStop(0, hexToRgba(ORANGE, 0.55));
      glow.addColorStop(1, hexToRgba(ORANGE, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 26, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = hexToRgba(ORANGE, 0.95);
      ctx.beginPath();
      ctx.arc(x, y, 3.4, 0, Math.PI * 2);
      ctx.fill();
    });

    // 米紙白微光粒子：極稀疏，作氛圍不作主體
    ctx.globalCompositeOperation = 'lighter';
    this.particles.forEach((p) => {
      const life = ((timeMs * p.speed + p.phase) % 1 + 1) % 1;
      const py = (1 - life) * H;
      const px = (p.x + Math.sin(life * 8 + p.phase) * p.drift) * W;
      const alpha = Math.sin(life * Math.PI) * 0.16;
      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(PAPER, alpha);
      ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
  }
}

export class AmbientBackground {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 2;
    this.canvas.height = 2;
    this.ctx = this.canvas.getContext('2d');
    this.painter = new AmbientPainter();
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
  }

  resize(width, height) {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.max(2, Math.round(width * dpr));
    this.canvas.height = Math.max(2, Math.round(height * dpr));
  }

  update(timeMs) {
    this.painter.draw(this.ctx, this.canvas.width, this.canvas.height, timeMs);
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
  }
}
