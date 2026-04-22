import { sheetsRepo } from './sheets.service.js';
import { nowIso, uuid } from '../lib/uuid.js';

export async function createUsageLog({ actorType, actorUserId = '', visitorLeadId = '', actionCode, moduleCode = '', refId = '', payload = {} }) {
  return sheetsRepo.insert('usage_logs', {
    id: uuid(),
    actor_type: actorType,
    actor_user_id: actorUserId,
    visitor_lead_id: visitorLeadId,
    action_code: actionCode,
    module_code: moduleCode,
    ref_id: refId,
    payload,
    created_at: nowIso(),
  });
}
