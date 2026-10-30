import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../lib/api.js';
import { plantById } from '../lib/plants.js';
import { JOIN_URL } from '../lib/joinUrl.js';

const TOKEN_KEY = 'rinan_admin_token';
const REFRESH_MS = 15000;

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // 無痕模式等情況存不了 token，只是重新整理後要再登入一次
  }
}

export function AdminPage() {
  const [token, setToken] = useState(readToken);

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
    <Dashboard
      token={token}
      onLogout={() => {
        writeToken(null);
        setToken(null);
      }}
    />
  );
}

function LoginForm({ onLoggedIn }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { token } = await api.adminLogin(password);
      onLoggedIn(token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="page page--center admin-login" onSubmit={handleSubmit}>
      <h1>後台登入</h1>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="管理密碼"
        autoFocus
      />
      {error && <p className="page__error">{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? '登入中…' : '登入'}
      </button>
    </form>
  );
}

// 參加連結：投影牆上的 QR 也是這個網址。可以複製去發 LINE 群組、下載 QR 印成海報。
function JoinLinkPanel() {
  const [qr, setQr] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(JOIN_URL, { width: 1024, margin: 2, color: { dark: '#231F20', light: '#FFFFFF' } })
      .then(setQr)
      .catch(() => {});
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(JOIN_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('複製這個連結：', JOIN_URL);
    }
  }

  return (
    <section className="admin-join">
      {qr && <img className="admin-join__qr" src={qr} alt="參加互動的 QR Code" />}
      <div className="admin-join__body">
        <h2>參加連結</h2>
        <p>訪客掃 QR 或點這個連結，會在 LINE 裡打開種植頁；種下的植物幾秒內就會出現在投影牆上。</p>
        <code className="admin-join__url">{JOIN_URL}</code>
        <div className="admin-join__actions">
          <button type="button" onClick={copy}>
            {copied ? '已複製' : '複製連結'}
          </button>
          {qr && (
            <a className="admin-join__button" href={qr} download="rinan-join-qr.png">
              下載 QR（PNG）
            </a>
          )}
          <a className="admin-join__button" href="#/wall" target="_blank" rel="noreferrer">
            開啟投影牆
          </a>
          <a className="admin-join__button" href="#/kiosk" target="_blank" rel="noreferrer">
            開啟現場平板
          </a>
        </div>
      </div>
    </section>
  );
}

function Stat({ value, label }) {
  return (
    <div>
      <span className="admin-page__stat-value">{value ?? '—'}</span>
      <span>{label}</span>
    </div>
  );
}

function Dashboard({ token, onLogout }) {
  const [recent, setRecent] = useState([]);
  const [visits, setVisits] = useState(null);
  const [lineStats, setLineStats] = useState(null);
  const [plantingStats, setPlantingStats] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const handleError = useCallback(
    (err) => {
      if (err.status === 401) onLogout();
      else setError(err.message);
    },
    [onLogout]
  );

  const refresh = useCallback(async () => {
    try {
      const [recentData, visitData, lineData, plantingData] = await Promise.all([
        api.recentPlantings(token),
        api.visitStats(token),
        api.lineUserStats(token),
        api.plantingStats(token),
      ]);
      setRecent(recentData.plantings);
      setVisits(visitData);
      setLineStats(lineData);
      setPlantingStats(plantingData);
      setError(null);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [token, handleError]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      await api.downloadPlantingsCsv(token);
    } catch (err) {
      handleError(err);
    } finally {
      setExporting(false);
    }
  }

  // 下架／恢復：先在畫面上改好，失敗再改回來；投影牆會在 10 秒內跟著更新。
  async function toggle(item) {
    const hide = item.status === 'approved';
    setBusyId(item.id);
    setRecent((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: hide ? 'rejected' : 'approved' } : p)));
    try {
      await (hide ? api.hidePlanting(item.id, token) : api.showPlanting(item.id, token));
      setPlantingStats((s) => s && { ...s, onWall: s.onWall + (hide ? -1 : 1), hidden: s.hidden + (hide ? 1 : -1) });
    } catch (err) {
      setRecent((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: item.status } : p)));
      handleError(err);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page admin-page">
      <header className="admin-page__header">
        <h1>後台管理</h1>
        <button type="button" onClick={onLogout}>
          登出
        </button>
      </header>

      <JoinLinkPanel />

      <h2 className="admin-page__section-title">投影牆</h2>
      <section className="admin-page__stats">
        <Stat value={plantingStats?.onWall} label="牆上植株" />
        <Stat value={plantingStats?.hidden} label="已下架" />
        <Stat value={visits?.today} label="今日來訪" />
      </section>

      <h2 className="admin-page__section-title">整體參與（LINE ＋ 平板 Kiosk 合計）</h2>
      <section className="admin-page__stats">
        <Stat value={plantingStats?.totalInteractions} label="人次（種植總筆數）" />
        <Stat value={plantingStats?.uniqueParticipants} label="人數（不重複參與者）" />
        <Stat value={visits?.total} label="累積來訪" />
      </section>

      <h2 className="admin-page__section-title">LINE 使用者（去重留存）</h2>
      <section className="admin-page__stats">
        <Stat value={lineStats?.total} label="累積不重複人數" />
        <Stat value={lineStats?.newToday} label="今日新朋友" />
        <Stat value={lineStats?.returning} label="回訪人數" />
      </section>

      <div className="admin-page__export-row">
        <button type="button" onClick={handleExport} disabled={exporting}>
          {exporting ? '下載中…' : '下載原始名單 CSV'}
        </button>
      </div>

      {error && <p className="page__error">{error}</p>}

      <h2 className="admin-page__section-title">最新種下（種下就直接上牆，看到不妥的按「下架」）</h2>
      {loading ? (
        <p>載入中…</p>
      ) : recent.length === 0 ? (
        <p>還沒有人種下。</p>
      ) : (
        <ul className="admin-page__list">
          {recent.map((item) => {
            const hidden = item.status !== 'approved';
            return (
              <li key={item.id} className={`admin-page__item${hidden ? ' is-hidden' : ''}`}>
                <div>
                  <strong>
                    {plantById(item.plant_type)?.name}
                    {item.display_name && `｜${item.display_name}`}
                  </strong>
                  <span className="admin-page__source-badge">{item.source === 'kiosk' ? '平板' : 'LINE'}</span>
                  <span className={`admin-page__status${hidden ? ' is-hidden' : ''}`}>{hidden ? '已下架' : '牆上'}</span>
                  <p>{item.message || '（沒有留言）'}</p>
                  <time>{new Date(item.created_at).toLocaleString('zh-TW')}</time>
                </div>
                <div className="admin-page__actions">
                  <button
                    type="button"
                    className={hidden ? '' : 'admin-page__hide'}
                    disabled={busyId === item.id}
                    onClick={() => toggle(item)}
                  >
                    {hidden ? '恢復' : '下架'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
