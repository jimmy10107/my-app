// Vercel Serverless Function：所有 /api/* 經 vercel.json 改寫到這裡，交給 Express 依原路徑分派。
import { app } from '../server/app.js';

export default app;
