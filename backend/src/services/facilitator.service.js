import { nowIso, uuid } from '../lib/uuid.js';
import { sheetsRepo } from './sheets.service.js';

export async function grantFacilitatorAccess({ facilitatorUserId, targetUserId, sourceType = 'manual', sourceRefId = '' }) {
  const existing = await sheetsRepo.findOne(
    'facilitator_user_access',
    (row) => row.facilitator_user_id === facilitatorUserId && row.target_user_id === targetUserId,
  );
  if (existing) return existing;
  const record = {
    id: uuid(),
    facilitator_user_id: facilitatorUserId,
    target_user_id: targetUserId,
    source_type: sourceType,
    source_ref_id: sourceRefId,
    created_at: nowIso(),
  };
  await sheetsRepo.insert('facilitator_user_access', record);
  return record;
}
