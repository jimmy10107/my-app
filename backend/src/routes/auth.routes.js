import { Router } from 'express';
import { signAccessToken } from '../lib/jwt.js';
import { requireAuth } from '../middleware/auth.js';
import { loginWithPassword, registerMember } from '../services/user.service.js';
import { createUsageLog } from '../services/log.service.js';

export const authRoutes = Router();

authRoutes.post('/register', async (req, res) => {
  try {
    const user = await registerMember(req.body);
    await createUsageLog({ actorType: 'user', actorUserId: user.id, actionCode: 'register' });
    const token = signAccessToken({ userId: user.id, roles: user.roles });
    res.json({ token, user });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

authRoutes.post('/login', async (req, res) => {
  try {
    const user = await loginWithPassword(req.body);
    await createUsageLog({ actorType: 'user', actorUserId: user.id, actionCode: 'login' });
    const token = signAccessToken({ userId: user.id, roles: user.roles });
    res.json({ token, user });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

authRoutes.get('/me', requireAuth, async (req, res) => {
  res.json({ user: req.user });
});
