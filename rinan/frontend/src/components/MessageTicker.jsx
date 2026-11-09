import { useEffect, useRef, useState } from 'react';
import { plantById } from '../lib/plants.js';

const MARQUEE_LIMIT = 30;

function TickerEntry({ entry }) {
  const plant = plantById(entry.plant_type);
  return (
    <span className="ticker__item">
      <i className="ticker__dot" style={{ background: plant?.color }} />
      <strong>{entry.display_name || '有人'}</strong>
      <span className="ticker__plant">種下了{plant?.name}</span>
      {entry.message && <q className="ticker__message">{entry.message}</q>}
    </span>
  );
}

// 桌面左右並列；手機改成上排最新種植、下排全寬跑馬燈。
// 跑馬燈只在每一圈跑完、位移歸零的那一刻才換內容，新留言進來不會讓整條跳一下。
export function MessageTicker({ entries }) {
  const latest = entries[0];
  const rest = entries.slice(1, 1 + MARQUEE_LIMIT);
  const nextRef = useRef(rest);
  nextRef.current = rest;
  const [shown, setShown] = useState(rest);

  useEffect(() => {
    if (shown.length === 0 && rest.length > 0) setShown(rest);
  }, [rest, shown.length]);

  return (
    <footer className="ticker" aria-label="種植動態">
      {latest ? (
        <div className="ticker__latest" key={latest.id} aria-label="最新種植，可左右滑動閱讀完整內容">
          <span className="ticker__badge">最新種植</span>
          <TickerEntry entry={latest} />
        </div>
      ) : (
        <div className="ticker__latest ticker__latest--empty">還沒有人種下，一起種下第一株</div>
      )}
      <div className="ticker__viewport" aria-label="過往種植跑馬燈">
        {shown.length > 0 && (
          <div
            className="ticker__track"
            style={{ animationDuration: `${Math.max(40, shown.length * 6)}s` }}
            onAnimationIteration={() => setShown(nextRef.current)}
          >
            {[...shown, ...shown].map((entry, i) => (
              <TickerEntry key={`${entry.id}-${i}`} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </footer>
  );
}
