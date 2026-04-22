import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import { ConsolePage } from './pages/ConsolePage';
import { DashboardPage } from './pages/DashboardPage';
import { ExplorationPage } from './pages/ExplorationPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/dashboard"
              element={<ProtectedRoute><DashboardPage /></ProtectedRoute>}
            />
            <Route
              path="/exploration"
              element={<ProtectedRoute><ExplorationPage /></ProtectedRoute>}
            />
            <Route
              path="/console"
              element={<ProtectedRoute roles={['facilitator', 'admin']}><ConsolePage /></ProtectedRoute>}
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
