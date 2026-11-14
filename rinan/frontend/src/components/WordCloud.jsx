import { useEffect, useMemo, useRef, useState } from 'react';

// 投影牆天空的文字雲。位置用確定性的橢圓螺旋排版（同一批詞每次排出來都一樣），
// 詞的分量改變時用 CSS transition 慢慢飄到新位置，像雲在移動，不會整片跳動。

import { FULL_SIZE_WEIGHT, hashUnit, layoutCloud } from '../lib/wordCloudLayout.js';

const RELAYOUT_MS = 10 * 60 * 1000;

export function WordCloud({ words }) {
  const ref = useRef(null);
  const previousRef = useRef({ key: '', positions: new Map() });
  const [box, setBox] = useState({ width: 0, height: 0, exclusions: [], skyBand: false });
  const [epoch, setEpoch] = useState(0);
  const [dragOffsets, setDragOffsets] = useState({});
  const dragRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setEpoch((e) => e + 1), RELAYOUT_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const el = ref.current;
    const hud = el.closest('.wall__hud');
    const reserved = [hud?.querySelector('.wall__header'), hud?.querySelector('.plant-search__toggle')].filter(Boolean);
    const update = () => {
      const desktop = window.matchMedia('(min-width: 701px)').matches;
      const cloud = el.getBoundingClientRect();
      const padding = Math.max(8, window.innerHeight * 0.012);
      setBox({
        width: el.clientWidth,
        height: el.clientHeight,
        skyBand: desktop,
        maxFontSize: desktop ? window.innerHeight * 0.078 : Infinity,
        exclusions: desktop ? reserved.map((node) => {
          const rect = node.getBoundingClientRect();
          return { x0: rect.left - cloud.left - padding, x1: rect.right - cloud.left + padding,
            y0: rect.top - cloud.top - padding, y1: rect.bottom - cloud.top + padding };
        }) : [],
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    reserved.forEach((node) => observer.observe(node));
    window.addEventListener('resize', update);
    return () => { observer.disconnect(); window.removeEventListener('resize', update); };
  }, []);

  const placed = useMemo(() => {
    const key = `${box.width}x${box.height}@${epoch}:${JSON.stringify(box.exclusions)}:${box.skyBand}`;
    const previous = previousRef.current.key === key ? previousRef.current.positions : new Map();
    const result = layoutCloud(words, box.width, box.height, previous, box);
    previousRef.current = { key, positions: new Map(result.map((p) => [p.term, { x: p.x, y: p.y }])) };
    return result;
  }, [words, box, epoch]);

  const startDrag = (event, term) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { term, id: event.pointerId, x: event.clientX, y: event.clientY,
      offset: dragOffsets[term] || { x: 0, y: 0 } };
    event.currentTarget.classList.add('is-dragging');
  };
  const moveDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    setDragOffsets((current) => ({ ...current, [drag.term]: {
      x: drag.offset.x + event.clientX - drag.x, y: drag.offset.y + event.clientY - drag.y,
    } }));
  };
  const stopDrag = (event) => {
    if (dragRef.current?.id !== event.pointerId) return;
    event.currentTarget.classList.remove('is-dragging');
    dragRef.current = null;
  };

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
            role="button"
            tabIndex={0}
            aria-label={`拖曳留言泡泡：${word.term}`}
            onPointerDown={(event) => startDrag(event, word.term)}
            onPointerMove={moveDrag}
            onPointerUp={stopDrag}
            onPointerCancel={stopDrag}
            style={{
              transform: `translate3d(${(word.x + (dragOffsets[word.term]?.x || 0)).toFixed(1)}px, ${(word.y + (dragOffsets[word.term]?.y || 0)).toFixed(1)}px, 0) translate(-50%, -50%)`,
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
