import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PlayPage } from './pages/PlayPage.jsx';
import { KioskPage } from './pages/KioskPage.jsx';
import { WallPage } from './pages/WallPage.jsx';
import { AdminPage } from './pages/AdminPage.jsx';

// 用 HashRouter：現場常用單一網址在瀏覽器全螢幕開啟 /#/wall 給投影機，
// 不需要伺服器額外設定 rewrite 規則即可部署到任何靜態平台。
export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/play" replace />} />
        <Route path="/play" element={<PlayPage />} />
        <Route path="/kiosk" element={<KioskPage />} />
        <Route path="/wall" element={<WallPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </HashRouter>
  );
}
