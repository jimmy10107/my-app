import { forwardRef, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { JOIN_URL } from '../lib/joinUrl.js';

// 投影牆角落的參加卡：大螢幕顯示 QR 讓現場的人用 LINE 掃；手機上看牆時改成一顆按鈕直接點進去。
// 新種下的植物會從這張卡片「飛」進花園，所以 WallPage 會量它的位置當動畫起點。
export const JoinCard = forwardRef(function JoinCard({ highlight }, ref) {
  const [qr, setQr] = useState(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(JOIN_URL, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#231F20', light: '#F6F2E8' },
    })
      .then((svg) => !cancelled && setQr(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <aside className={`join-card${highlight ? ' join-card--pulse' : ''}`} ref={ref}>
      {qr && <img className="join-card__qr" src={qr} alt="掃描 QR Code 進入互動頁" />}
      <div className="join-card__text">
        <span className="join-card__eyebrow">PLANT A SEED</span>
        <strong>
          <span className="join-card__scan">掃碼，</span>種一株日南
        </strong>
        <span className="join-card__hint">選一種植物、留一句話，它會從這裡飛進花園發芽。</span>
        <a className="join-card__link" href={JOIN_URL}>
          我也要種一株 →
        </a>
      </div>
    </aside>
  );
});
