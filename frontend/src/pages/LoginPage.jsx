import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      const user = await login(form);
      navigate(user.roles.includes('facilitator') ? '/console' : '/dashboard');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
      <h2>會員登入</h2>
      <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <input placeholder="密碼" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      {error && <div style={{ color: 'crimson' }}>{error}</div>}
      <button type="submit">登入</button>
      <small>預設執行師：facilitator@example.com / Password123!</small>
    </form>
  );
}
