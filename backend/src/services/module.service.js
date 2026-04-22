import { nowIso, uuid } from '../lib/uuid.js';
import { sheetsRepo } from './sheets.service.js';

function deriveCareerState(payload) {
  const chosenCareers = payload?.holland?.top3?.length || 0;
  const definedValues = Object.values(payload?.value?.definitions || {}).filter(Boolean).length;
  const actionCount = Object.values(payload?.actions || {}).filter((value) => String(value || '').trim()).length;
  if (chosenCareers >= 3 && definedValues >= 2 && actionCount >= 2) return 'autonomous';
  if (chosenCareers >= 1 && actionCount === 0) return 'anxious';
  if (!chosenCareers && !definedValues) return 'exploratory';
  return 'deferred';
}

export async function createSession({ userId = '', entryMode = 'member', sessionType = 'full_exploration', sourceChannel = 'web', facilitatorUserId = '' }) {
  const timestamp = nowIso();
  const session = {
    id: uuid(),
    user_id: userId,
    visitor_lead_id: '',
    session_type: sessionType,
    entry_mode: entryMode,
    started_at: timestamp,
    completed_at: '',
    current_status: 'in_progress',
    derived_career_state: 'exploratory',
    facilitator_user_id: facilitatorUserId,
    source_channel: sourceChannel,
    created_at: timestamp,
    updated_at: timestamp,
  };
  await sheetsRepo.insert('sessions', session);
  return session;
}

export async function saveModuleRun({ userId, sessionId = '', moduleCode, inputPayload, derivedPayload = {}, outputPayload, saveType = 'submit', changedByUserId = '' }) {
  const timestamp = nowIso();
  let run = await sheetsRepo.findOne('module_runs', (row) => row.session_id === sessionId && row.module_code === moduleCode);
  if (!run) {
    run = {
      id: uuid(),
      user_id: userId,
      visitor_lead_id: '',
      session_id: sessionId,
      module_code: moduleCode,
      run_mode: sessionId ? 'in_session' : 'standalone',
      status: 'in_progress',
      current_version_no: 0,
      latest_report_id: '',
      started_at: timestamp,
      completed_at: '',
      created_at: timestamp,
      updated_at: timestamp,
    };
    await sheetsRepo.insert('module_runs', run);
  }
  const nextVersion = Number(run.current_version_no || 0) + 1;
  const version = {
    id: uuid(),
    module_run_id: run.id,
    version_no: nextVersion,
    input_payload: inputPayload,
    derived_payload: derivedPayload,
    output_payload: outputPayload,
    save_type: saveType,
    changed_by_user_id: changedByUserId || userId,
    created_at: timestamp,
  };
  await sheetsRepo.insert('module_run_versions', version);
  const report = {
    id: uuid(),
    module_run_id: run.id,
    report_type: 'summary',
    report_title: `${moduleCode} summary`,
    report_json: outputPayload,
    report_html: '',
    report_pdf_url: '',
    visibility_scope: 'owner',
    created_at: timestamp,
  };
  await sheetsRepo.insert('module_reports', report);
  await sheetsRepo.updateWhere('module_runs', (row) => row.id === run.id, (row) => ({
    ...row,
    status: 'completed',
    current_version_no: nextVersion,
    latest_report_id: report.id,
    completed_at: timestamp,
    updated_at: timestamp,
  }));
  return { runId: run.id, version, report };
}

export async function completeExplorationSession({ sessionId, userId, payload }) {
  const timestamp = nowIso();
  const snapshot = {
    id: uuid(),
    user_id: userId,
    source_session_id: sessionId,
    snapshot_label: `本次探索 ${timestamp.slice(0, 10)}`,
    snapshot_date: timestamp,
    summary_json: payload,
    scoring_json: buildScore(payload),
    created_at: timestamp,
  };
  await sheetsRepo.insert('dashboard_snapshots', snapshot);
  await sheetsRepo.updateWhere('sessions', (row) => row.id === sessionId, (row) => ({
    ...row,
    current_status: 'completed',
    completed_at: timestamp,
    derived_career_state: deriveCareerState(payload),
    updated_at: timestamp,
  }));
  return snapshot;
}

export function buildScore(payload) {
  const hollandCount = payload?.holland?.top3?.length || 0;
  const valueCount = payload?.value?.top3?.length || 0;
  const abilityCount = payload?.ability?.possessed?.length || 0;
  const actionCount = Object.values(payload?.actions || {}).filter((value) => String(value || '').trim()).length;
  return {
    clarity: hollandCount * 20,
    valueAlignment: valueCount * 20,
    capability: Math.min(100, abilityCount * 15),
    actionReadiness: Math.min(100, actionCount * 25),
    friction: Math.max(0, 100 - actionCount * 20 - valueCount * 10),
    completeness: Math.min(100, hollandCount * 20 + valueCount * 15 + actionCount * 15),
  };
}
