import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function Layout() {
  const { user, logout } = useAuth();
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', background: '#f7f5ef', color: '#1c1713' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #ddd3c5', background: 'white' }}>
        <Link to="/" style={{ textDecoration: 'none', color: '#1c1713', fontSize: 22, fontWeight: 700 }}>薪資水瓶</Link>
        <nav style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {user && <NavLink to="/dashboard">Dashboard</NavLink>}
          {user && <NavLink to="/exploration">探索流程</NavLink>}
          {user?.roles?.includes('facilitator') && <NavLink to="/console">Console</NavLink>}
          {!user && <NavLink to="/login">登入</NavLink>}
          {!user && <NavLink to="/register">註冊</NavLink>}
          {user && <button onClick={logout}>登出</button>}
        </nav>
      </header>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
        <Outlet />
      </main>
    </div>
  );
}
