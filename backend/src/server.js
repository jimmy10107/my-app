import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { authRoutes } from './routes/auth.routes.js';
import { dashboardRoutes } from './routes/dashboard.routes.js';
import { facilitatorRoutes } from './routes/facilitator.routes.js';
import { healthRoutes } from './routes/health.routes.js';
import { moduleRoutes } from './routes/module.routes.js';
import { sheetsRepo } from './services/sheets.service.js';
import { seedFacilitator } from './services/user.service.js';

const app = express();
app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/modules', moduleRoutes);
app.use('/api/facilitator', facilitatorRoutes);

app.get('/', (_, res) => res.json({ name: 'Salary Bottle API', status: 'ok' }));

async function bootstrap() {
  await sheetsRepo.setupWorkbook();
  await seedFacilitator({ email: 'facilitator@example.com', password: 'Password123!', displayName: '預設執行師' });
  app.listen(env.port, () => {
    console.log(`Salary Bottle API listening on ${env.port}`);
  });
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
