import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 正式環境 /api 由同一個 Vercel 專案的 Serverless Function 處理；
// 本機開發時把 /api 轉給 npm run dev:api 起的本機伺服器。
const apiProxy = { '/api': 'http://localhost:4001' };

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: apiProxy,
  },
  preview: {
    proxy: apiProxy,
  },
});
