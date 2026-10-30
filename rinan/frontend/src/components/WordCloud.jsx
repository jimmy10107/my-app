import { useEffect, useMemo, useRef, useState } from 'react';

// 投影牆天空的文字雲。位置用確定性的橢圓螺旋排版（同一批詞每次排出來都一樣），
// 詞的分量改變時用 CSS transition 慢慢飄到新位置，像雲在移動，不會整片跳動。

const WIDE = /[⺀-鿿豈-﫿＀-￯　-〿]/u;
const FULL_SIZE_WEIGHT = 3; // 至少要有三則留言提到，才會長到最大字級
// 平常新詞進來只局部挪位置；但一直這樣下去，早期的小詞會佔住中間、後來變大的詞被擠到外圈，
// 所以每隔一段時間整片重新排一次（一樣用 transition 慢慢飄過去）。
const RELAYOUT_MS = 10 * 60 * 1000;

function hashUnit(text) {
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
export function layoutCloud(words, width, height, previous = new Map()) {
  if (!width || !height || words.length === 0) return [];
  const maxWeight = Math.max(FULL_SIZE_WEIGHT, ...words.map((w) => w.weight));
  const big = Math.min(height * 0.34, width * 0.075, 120);
  const small = Math.max(15, big * 0.24);
  const cx = width / 2;
  const cy = height / 2;
  // 螺旋是 2.6:1 的橢圓：詞先擠在中間成一團雲，多了才往兩側散開，不會排成一列一列
  const rx = Math.min(width / 2, height * 1.3);
  const ry = height / 2;
  const placed = [];

  // 剛落地的詞最先排，天空再擠也一定有它的位置；其餘照分量排，放不下的最輕的詞就先不顯示
  const ordered = [...words.filter((w) => w.fresh), ...words.filter((w) => !w.fresh)];
  ordered.forEach((word) => {
    const size = small + (big - small) * Math.sqrt(word.weight / maxWeight);
    const { w, h } = measure(word.term, size);
    const padX = size * 0.32;
    const padY = size * 0.08;
    const rectAt = (x, y) => ({ x0: x - w / 2 - padX, x1: x + w / 2 + padX, y0: y - h / 2 - padY, y1: y + h / 2 + padY });
    const fits = (rect) =>
      rect.x0 >= 0 && rect.x1 <= width && rect.y0 >= 0 && rect.y1 <= height && !placed.some((p) => overlaps(p.rect, rect));

    const before = previous.get(word.term);
    if (before && fits(rectAt(before.x, before.y))) {
      placed.push({ ...word, size, x: before.x, y: before.y, rect: rectAt(before.x, before.y) });
      return;
    }

    const start = hashUnit(word.term) * Math.PI * 2;
    let theta = 0;
    let rho = 0;
    while (rho < (width / 2 / rx) * 1.2) {
      const x = cx + Math.cos(start + theta) * rho * rx;
      const y = cy + Math.sin(start + theta) * rho * ry;
      const rect = rectAt(x, y);
      if (fits(rect)) {
        placed.push({ ...word, size, x, y, rect });
        return;
      }
      // 外圈每一步走的弧長固定在幾個像素，內外圈的搜尋密度才會一致
      const step = Math.min(0.35, Math.max(0.015, 7 / (rho * ry + 1)));
      theta += step;
      rho += step * 0.0055;
    }
  });
  return placed;
}

export function WordCloud({ words }) {
  const ref = useRef(null);
  const previousRef = useRef({ key: '', positions: new Map() });
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setEpoch((e) => e + 1), RELAYOUT_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const el = ref.current;
    const update = () => setBox({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const placed = useMemo(() => {
    const key = `${box.width}x${box.height}@${epoch}`;
    const previous = previousRef.current.key === key ? previousRef.current.positions : new Map();
    const result = layoutCloud(words, box.width, box.height, previous);
    previousRef.current = { key, positions: new Map(result.map((p) => [p.term, { x: p.x, y: p.y }])) };
    return result;
  }, [words, box.width, box.height, epoch]);

  return (
    <div className="word-cloud" ref={ref} aria-label="訪客留言文字雲">
      {placed.map((word) => {
        const seed = hashUnit(`${word.term}~`);
        const cls = ['word-cloud__word', `word-cloud__word--${word.kind}`, word.fresh && 'word-cloud__word--fresh']
          .filter(Boolean)
          .join(' ');
        return (
          <span
            key={word.term}
            className={cls}
            style={{
              transform: `translate3d(${word.x.toFixed(1)}px, ${word.y.toFixed(1)}px, 0) translate(-50%, -50%)`,
              fontSize: `${word.size.toFixed(1)}px`,
              opacity: word.fresh
                ? 1
                : word.kind === 'meaning'
                  ? 0.78
                  : 0.62 + 0.38 * Math.min(1, word.weight / FULL_SIZE_WEIGHT),
            }}
          >
            <span
              className="word-cloud__float"
              style={{ animationDuration: `${7 + seed * 6}s`, animationDelay: `${-seed * 13}s` }}
            >
              {word.term}
            </span>
          </span>
        );
      })}
    </div>
  );
}
