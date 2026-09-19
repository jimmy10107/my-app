import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { plantById } from '../lib/plants.js';

const TOKEN_KEY = 'rinan_admin_token';

export function AdminPage() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));

  if (!token) {
    return <LoginForm onLoggedIn={(t) => { localStorage.setItem(TOKEN_KEY, t); setToken(t); }} />;
  }

  return (
    <Dashboard
      token={token}
      onLogout={() => {
        localStorage.removeItem(TOKEN_KEY);
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

function Dashboard({ token, onLogout }) {
  const [pending, setPending] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setError(null);
    try {
      const [{ plantings }, statsData] = await Promise.all([
        api.pendingPlantings(token),
        api.visitStats(token),
      ]);
      setPending(plantings);
      setStats(statsData);
    } catch (err) {
      if (err.message.includes('過期') || err.message.includes('登入')) {
        onLogout();
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleModerate(id, action) {
    try {
      await (action === 'approve' ? api.approvePlanting(id, token) : api.rejectPlanting(id, token));
      setPending((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err.message);
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

      {stats && (
        <section className="admin-page__stats">
          <div>
            <span className="admin-page__stat-value">{stats.today}</span>
            <span>今日來訪</span>
          </div>
          <div>
            <span className="admin-page__stat-value">{stats.total}</span>
            <span>累積來訪</span>
          </div>
          <div>
            <span className="admin-page__stat-value">{pending.length}</span>
            <span>待審核</span>
          </div>
        </section>
      )}

      {error && <p className="page__error">{error}</p>}

      {loading ? (
        <p>載入中…</p>
      ) : pending.length === 0 ? (
        <p>目前沒有待審核的留言。</p>
      ) : (
        <ul className="admin-page__list">
          {pending.map((item) => (
            <li key={item.id} className="admin-page__item">
              <div>
                <strong>{plantById(item.plant_type)?.name}</strong>
                <p>{item.message || '（沒有留言）'}</p>
                <time>{new Date(item.created_at).toLocaleString('zh-TW')}</time>
              </div>
              <div className="admin-page__actions">
                <button type="button" onClick={() => handleModerate(item.id, 'approve')}>
                  通過
                </button>
                <button type="button" onClick={() => handleModerate(item.id, 'reject')}>
                  退件
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
