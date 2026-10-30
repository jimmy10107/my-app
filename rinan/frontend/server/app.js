import express from 'express';
import { missingEnv } from './env.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { plantingsRouter } from './routes/plantings.js';
import { visitsRouter } from './routes/visits.js';
import { lineUsersRouter } from './routes/lineUsers.js';
import { kioskRouter } from './routes/kiosk.js';

// 跟網站部署在同一個 Vercel 專案（api/index.js 匯出這個 app），前端同網域呼叫 /api/*，
// 不再需要另一台主機、CORS 或 FRONTEND_URL。本機開發則由 server/dev.js 啟動。
export const app = express();

app.disable('x-powered-by');

// Vercel 的 Node runtime 會先把 body 讀完並掛成 req.body；再用 express.json() 讀一次
// 已經讀完的串流會卡住，所以只有在平台沒提供 req.body 時（本機）才自己解析。
const jsonParser = express.json({ limit: '16kb' });
app.use((req, res, next) => (Object.hasOwn(req, 'body') ? next() : jsonParser(req, res, next)));

app.use('/api/health', healthRouter);

app.use('/api', (_req, res, next) => {
  const missing = missingEnv();
  if (missing.length > 0) {
    return res.status(503).json({ error: `伺服器設定未完成，缺少環境變數：${missing.join('、')}` });
  }
  next();
});

app.use('/api/auth', authRouter);
app.use('/api/plantings', plantingsRouter);
app.use('/api/visits', visitsRouter);
app.use('/api/line-users', lineUsersRouter);
app.use('/api/kiosk', kioskRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: '找不到這個 API' });
});

app.use((err, _req, res, _next) => {
  const status = err.statusCode || err.status;
  if (status >= 400 && status < 500) {
    return res.status(status).json({ error: '請求格式錯誤' });
  }
  console.error(err);
  res.status(500).json({ error: '伺服器發生錯誤' });
});
