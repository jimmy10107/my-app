import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <div>
      <h1>薪資水瓶｜Git 部署版</h1>
      <p>此版本改為前後端分離，支援會員登入、執行師權限、Google Sheets API 對接。</p>
      <div style={{ display: 'flex', gap: 12 }}>
        <Link to="/register">開始註冊</Link>
        <Link to="/login">會員登入</Link>
        <Link to="/exploration">體驗探索流程</Link>
      </div>
    </div>
  );
}
