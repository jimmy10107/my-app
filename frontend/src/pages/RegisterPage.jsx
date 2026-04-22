import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ displayName: '', email: '', password: '', schoolOrg: '' });
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
      <h2>會員註冊</h2>
      <input placeholder="顯示名稱" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
      <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <input placeholder="密碼" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      <input placeholder="學校/組織" value={form.schoolOrg} onChange={(e) => setForm({ ...form, schoolOrg: e.target.value })} />
      {error && <div style={{ color: 'crimson' }}>{error}</div>}
      <button type="submit">建立會員</button>
    </form>
  );
}
