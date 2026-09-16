import { existsSync, readFileSync } from 'node:fs';

const files = {
  adapter: 'src/services/supabaseRemoteAuthGateway.ts',
  provider: 'src/services/authProviderService.ts',
  adminEdge: 'supabase/functions/remote-auth-admin/index.ts',
  authMigration: 'supabase/migrations/20260916_auth_profiles_rls.sql',
};

for (const file of Object.values(files)) {
  if (!existsSync(file)) throw new Error(`Supabase remote auth adapter 필수 파일 누락: ${file}`);
}

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readFileSync(file, 'utf8')]));

for (const marker of [
  'export class SupabaseRemoteAuthGateway',
  'createSupabaseRemoteAuthGateway',
  'createMemoryRemoteAuthTokenStore',
  "'/auth/v1/token?grant_type=password'",
  "'/auth/v1/token?grant_type=refresh_token'",
  "'/auth/v1/user'",
  "'/auth/v1/logout'",
  '/rest/v1/profiles?',
  "action: 'invite_user'",
  "action: 'update_role'",
  "action: 'set_active'",
  "action: 'bootstrap_owner'",
  "action: 'list_profiles'",
  "Authorization', `Bearer ${accessToken}`",
  "cache: 'no-store'",
  "if (/service[_-]?role/i.test(key))",
  "url.protocol !== 'https:'",
]) {
  if (!text.adapter.includes(marker)) throw new Error(`Supabase remote auth adapter 계약 누락: ${marker}`);
}

for (const forbidden of [
  'SUPABASE_SERVICE_ROLE_KEY',
  'service_role:',
  'localStorage.setItem',
  'sessionStorage.setItem',
]) {
  if (text.adapter.includes(forbidden)) throw new Error(`Supabase remote auth adapter 금지 패턴 검출: ${forbidden}`);
}

if (!text.provider.includes('new NotConfiguredRemoteAuthGateway()')) {
  throw new Error('실제 backend 연결 전 기본 RemoteAuthGateway는 NotConfigured 상태를 유지해야 합니다.');
}
if (text.provider.includes('createSupabaseRemoteAuthGateway(')) {
  throw new Error('Supabase Auth adapter를 기본 provider에 자동 연결하면 안 됩니다.');
}

for (const marker of [
  "case 'bootstrap_owner'",
  "case 'invite_user'",
  "case 'update_role'",
  "case 'set_active'",
  "case 'list_profiles'",
  "throw new Error('last_active_owner_protected')",
]) {
  if (!text.adminEdge.includes(marker)) throw new Error(`Remote Auth admin Edge 계약 누락: ${marker}`);
}

for (const marker of ["default 'viewer'", 'daon_is_owner()', 'enable row level security']) {
  if (!text.authMigration.includes(marker)) throw new Error(`Auth profile/RLS migration 경계 누락: ${marker}`);
}

console.log('Prepared Supabase remote Auth adapter boundary: PASS');
