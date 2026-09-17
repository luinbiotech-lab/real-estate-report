import { existsSync, readFileSync } from 'node:fs';

const files = {
  runbook: 'docs/production-connection-runbook.md',
  authMigration: 'supabase/migrations/20260916_auth_profiles_rls.sql',
  authAdminEdge: 'supabase/functions/remote-auth-admin/index.ts',
  authAdminReadme: 'supabase/functions/remote-auth-admin/README.md',
  supabaseAuthAdapter: 'src/services/supabaseRemoteAuthGateway.ts',
  browserCredential: 'src/services/supabaseBrowserCredential.ts',
  propertyDataMigration: 'supabase/migrations/20260916_property_data_rls.sql',
  propertyAssetMigration: 'supabase/migrations/20260916_property_asset_storage.sql',
  hardeningMigration: 'supabase/migrations/20260918_restore_private_rls_hardening.sql',
  remoteDataGateway: 'src/services/remoteDataGateway.ts',
  supabaseDataAdapter: 'src/services/supabaseRemoteDataGateway.ts',
  shareMigration: 'supabase/migrations/20260915_external_public_share.sql',
  remoteShareEdge: 'supabase/functions/remote-public-share/index.ts',
  remoteShareEdgeReadme: 'supabase/functions/remote-public-share/README.md',
  access: 'src/services/accessControlService.ts',
  spreadsheetSecurity: 'docs/security-spreadsheet-parser.md',
};

for (const file of Object.values(files)) {
  if (!existsSync(file)) throw new Error(`Production runbook 필수 파일 누락: ${file}`);
}

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readFileSync(file, 'utf8')]));

for (const required of [
  'GPS Tracker 또는 Sports AI Supabase 프로젝트를 재사용하지 않는다',
  '`service_role` key',
  '`sb_secret_` key',
  'legacy Supabase JWT의 `role=service_role`',
  'raw external-share token',
  '부동산 전용 Supabase/backend 프로젝트',
  'DAON_OWNER_BOOTSTRAP_KEY',
  'AUTH_ADMIN_ALLOWED_ORIGINS',
  'supabase functions deploy remote-auth-admin',
  'src/services/supabaseRemoteAuthGateway.ts',
  'src/services/supabaseBrowserCredential.ts',
  'token store는 기본 memory-only',
  '두 번째 bootstrap',
  '마지막 active OWNER',
  '신규 사용자가 기본 `viewer`',
  'Property/Data persistence + RLS',
  '20260916_property_data_rls.sql',
  '20260916_property_asset_storage.sql',
  'src/services/remoteDataGateway.ts',
  'src/services/supabaseRemoteDataGateway.ts',
  'dry-run manifest를 다시 생성하고 blocker = 0',
  'private bucket `daon-property-assets`',
  'Blob/base64/data URL',
  'local → remote → second-device',
  'record count / asset metadata / Storage object',
  '32-byte raw token',
  'SHA-256으로 hash',
  '`revoked_at`, `expires_at`, `read_only`, `allow_download`',
  'URL fragment `#token=...`',
  'Release Snapshot 발급 전',
  'tampered snapshot',
  'PUBLIC_SHARE_ALLOWED_ORIGINS',
  'supabase functions deploy remote-public-share --no-verify-jwt',
  '/api/maps/geocode',
  '/api/maps/static',
  '/api/poi/search',
  'Kakao Developers Web platform',
  'Supabase Auth Site URL / Redirect URL',
  'Spreadsheet parser release gate',
  'docs/security-spreadsheet-parser.md',
  'xlsx` locked version = `0.20.3',
  'CVE-2023-30533',
  'CVE-2024-22363',
  'node scripts/validate-excel-security.mjs',
  'Production E2E gate',
  '브라우저 secret scan',
  'Supabase browser Auth adapter: CONNECTED',
  'Supabase REST/Storage adapter: CONNECTED',
  'Remote Data Gateway: CONNECTED',
  'REMOTE / PUBLIC server code + migration: DEPLOYED',
  'REMOTE / PUBLIC backend: CONNECTED',
]) {
  if (!text.runbook.includes(required)) throw new Error(`Production runbook 필수 규칙 누락: ${required}`);
}

for (const required of [
  'DEPLOYED / PRODUCTION CONNECTED',
  'supabase functions deploy remote-auth-admin',
  'Do **not** use `--no-verify-jwt`',
  'minimum 32 characters',
  'zero active OWNER profiles',
  'last active OWNER cannot be demoted',
  'last active OWNER cannot be deactivated',
]) {
  if (!text.authAdminReadme.includes(required)) throw new Error(`Remote Auth admin 배포 계약 누락: ${required}`);
}
for (const marker of ["case 'bootstrap_owner'", "case 'invite_user'", "case 'update_role'", "case 'set_active'", "case 'list_profiles'"]) {
  if (!text.authAdminEdge.includes(marker)) throw new Error(`Remote Auth admin handler 누락: ${marker}`);
}

for (const marker of [
  'export class SupabaseRemoteAuthGateway',
  'createMemoryRemoteAuthTokenStore',
  'requireBrowserSafeSupabaseKey',
  '/functions/v1/${this.adminFunctionName}',
]) {
  if (!text.supabaseAuthAdapter.includes(marker)) throw new Error(`Supabase Auth adapter runbook 계약 누락: ${marker}`);
}
for (const marker of [
  'export function requireBrowserSafeSupabaseKey',
  '/^sb_secret_/i.test(key)',
  "role !== 'anon'",
  '/^sb_publishable_/i.test(key)',
]) {
  if (!text.browserCredential.includes(marker)) throw new Error(`Supabase browser credential runbook 계약 누락: ${marker}`);
}

for (const marker of [
  'create table if not exists public.properties',
  'properties_delete_owner_only',
  'verification_candidates_update_verifier',
  'report_snapshots_insert_role',
  'company_settings_update_owner',
]) {
  if (!text.propertyDataMigration.includes(marker)) throw new Error(`Property/Data migration 배포 계약 누락: ${marker}`);
}
for (const marker of [
  'create table if not exists public.property_assets',
  'property_assets_no_inline_binary',
  "values ('daon-property-assets', 'daon-property-assets', false, 52428800)",
  'No anon policies are created. Bucket remains private.',
]) {
  if (!text.propertyAssetMigration.includes(marker)) throw new Error(`Property asset migration 배포 계약 누락: ${marker}`);
}
if (!text.remoteDataGateway.includes('export interface RemoteDataGateway') || !text.remoteDataGateway.includes('createSupabaseRemoteDataGateway(remoteDataConfig)')) {
  throw new Error('Remote Data Gateway production 연결 계약이 필요합니다.');
}
for (const marker of [
  'export class SupabaseRemoteDataGateway',
  'export class SupabaseRemoteAssetStorageGateway',
  'requireBrowserSafeSupabaseKey',
  "const ASSET_BUCKET = 'daon-property-assets'",
]) {
  if (!text.supabaseDataAdapter.includes(marker)) throw new Error(`Supabase Data/Storage adapter runbook 계약 누락: ${marker}`);
}

for (const required of [
  'DEPLOYED / PRODUCTION CONNECTED',
  'Self-hosted viewer',
  'supabase functions deploy remote-public-share --no-verify-jwt',
  'Release Snapshot canonical/checksum/signature integrity is verified before issuance',
]) {
  if (!text.remoteShareEdgeReadme.includes(required)) throw new Error(`Remote share Edge 배포 계약 누락: ${required}`);
}
if (!text.remoteShareEdge.includes("const snapshot = await validateSnapshot(body.snapshot)")) throw new Error('Remote share issuance 전에 signed snapshot 검증이 필요합니다.');
for (const marker of ['private.daon_is_owner()', 'revoke all on public.external_share_sessions from anon, authenticated']) {
  if (!text.hardeningMigration.includes(marker)) throw new Error(`Production private RLS hardening 누락: ${marker}`);
}

for (const required of [
  'PATCHED VERSION PINNED / RELEASE ADVISORY REVIEW REQUIRED',
  '0.20.3',
  'CVE-2023-30533',
  'CVE-2024-22363',
  'actual file signature check',
]) {
  if (!text.spreadsheetSecurity.includes(required)) throw new Error(`Spreadsheet security decision 필수 규칙 누락: ${required}`);
}

if (!text.authMigration.includes("default 'viewer'")) throw new Error('Auth migration의 viewer 기본값이 유지되어야 합니다.');
if (!text.authMigration.includes('daon_is_owner()')) throw new Error('Auth migration의 OWNER enforcement가 유지되어야 합니다.');
if (!text.shareMigration.includes('token_hash')) throw new Error('External share migration의 token_hash 설계가 유지되어야 합니다.');
if (!text.shareMigration.includes('snapshot_payload jsonb not null')) throw new Error('External share migration의 immutable snapshot payload가 필요합니다.');
if (!text.shareMigration.includes('Intentionally NO anon')) throw new Error('External share table의 direct anonymous access 차단이 유지되어야 합니다.');

for (const role of ["'owner'", "'admin'", "'editor'", "'viewer'"]) {
  if (!text.access.includes(role)) throw new Error(`Access role 누락: ${role}`);
}

console.log('Production connection runbook integrity: PASS');
