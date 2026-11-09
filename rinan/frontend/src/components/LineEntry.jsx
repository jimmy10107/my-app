import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { JOIN_URL } from '../lib/joinUrl.js';

export function LineEntry({ loading, error, onBrowserLogin }) {
  const [qr, setQr] = useState(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(JOIN_URL, {
      width: 320, margin: 2,
      color: { dark: '#231F20', light: '#FFFFFF' },
    }).then((url) => { if (active) setQr(url); }).catch(() => {});
    return () => { active = false; };
  }, []);

  return (
    <main className="page page--center line-entry">
      <span className="line-entry__brand">Grounded in Rinan｜日南生根</span>
      <span className="line-entry__seed" aria-hidden="true">🌱</span>
      <h1>一起種下日南吧！</h1>
      <p className="line-entry__intro">用 LINE 開啟，找到你的命定植物，<br />留一句話，一起長成日南的花園。</p>
      <a className="line-entry__open" href={JOIN_URL}>在 LINE 開始種植 <span aria-hidden="true">→</span></a>
      <p className="line-entry__note">第一次使用時，請依 LINE 提示完成授權。</p>
      {qr && <figure className="line-entry__qr">
        <img src={qr} alt="使用手機 LINE 掃描，開始種植" width="160" height="160" />
        <figcaption>也可以用手機 LINE 掃描開始</figcaption>
      </figure>}
      <button className="line-entry__browser" type="button" onClick={onBrowserLogin} disabled={loading}>
        改用網頁版登入
      </button>
      {loading && <p className="line-entry__status" role="status">正在連接 LINE…</p>}
      {error && <p className="page__error line-entry__status" role="alert">{error}</p>}
      <details className="line-entry__help">
        <summary>沒有順利開啟 LINE？</summary>
        <p>請用 Safari 或 Chrome 開啟此頁，再點上方按鈕；也可選擇網頁版登入繼續。</p>
      </details>
    </main>
  );
}
