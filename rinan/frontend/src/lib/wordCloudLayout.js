const WIDE = /[⺀-鿿豈-﫿＀-￯　-〿]/u;
export const FULL_SIZE_WEIGHT = 3; // 至少要有三則留言提到，才會長到最大字級

export function hashUnit(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

// 不用等字型載入去量 DOM：中文字寬就是 1em，英數字約 0.6em，估算夠準。
function measure(term, size) {
  let em = 0;
  for (const ch of term) em += WIDE.test(ch) ? 1.04 : /[A-Z0-9]/.test(ch) ? 0.68 : 0.58;
  return { w: em * size, h: size * 1.2 };
}

function overlaps(a, b) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

/**
 * previous：上一次排版的位置（term → {x, y}）。詞如果在原位還放得下就不動，
 * 只有新詞、或變大之後撞到別人的詞才重新找位置——有新留言時天空不會整片洗牌。
 */
export function layoutCloud(words, width, height, previous = new Map(), { exclusions = [], maxFontSize = Infinity, skyBand = false } = {}) {
  if (!width || !height || words.length === 0) return [];
  const maxWeight = Math.max(FULL_SIZE_WEIGHT, ...words.map((w) => w.weight));
  const big = Math.min(height * 0.34, width * 0.075, 120, maxFontSize);
  const small = Math.max(15, big * 0.24);
  const cx = width / 2;
  const cy = height / 2;
  // 螺旋是 2.6:1 的橢圓：詞先擠在中間成一團雲，多了才往兩側散開，不會排成一列一列
  const rx = Math.min(width / 2, height * 1.3);
  const ry = height / 2;
  const placed = [];

  // 優先順序看分量；剛落地的詞多加一點，能擠開同分量的舊詞，但擠不掉真正的大詞
  const sized = words
    .map((word) => {
      const size = small + (big - small) * Math.sqrt(word.weight / maxWeight);
      const { w, h } = measure(word.term, size);
      const padX = size * 0.32;
      const padY = size * 0.08;
      return {
        word,
        size,
        priority: word.weight + (word.fresh ? 0.5 : 0),
        rectAt: (x, y) => ({ x0: x - w / 2 - padX, x1: x + w / 2 + padX, y0: y - h / 2 - padY, y1: y + h / 2 + padY }),
      };
    })
    .sort((a, b) => b.priority - a.priority);
  const inside = (rect) => {
    if (rect.x0 < 0 || rect.x1 > width || rect.y0 < 0 || rect.y1 > height) return false;
    if (exclusions.some((reserved) => overlaps(rect, reserved))) return false;
    // 投影版兩側較低、中央較高的天空帶，避開左上標題與下方植栽。
    if (skyBand) {
      const edge = Math.max(Math.abs((rect.x0 - cx) / cx), Math.abs((rect.x1 - cx) / cx));
      if (rect.y0 < height * 0.55 * edge ** 2) return false;
    }
    return true;
  };
  const hitsOf = (rect) => placed.filter((p) => overlaps(p.rect, rect));
  const place = (s, x, y, rect) => placed.push({ ...s.word, size: s.size, x, y, rect, slot: s });

  // 第一輪：每個詞先回原位，放得下就不動。放不下的留到第二輪才找新位置——
  // 不然被擠開的詞會從中心搶走別人的原位，一路連鎖整片洗牌。
  const queue = [];
  sized.forEach((s) => {
    const before = previous.get(s.word.term);
    const rect = before && s.rectAt(before.x, before.y);
    if (rect && inside(rect) && hitsOf(rect).length === 0) place(s, before.x, before.y, rect);
    else queue.push(s);
  });

  // 第二輪：沿螺旋找空位。找不到空位時，可以把擋路、而且分量比較輕的詞推開
  // （被推開的再自己找位置），大詞永遠排得進去；最輕的詞真的沒位置就先不顯示。
  while (queue.length > 0) {
    const s = queue.shift();
    const start = hashUnit(s.word.term) * Math.PI * 2;
    let theta = 0;
    let rho = 0;
    let fallback = null;
    let done = false;
    while (!done && rho < (width / 2 / rx) * 1.2) {
      const x = cx + Math.cos(start + theta) * rho * rx;
      const y = cy + Math.sin(start + theta) * rho * ry;
      const rect = s.rectAt(x, y);
      if (inside(rect)) {
        const hits = hitsOf(rect);
        if (hits.length === 0) {
          place(s, x, y, rect);
          done = true;
        } else if (!fallback && hits.every((p) => p.slot.priority < s.priority)) {
          fallback = { x, y, rect, hits };
        }
      }
      // 外圈每一步走的弧長固定在幾個像素，內外圈的搜尋密度才會一致
      const step = Math.min(0.35, Math.max(0.015, 7 / (rho * ry + 1)));
      theta += step;
      rho += step * 0.0055;
    }
    if (!done && fallback) {
      fallback.hits.forEach((hit) => {
        placed.splice(placed.indexOf(hit), 1);
        queue.push(hit.slot);
      });
      place(s, fallback.x, fallback.y, fallback.rect);
    }
  }
  // 較窄的投影比例仍保留完整詞，空間不足時一起縮小字級，不裁切詞語。
  const desired = Math.min(words.length, Math.max(8, Math.ceil(words.length * 0.75)));
  if (skyBand && placed.length < desired && big > 24) {
    return layoutCloud(words, width, height, previous, {
      exclusions, skyBand, maxFontSize: Math.max(24, big * 0.85),
    });
  }
  return placed;
}

