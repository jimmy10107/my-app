import { sheetsRepo } from './sheets.service.js';

export async function getMemberDashboard(userId) {
  const [snapshots, runs, reports] = await Promise.all([
    sheetsRepo.findMany('dashboard_snapshots', (row) => row.user_id === userId),
    sheetsRepo.findMany('module_runs', (row) => row.user_id === userId),
    sheetsRepo.readAll('module_reports'),
  ]);
  const latestSnapshot = snapshots.sort((a, b) => String(b.snapshot_date).localeCompare(String(a.snapshot_date)))[0] || null;
  const latestRuns = runs
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
    .map((run) => ({
      ...run,
      report: reports.find((report) => report.id === run.latest_report_id) || null,
    }));
  return {
    latestSnapshot,
    snapshots,
    latestRuns,
    nextActions: buildNextActions(latestSnapshot),
  };
}

function buildNextActions(snapshot) {
  if (!snapshot) return ['完成第一次完整探索', '補齊價值觀排序', '建立第一份行動計畫'];
  const score = snapshot.scoring_json || {};
  const list = [];
  if ((score.clarity || 0) < 60) list.push('重新檢視 Holland Top 3 職業方向');
  if ((score.capability || 0) < 60) list.push('補做能力盤點與 gap 說明');
  if ((score.actionReadiness || 0) < 60) list.push('將行動計畫改寫成下週可執行任務');
  return list.length ? list : ['持續追蹤並建立下一次 snapshot'];
}

export async function getFacilitatorConsole(facilitatorUserId) {
  const [grants, sessions, snapshots, usageLogs, users, profiles] = await Promise.all([
    sheetsRepo.findMany('facilitator_user_access', (row) => row.facilitator_user_id === facilitatorUserId),
    sheetsRepo.readAll('sessions'),
    sheetsRepo.readAll('dashboard_snapshots'),
    sheetsRepo.readAll('usage_logs'),
    sheetsRepo.readAll('users'),
    sheetsRepo.readAll('user_profiles'),
  ]);
  const targetIds = new Set(grants.map((grant) => grant.target_user_id));
  const targetSessions = sessions.filter((session) => targetIds.has(session.user_id));
  const cases = [...targetIds].map((userId) => {
    const user = users.find((item) => item.id === userId);
    const profile = profiles.find((item) => item.user_id === userId);
    const latestSession = targetSessions
      .filter((session) => session.user_id === userId)
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0] || null;
    const latestSnapshot = snapshots
      .filter((snapshot) => snapshot.user_id === userId)
      .sort((a, b) => String(b.snapshot_date).localeCompare(String(a.snapshot_date)))[0] || null;
    const recentUsage = usageLogs.filter((log) => log.actor_user_id === userId).length;
    return {
      userId,
      displayName: profile?.display_name || user?.email || '未命名',
      email: user?.email || '',
      latestSession,
      latestSnapshot,
      recentUsage,
      riskFlags: buildRiskFlags(latestSession, latestSnapshot),
    };
  });
  return {
    summary: {
      totalStudents: cases.length,
      inProgress: cases.filter((item) => item.latestSession?.current_status === 'in_progress').length,
      highRisk: cases.filter((item) => item.riskFlags.length > 0).length,
    },
    cases,
  };
}

function buildRiskFlags(session, snapshot) {
  const flags = [];
  if (!session) flags.push('尚未開始');
  if (session?.current_status === 'in_progress') flags.push('流程未完成');
  if ((snapshot?.scoring_json?.friction || 0) > 70) flags.push('高摩擦值');
  if ((snapshot?.scoring_json?.actionReadiness || 0) < 50) flags.push('行動準備不足');
  return flags;
}
