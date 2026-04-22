import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { grantFacilitatorAccess } from '../services/facilitator.service.js';
import { listAccessibleUsers } from '../services/user.service.js';

export const facilitatorRoutes = Router();

facilitatorRoutes.use(requireAuth, requireRole('facilitator', 'admin'));

facilitatorRoutes.get('/students', async (req, res) => {
  const users = await listAccessibleUsers(req.user.id);
  res.json(users);
});

facilitatorRoutes.post('/grant-access', async (req, res) => {
  const record = await grantFacilitatorAccess({ facilitatorUserId: req.user.id, ...req.body });
  res.json(record);
});
