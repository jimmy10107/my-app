import { useCallback, useEffect, useState } from 'react';
import { SocialInsights } from '../components/SocialInsights.jsx';
import { LoginForm, readToken, writeToken } from './AdminPage.jsx';

// 全螢幕社群儀表板（/#/social）：給辦公室螢幕或電視長時間開著，跟後台共用同一組登入。
// 內容與後台「社群洞察」分頁相同，每 15 分鐘自動更新；登入過期（12 小時）時會回到登入畫面。
export function SocialDashboardPage() {
  const [token, setToken] = useState(readToken);

  const handleAuthError = useCallback(() => {
    writeToken(null);
    setToken(null);
  }, []);

  if (!token) {
    return (
      <LoginForm
        onLoggedIn={(t) => {
          writeToken(t);
          setToken(t);
        }}
      />
    );
  }

  return (
    <div className="page admin-page admin-page--wide social-screen">
      <header className="admin-page__header">
        <div>
          <p className="social-screen__eyebrow">日南稻站 Grounded in Rinan</p>
          <h1>社群儀表板</h1>
        </div>
        <div className="social-screen__side">
          <Clock />
          <a href="#/admin">回後台</a>
        </div>
      </header>
      <SocialInsights token={token} onAuthError={handleAuthError} />
    </div>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <time className="social-screen__clock" dateTime={now.toISOString()}>
      {now.toLocaleString('zh-TW', {
        timeZone: 'Asia/Taipei',
        month: 'numeric',
        day: 'numeric',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })}
    </time>
  );
}
