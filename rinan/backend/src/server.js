import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { healthRouter } from './routes/health.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { plantingsRouter } from './routes/plantings.routes.js';
import { visitsRouter } from './routes/visits.routes.js';

const app = express();

app.use(cors({ origin: env.frontendUrl }));
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/plantings', plantingsRouter);
app.use('/api/visits', visitsRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: '伺服器發生錯誤' });
});

app.listen(env.port, () => {
  console.log(`rinan-backend listening on :${env.port}`);
});
