import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getFacilitatorConsole, getMemberDashboard } from '../services/dashboard.service.js';

export const dashboardRoutes = Router();

dashboardRoutes.get('/member', requireAuth, async (req, res) => {
  const data = await getMemberDashboard(req.user.id);
  res.json(data);
});

dashboardRoutes.get('/console', requireAuth, requireRole('facilitator', 'admin'), async (req, res) => {
  const data = await getFacilitatorConsole(req.user.id);
  res.json(data);
});
