import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createUsageLog } from '../services/log.service.js';
import { completeExplorationSession, createSession, saveModuleRun } from '../services/module.service.js';
import { ABILITIES, CAREERS, VALUES } from '../data/defaultCards.js';

export const moduleRoutes = Router();

moduleRoutes.get('/cards', async (_, res) => {
  res.json({ careers: CAREERS, values: VALUES, abilities: ABILITIES });
});

moduleRoutes.post('/sessions', requireAuth, async (req, res) => {
  const session = await createSession({ userId: req.user.id, ...req.body });
  await createUsageLog({ actorType: 'user', actorUserId: req.user.id, actionCode: 'create_session', refId: session.id });
  res.json(session);
});

moduleRoutes.post('/runs', requireAuth, async (req, res) => {
  const saved = await saveModuleRun({ userId: req.user.id, changedByUserId: req.user.id, ...req.body });
  await createUsageLog({ actorType: 'user', actorUserId: req.user.id, actionCode: 'save_version', moduleCode: req.body.moduleCode, refId: saved.runId });
  res.json(saved);
});

moduleRoutes.post('/sessions/:sessionId/complete', requireAuth, async (req, res) => {
  const snapshot = await completeExplorationSession({ sessionId: req.params.sessionId, userId: req.user.id, payload: req.body.payload });
  await createUsageLog({ actorType: 'user', actorUserId: req.user.id, actionCode: 'snapshot_created', refId: snapshot.id });
  res.json(snapshot);
});
