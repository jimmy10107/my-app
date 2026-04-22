import { comparePassword, hashPassword } from '../lib/password.js';
import { nowIso, uuid } from '../lib/uuid.js';
import { sheetsRepo } from './sheets.service.js';

export async function registerMember({ email, password, displayName, schoolOrg = '' }) {
  const exists = await sheetsRepo.findOne('users', (row) => row.email === email);
  if (exists) {
    throw new Error('此 Email 已註冊');
  }
  const userId = uuid();
  const timestamp = nowIso();
  const passwordHash = await hashPassword(password);
  await sheetsRepo.insert('users', {
    id: userId,
    email,
    password_hash: passwordHash,
    email_verified_at: '',
    status: 'active',
    created_at: timestamp,
    updated_at: timestamp,
    last_login_at: '',
  });
  await sheetsRepo.insert('user_profiles', {
    id: uuid(),
    user_id: userId,
    display_name: displayName,
    avatar_url: '',
    phone: '',
    school_org: schoolOrg,
    note: '',
    created_at: timestamp,
    updated_at: timestamp,
  });
  await sheetsRepo.insert('user_roles', {
    id: uuid(),
    user_id: userId,
    role_code: 'member',
    role_start_at: timestamp,
    role_end_at: '',
    created_at: timestamp,
  });
  await sheetsRepo.insert('auth_identities', {
    id: uuid(),
    user_id: userId,
    provider: 'email',
    provider_uid: email,
    created_at: timestamp,
  });
  return getUserBundleById(userId);
}

export async function loginWithPassword({ email, password }) {
  const user = await sheetsRepo.findOne('users', (row) => row.email === email && row.status === 'active');
  if (!user) throw new Error('找不到此帳號');
  const matched = await comparePassword(password, user.password_hash);
  if (!matched) throw new Error('密碼錯誤');
  await sheetsRepo.updateWhere('users', (row) => row.id === user.id, (row) => ({ ...row, last_login_at: nowIso(), updated_at: nowIso() }));
  return getUserBundleById(user.id);
}

export async function getUserBundleById(userId) {
  const [user, profile, roles] = await Promise.all([
    sheetsRepo.findOne('users', (row) => row.id === userId),
    sheetsRepo.findOne('user_profiles', (row) => row.user_id === userId),
    sheetsRepo.findMany('user_roles', (row) => row.user_id === userId && !row.role_end_at),
  ]);
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    displayName: profile?.display_name || '',
    schoolOrg: profile?.school_org || '',
    roles: roles.map((role) => role.role_code),
  };
}

export async function seedFacilitator({ email, password, displayName }) {
  const existing = await sheetsRepo.findOne('users', (row) => row.email === email);
  if (existing) return getUserBundleById(existing.id);
  const user = await registerMember({ email, password, displayName, schoolOrg: 'Facilitator' });
  await sheetsRepo.insert('user_roles', {
    id: uuid(),
    user_id: user.id,
    role_code: 'facilitator',
    role_start_at: nowIso(),
    role_end_at: '',
    created_at: nowIso(),
  });
  return getUserBundleById(user.id);
}

export async function listAccessibleUsers(facilitatorUserId) {
  const grants = await sheetsRepo.findMany('facilitator_user_access', (row) => row.facilitator_user_id === facilitatorUserId);
  const targetIds = new Set(grants.map((row) => row.target_user_id));
  const users = await sheetsRepo.readAll('users');
  const profiles = await sheetsRepo.readAll('user_profiles');
  return users
    .filter((user) => targetIds.has(user.id))
    .map((user) => ({
      id: user.id,
      email: user.email,
      displayName: profiles.find((profile) => profile.user_id === user.id)?.display_name || '',
      status: user.status,
    }));
}
