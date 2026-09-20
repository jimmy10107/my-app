// 投影牆背景氛圍：緩緩漂浮的色塊＋風／水流線＋微光粒子，取自展覽識別色（CIS），
// 畫在一張 canvas 上再設成 scene.background，取代原本純黑背景，避免畫面太暗沉、
// 也讓 Wall 頁與現場其他視覺（海報、標題色）呼應。
import * as THREE from 'three';

const PALETTE = ['#6f93a8', '#a98bc7', '#c17a54', '#8d97a3', '#e08a3c', '#e3b873', '#8fae6f', '#5c9c86', '#d98a75'];

function seededRand(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function hexToRgba(hex, a) {
  const v = hex.replace('#', '');
  const r = parseInt(v.substring(0, 2), 16);
  const g = parseInt(v.substring(2, 4), 16);
  const b = parseInt(v.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

class AmbientPainter {
  constructor() {
    this.blobs = Array.from({ length: 9 }, (_, i) => ({
      color: PALETTE[i % PALETTE.length],
      anchorX: 0.2 + seededRand(i * 13.1) * 0.6,
      anchorY: 0.15 + seededRand(i * 17.7) * 0.5,
      ampX: 0.22 + seededRand(i * 3.3) * 0.22,
      ampY: 0.18 + seededRand(i * 5.9) * 0.2,
      freqX: 0.11 + seededRand(i * 2.2) * 0.13,
      freqY: 0.09 + seededRand(i * 4.4) * 0.13,
      phase: seededRand(i * 8.8) * 20,
      baseR: 0.09 + seededRand(i * 6.6) * 0.07,
      rFreq: 0.3 + seededRand(i * 1.1) * 0.4,
    }));
    this.flowLines = [0, 1, 2, 3].map((i) => ({
      baseY: 0.18 + i * 0.22,
      amp: 0.045 + i * 0.008,
      freq: 1.4 + i * 0.3,
      speed: 0.00006 + i * 0.00002,
      phase: i * 1.7,
      color: '#7fa8a0',
    }));
    this.particles = Array.from({ length: 30 }, (_, i) => ({
      x: seededRand(i * 7.1),
      y: 1 + seededRand(i * 3.3) * 0.3,
      speed: 0.00008 + seededRand(i * 5.5) * 0.00009,
      drift: (seededRand(i * 9.2) - 0.5) * 0.15,
      size: 1 + seededRand(i * 2.1) * 2,
      phase: seededRand(i * 4.4) * 10,
    }));
  }

  draw(ctx, W, H, timeMs) {
    ctx.clearRect(0, 0, W, H);

    const base = ctx.createRadialGradient(W * 0.5, H * 0.22, 0, W * 0.5, H * 0.22, Math.max(W, H) * 0.75);
    base.addColorStop(0, '#1b232b');
    base.addColorStop(0.75, '#10161c');
    base.addColorStop(1, '#0a0d10');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);

    const minDim = Math.min(W, H);
    const t = timeMs * 0.00018;

    ctx.globalCompositeOperation = 'source-over';
    this.flowLines.forEach((fl) => {
      ctx.beginPath();
      const yBase = fl.baseY * H;
      for (let x = 0; x <= W; x += 16) {
        const y = yBase + Math.sin(x * 0.006 * fl.freq + timeMs * fl.speed * 40 + fl.phase) * fl.amp * H;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = hexToRgba(fl.color, 0.05);
      ctx.lineWidth = 1.4;
      ctx.stroke();
    });

    ctx.globalCompositeOperation = 'lighter';
    this.blobs.forEach((z) => {
      const cx = z.anchorX * W + Math.sin(t * z.freqX + z.phase) * z.ampX * W;
      const cy = z.anchorY * H + Math.cos(t * z.freqY + z.phase * 1.3) * z.ampY * H;
      const r = z.baseR * minDim * (1 + 0.1 * Math.sin(t * z.rFreq * 2 + z.phase));
      const parts = [
        { ox: 0, oy: 0, rf: 1 },
        { ox: Math.cos(t * 1.5 + z.phase) * r * 0.4, oy: Math.sin(t * 1.2 + z.phase) * r * 0.4, rf: 0.6 },
        { ox: Math.cos(t * -1.1 + z.phase * 1.4) * r * 0.38, oy: Math.sin(t * -1.6 + z.phase * 1.4) * r * 0.38, rf: 0.48 },
      ];
      parts.forEach((p) => {
        const bx = cx + p.ox;
        const by = cy + p.oy;
        const br = r * p.rf;
        const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        grad.addColorStop(0, hexToRgba(z.color, 0.22));
        grad.addColorStop(0.55, hexToRgba(z.color, 0.09));
        grad.addColorStop(1, hexToRgba(z.color, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    ctx.globalCompositeOperation = 'lighter';
    this.particles.forEach((p) => {
      const life = ((timeMs * p.speed + p.phase) % 1 + 1) % 1;
      const py = (1 - life) * H;
      const px = (p.x + Math.sin(life * 8 + p.phase) * p.drift) * W;
      const alpha = Math.sin(life * Math.PI) * 0.3;
      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba('#e3b873', alpha);
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
