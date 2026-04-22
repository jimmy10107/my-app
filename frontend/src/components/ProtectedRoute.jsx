import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function ProtectedRoute({ children, roles = [] }) {
  const { user, loading } = useAuth();
  if (loading) return <div>載入中...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles.length && !roles.some((role) => user.roles.includes(role))) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
