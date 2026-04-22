import { Router } from 'express';

export const healthRoutes = Router();
healthRoutes.get('/', (_, res) => res.json({ ok: true }));
