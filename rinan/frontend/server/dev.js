// 本機開發用：npm run dev:api（會讀同一份 .env），Vite 開發伺服器把 /api 代理到這裡。
import { app } from './app.js';

const port = Number(process.env.PORT || 4001);

app.listen(port, () => {
  console.log(`rinan api (dev) listening on http://localhost:${port}`);
});
