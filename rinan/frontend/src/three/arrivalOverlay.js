// 新種下的植株「從 QR 卡片飛進花園」：站點橙的種子沿一條海線藍的弧線飛到植株的位置，
// 落地發芽、停一下，再沿線返回卡片——CIS 的「移動、停留、返回」，也是展名《往返》。
// 畫在 WebGL 上面一層的 2D canvas：線寬固定、字清楚，不必為了幾條線另寫 shader。

export const GO_MS = 1800;
const HOLD_MS = 1300;
const RETURN_MS = 1600;
const BURST_MS = 1300;
const LABEL_MS = 8500;

const BLUE = 'rgba(69,108,144,0.55)';
const BLUE_CORE = '#a7c3dc';
const ORANGE = '217,149,49';
const PAPER = '#F6F2E8';
const INK = '#231F20';

function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function bezier(p0, p1, p2, t) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

function glowDot(ctx, p, radius, glow, rgb, alpha = 1) {
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glow);
  g.addColorStop(0, `rgba(${rgb},${0.55 * alpha})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y, glow, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(${rgb},${alpha})`;
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.fill();
}

export class ArrivalOverlay {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.items = [];
    this.width = 1;
    this.height = 1;
    this.dpr = 1;
    this.flatten = 0.35; // 地面圓環在畫面上被透視壓扁的比例（= sin 仰角）
    this._dirty = false;
  }

  resize(width, height) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = width;
    this.height = height;
    this.canvas.width = Math.max(1, Math.round(width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(height * this.dpr));
    this._dirty = true;
  }

  /**
   * item: { id, startAt, origin(): {x,y}, target(): {x,y,topY}|null, name, plantName, message, color }
   * startAt 用 Date.now() 的時間軸，跟植株的生長時間同一個時鐘。
   */
  add(item) {
    this.items.push(item);
  }

  cancel(id) {
    this.items = this.items.filter((item) => item.id !== id);
  }

  draw(now) {
    const { ctx } = this;
    this.items = this.items.filter((item) => now - item.startAt < GO_MS + LABEL_MS);
    if (this.items.length === 0) {
      if (this._dirty) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this._dirty = false;
      }
      return;
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    this._dirty = true;
    this._fontSize = Math.min(26, Math.max(14, this.height * 0.019));
    this._labelRects = [];
    this.items.forEach((item) => this._drawItem(item, now));
  }

  _drawItem(item, now) {
    const t = now - item.startAt;
    if (t < 0) return;
    const p0 = item.origin();
    const p2 = item.target();
    if (!p0 || !p2) return;
    const dist = Math.hypot(p2.x - p0.x, p2.y - p0.y);
    const p1 = { x: (p0.x + p2.x) / 2, y: Math.min(p0.y, p2.y) - dist * 0.32 };
    const { ctx } = this;

    if (t < GO_MS) {
      const u = easeInOut(t / GO_MS);
      this._strokeCurve(p0, p1, p2, u, 1);
      for (let i = 4; i >= 1; i -= 1) {
        glowDot(ctx, bezier(p0, p1, p2, Math.max(0, u - i * 0.018)), 2.4 - i * 0.35, 0, ORANGE, 0.5 - i * 0.1);
      }
      glowDot(ctx, bezier(p0, p1, p2, u), 6, 30, ORANGE);
    } else if (t < GO_MS + HOLD_MS) {
      const k = (t - GO_MS) / HOLD_MS;
      this._strokeCurve(p0, p1, p2, 1, 1 - k * 0.35);
      glowDot(ctx, p2, 5 + Math.sin(k * Math.PI) * 2, 26, ORANGE, 1 - k * 0.6);
    } else if (t < GO_MS + HOLD_MS + RETURN_MS) {
      // 返回：一顆米紙白的小光點沿線回到卡片，線在它身後收回去
      const u = 1 - easeInOut((t - GO_MS - HOLD_MS) / RETURN_MS);
      this._strokeCurve(p0, p1, p2, u, 0.65);
      glowDot(ctx, bezier(p0, p1, p2, u), 3.6, 18, '246,242,232', 0.95);
    }

    if (t >= GO_MS && t < GO_MS + BURST_MS) this._drawBurst(p2, (t - GO_MS) / BURST_MS);
    if (t >= GO_MS) this._drawLabel(item, p2, t - GO_MS);
  }

  _strokeCurve(p0, p1, p2, upTo, alpha) {
    if (upTo <= 0) return;
    const { ctx } = this;
    const steps = Math.max(2, Math.round(48 * upTo));
    ctx.beginPath();
    for (let i = 0; i <= steps; i += 1) {
      const p = bezier(p0, p1, p2, (i / steps) * upTo);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = BLUE_CORE;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // 落地：兩圈貼著地面擴散的站點橙光環，加一圈往外噴的小光點
  _drawBurst(p, k) {
    const { ctx } = this;
    [0, 0.28].forEach((delay) => {
      const e = (k - delay) / (1 - delay);
      if (e <= 0) return;
      const r = 10 + (1 - (1 - e) ** 2) * this.height * 0.06;
      ctx.strokeStyle = `rgba(${ORANGE},${(1 - e) * 0.9})`;
      ctx.lineWidth = 2.4 * (1 - e) + 0.6;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r, r * this.flatten, 0, 0, Math.PI * 2);
      ctx.stroke();
    });
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2 + 0.3;
      const r = 8 + (1 - (1 - k) ** 3) * this.height * 0.05;
      const q = { x: p.x + Math.cos(a) * r, y: p.y - 18 * k + Math.sin(a) * r * this.flatten - Math.sin(k * Math.PI) * 22 };
      glowDot(ctx, q, 2.2 * (1 - k) + 0.4, 0, i % 3 === 0 ? '246,242,232' : ORANGE, 1 - k);
    }
  }

  _drawLabel(item, p, sinceLand) {
    if (sinceLand > LABEL_MS) return;
    const { ctx } = this;
    const fs = this._fontSize;
    const fadeIn = Math.min(1, sinceLand / 450);
    const fadeOut = Math.min(1, (LABEL_MS - sinceLand) / 900);
    const alpha = fadeIn * fadeOut;
    const rise = (1 - fadeIn) * 14 + (sinceLand / LABEL_MS) * 10;

    const line1Name = item.name;
    const line1Rest = ` 種下了${item.plantName}`;
    const line2 = item.message ? `「${item.message}」` : '';

    ctx.font = `700 ${fs}px "Noto Sans TC", sans-serif`;
    const nameW = ctx.measureText(line1Name).width;
    ctx.font = `500 ${fs}px "Noto Sans TC", sans-serif`;
    const restW = ctx.measureText(line1Rest).width;
    ctx.font = `500 ${fs * 0.9}px "Noto Sans TC", sans-serif`;
    const msgW = line2 ? ctx.measureText(line2).width : 0;

    const padX = fs * 0.85;
    const padY = fs * 0.55;
    const lineH = fs * 1.45;
    const w = Math.max(nameW + restW, msgW) + padX * 2;
    const h = padY * 2 + lineH * (line2 ? 2 : 1);
    const anchorY = Math.min(p.topY ?? p.y, p.y - 40) - 18 - rise;
    const x = Math.min(Math.max(p.x - w / 2, 12), this.width - w - 12);
    let y = Math.max(anchorY - h, 12);
    let stacked = false;
    // 好幾株同時落地時，後來的標籤往上讓，不疊在一起
    for (const r of this._labelRects) {
      if (x < r.x + r.w && x + w > r.x && y < r.y + r.h + 6 && y + h + 6 > r.y) {
        y = r.y - h - 10;
        stacked = true;
      }
    }
    this._labelRects.push({ x, y, w, h });

    ctx.globalAlpha = alpha;
    ctx.shadowColor = 'rgba(10,14,20,0.35)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.min(h / 2, fs * 1.1));
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // 小三角指向植株（被擠到上面的標籤就不畫，免得指到別人）
    if (!stacked) {
      const tipX = Math.min(Math.max(p.x, x + 18), x + w - 18);
      ctx.beginPath();
      ctx.moveTo(tipX - 7, y + h - 0.5);
      ctx.lineTo(tipX + 7, y + h - 0.5);
      ctx.lineTo(tipX, y + h + 8);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = `rgb(${ORANGE})`;
    ctx.beginPath();
    ctx.arc(x + padX * 0.55, y + padY + lineH / 2, fs * 0.16, 0, Math.PI * 2);
    ctx.fill();

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const tx = x + padX;
    const ty = y + padY + lineH / 2;
    ctx.fillStyle = INK;
    ctx.font = `700 ${fs}px "Noto Sans TC", sans-serif`;
    ctx.fillText(line1Name, tx, ty);
    ctx.fillStyle = '#5b5446';
    ctx.font = `500 ${fs}px "Noto Sans TC", sans-serif`;
    ctx.fillText(line1Rest, tx + nameW, ty);
    if (line2) {
      ctx.fillStyle = '#456C90';
      ctx.font = `500 ${fs * 0.9}px "Noto Sans TC", sans-serif`;
      ctx.fillText(line2, tx - fs * 0.3, ty + lineH);
    }
    ctx.globalAlpha = 1;
  }
}
