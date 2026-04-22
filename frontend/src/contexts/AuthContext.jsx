import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('salary_bottle_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api('/auth/me')
      .then((result) => setUser(result.user))
      .catch(() => localStorage.removeItem('salary_bottle_token'))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    async login(payload) {
      const result = await api('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
      localStorage.setItem('salary_bottle_token', result.token);
      setUser(result.user);
      return result.user;
    },
    async register(payload) {
      const result = await api('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
      localStorage.setItem('salary_bottle_token', result.token);
      setUser(result.user);
      return result.user;
    },
    logout() {
      localStorage.removeItem('salary_bottle_token');
      setUser(null);
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
