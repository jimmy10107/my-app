import { useMemo, useRef, useState } from 'react';

// 單一序列的每日趨勢線（社群洞察用）。不同指標各畫一張、共用同一條日期軸（small multiples），
// 不做雙 Y 軸。滑鼠／觸控沿著 X 軸移動就會吸附到最近的一天顯示數值；底下附數據表，不靠 hover 也看得到。
const W = 360;
const H = 150;
const PAD = { top: 12, right: 8, bottom: 22, left: 40 };

function niceMax(value) {
  if (!(value > 0)) return 1;
  const exp = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * exp >= value);
  return step * exp;
}

const compact = (v) =>
  v >= 10000 ? `${(v / 10000).toFixed(v >= 100000 ? 0 : 1)}萬` : Math.round(v).toLocaleString('zh-TW');
const shortDate = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

export function TrendChart({ title, data, color, unit = '' }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);

  const { points, max, path, total, hasData } = useMemo(() => {
    const values = data.map((d) => d.value).filter((v) => v != null);
    const max = niceMax(Math.max(0, ...values));
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const step = data.length > 1 ? innerW / (data.length - 1) : 0;
    const points = data.map((d, i) => ({
      ...d,
      x: PAD.left + i * step,
      y: d.value == null ? null : PAD.top + innerH - (d.value / max) * innerH,
    }));
    // 沒有數值的日子斷開線段，不畫成 0
    let path = '';
    let pen = false;
    for (const p of points) {
      if (p.y == null) {
        pen = false;
        continue;
      }
      path += `${pen ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      pen = true;
    }
    return { points, max, path, total: values.reduce((a, b) => a + b, 0), hasData: values.length > 0 };
  }, [data]);

  function handleMove(event) {
    const svg = svgRef.current;
    if (!svg || points.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * W;
    let nearest = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(points[i].x - x) < Math.abs(points[nearest].x - x)) nearest = i;
    }
    setHover(nearest);
  }

  const ticks = [0, max / 2, max];
  const xLabels =
    points.length > 2 ? [0, Math.floor((points.length - 1) / 2), points.length - 1] : points.map((_, i) => i);
  const hp = hover == null ? null : points[hover];

  return (
    <figure className="trend">
      <figcaption className="trend__head">
        <span className="trend__title">{title}</span>
        <span className="trend__total">
          合計 {hasData ? Math.round(total).toLocaleString('zh-TW') : '—'}
          {unit}
        </span>
      </figcaption>
      {hasData ? (
        <div className="trend__plot">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`${title}每日趨勢`}
            onPointerMove={handleMove}
            onPointerDown={handleMove}
            onPointerLeave={() => setHover(null)}
          >
            {ticks.map((t) => {
              const y = PAD.top + (H - PAD.top - PAD.bottom) * (1 - t / max);
              return (
                <g key={t}>
                  <line
                    x1={PAD.left}
                    x2={W - PAD.right}
                    y1={y}
                    y2={y}
                    className={t === 0 ? 'trend__baseline' : 'trend__grid'}
                  />
                  <text x={PAD.left - 6} y={y + 4} textAnchor="end" className="trend__axis">
                    {compact(t)}
                  </text>
                </g>
              );
            })}
            {xLabels.map((i) => (
              <text
                key={i}
                x={points[i].x}
                y={H - 6}
                textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
                className="trend__axis"
              >
                {shortDate(points[i].date)}
              </text>
            ))}
            <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {hp && (
              <g>
                <line x1={hp.x} x2={hp.x} y1={PAD.top} y2={H - PAD.bottom} className="trend__crosshair" />
                {hp.y != null && <circle cx={hp.x} cy={hp.y} r="4" fill={color} stroke="#fff" strokeWidth="2" />}
              </g>
            )}
            <rect x={PAD.left} y={0} width={W - PAD.left - PAD.right} height={H} fill="transparent" />
          </svg>
          {hp && (
            <div className="trend__tooltip" style={{ left: `${(hp.x / W) * 100}%` }}>
              <strong>{hp.value == null ? '—' : `${Math.round(hp.value).toLocaleString('zh-TW')}${unit}`}</strong>
              <span>{hp.date}</span>
            </div>
          )}
        </div>
      ) : (
        <p className="trend__empty">這段期間沒有資料</p>
      )}
      {hasData && (
        <details className="trend__table">
          <summary>檢視每日數據</summary>
          <table>
            <thead>
              <tr>
                <th>日期</th>
                <th>{title}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date}>
                  <td>{d.date}</td>
                  <td>{d.value == null ? '—' : Math.round(d.value).toLocaleString('zh-TW')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </figure>
  );
}
