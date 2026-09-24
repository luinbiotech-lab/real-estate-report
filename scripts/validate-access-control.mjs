import { existsSync, readFileSync } from 'node:fs';

const files = {
  app: 'src/App.tsx',
  layout: 'src/components/Layout.tsx',
  page: 'src/pages/AccessManagementPage.tsx',
  service: 'src/services/accessControlService.ts',
  provider: 'src/services/authProviderService.ts',
  migration: 'supabase/migrations/20260916_auth_profiles_rls.sql',
};

for (const file of Object.values(files)) {
  if (!existsSync(file)) throw new Error(`Access control 필수 파일 누락: ${file}`);
}

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readFileSync(file, 'utf8')]));

if (!text.app.includes('path="access"') || !text.app.includes('AccessManagementPage')) throw new Error('사용자·권한 관리 route가 필요합니다.');
if (!text.layout.includes('to="/access"') || !text.layout.includes('사용자 · 권한 관리')) throw new Error('사용자·권한 관리 navigation이 필요합니다.');

for (const role of ["'owner'", "'admin'", "'editor'", "'viewer'"]) {
  if (!text.service.includes(role)) throw new Error(`필수 역할 누락: ${role}`);
}
for (const capability of ['manage_users', 'manage_company', 'delete_property', 'finalize_report', 'manage_external_share', 'create_report_draft', 'verify_data', 'view_data']) {
  if (!text.service.includes(capability)) throw new Error(`필수 capability 누락: ${capability}`);
}
if (!text.service.includes('AUTH_BACKEND_CONNECTED = true')) throw new Error('Production Auth backend 연결 상태를 명시해야 합니다.');
if (!text.service.includes("ACCESS_STORAGE_KEY = 'daon:access-profiles:v1'")) throw new Error('버전된 local-first access policy 저장소가 필요합니다.');
if (!text.service.includes("id: 'local-owner'") || !text.service.includes("role: 'owner'")) throw new Error('최소 1개의 로컬 OWNER 정책 seed가 필요합니다.');
if (!text.service.includes("target.id === 'local-owner' && role !== 'owner'")) throw new Error('로컬 OWNER 권한 해제 차단 규칙이 필요합니다.');
if (!text.service.includes("target.id === 'local-owner' && status !== 'active'")) throw new Error('로컬 OWNER 비활성화 차단 규칙이 필요합니다.');
if (!text.service.includes("viewer: ['view_data']")) throw new Error('VIEWER는 읽기 전용으로 유지해야 합니다.');

for (const label of ['사용자 · 권한 관리', 'LOCAL POLICY READY', 'REMOTE AUTH READY', 'REMOTE AUTH SESSION', 'ROLE MATRIX', 'ACCESS PROFILES', 'AUTH PROVIDER']) {
  if (!text.page.includes(label)) throw new Error(`Access Management UI 필수 표시 누락: ${label}`);
}
if (!text.page.includes('AUTH_PROVIDER_SUMMARIES')) throw new Error('Access Management UI는 provider service에서 상태를 렌더해야 합니다.');
if (!text.page.includes('production Auth 세션과 서버 RLS가 강제합니다')) throw new Error('로컬 정책과 실제 원격 보안 경계를 구분해야 합니다.');

for (const token of ["'local_policy'", "'remote_auth'", "label: 'LOCAL POLICY'", "label: 'REMOTE AUTH'", "status: 'ready'", 'authenticatedSession', 'userInvitation', 'rlsEnforcement', 'ownerOnlyAdministration', 'multiDevicePersistence']) {
  if (!text.provider.includes(token)) throw new Error(`Auth Provider boundary 필수 항목 누락: ${token}`);
}
if (!text.provider.includes('createSupabaseRemoteAuthGateway') || !text.provider.includes('DAON_SUPABASE_PUBLISHABLE_KEY')) throw new Error('REMOTE AUTH는 browser-safe production Supabase adapter에 연결되어야 합니다.');

for (const sql of ['create table if not exists public.profiles', "'owner', 'admin', 'editor', 'viewer'", 'alter table public.profiles enable row level security', 'profiles_select_self_or_owner', 'profiles_update_owner_only', 'profiles_delete_owner_only', 'auth.uid()', 'daon_is_owner()']) {
  if (!text.migration.includes(sql)) throw new Error(`Auth/RLS migration 필수 규칙 누락: ${sql}`);
}
if (!text.migration.includes("default 'viewer'") || !text.migration.includes('Do NOT expose service_role credentials to the browser')) throw new Error('신규 사용자는 VIEWER 기본값이며 service_role 브라우저 노출 금지 규칙이 필요합니다.');
if (!text.migration.includes('Do not apply it to GPS/Sports projects')) throw new Error('부동산 전용 backend 외 프로젝트에 migration 적용 금지 경계를 명시해야 합니다.');


if (!text.page.includes('PRODUCTION SECURITY · MANUAL CHECK REQUIRED') || !text.page.includes('Leaked Password Protection') || !text.page.includes('브라우저 UI는 이 설정을 자동으로 READY 처리하지 않습니다.')) {
  throw new Error('Production Auth 수동 보안 게이트 표시가 필요합니다.');
}
for (const marker of [
  'REMOTE AUTH BACKEND CONNECTED',
  'REAL OPERATOR OWNER REQUIRED',
  'OWNER SESSION · ACCEPTANCE PENDING',
  'PRODUCTION OPERATOR ACCEPTANCE GATE',
  'MANUAL ACCEPTANCE REQUIRED',
  'PHYSICAL 2ND DEVICE',
  'E2E REQUIRED',
  'DASHBOARD CHECK',
  'Production READY가 아닙니다.',
]) {
  if (!text.page.includes(marker)) throw new Error(`실운영 OWNER/2nd-device 수동 승인 경계 누락: ${marker}`);
}
console.log('Access control policy integrity: PASS');
