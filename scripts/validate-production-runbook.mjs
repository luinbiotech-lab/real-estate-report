import { existsSync, readFileSync } from 'node:fs';

const files = {
  runbook: 'docs/production-connection-runbook.md',
  authMigration: 'supabase/migrations/20260916_auth_profiles_rls.sql',
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
  'raw external-share token',
  '부동산 전용 Supabase/backend 프로젝트',
  '최초 1명만 `owner`로 승격',
  '신규 사용자가 기본 `viewer`',
  'Property/Data RLS expansion',
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
  'REMOTE AUTH: NOT CONFIGURED',
  'REMOTE / PUBLIC server code + migration: PREPARED / NOT DEPLOYED',
  'REMOTE / PUBLIC backend connection: NOT CONFIGURED',
]) {
  if (!text.runbook.includes(required)) throw new Error(`Production runbook 필수 규칙 누락: ${required}`);
}

for (const required of [
  'PREPARED ONLY / NOT DEPLOYED',
  'supabase functions deploy remote-public-share --no-verify-jwt',
  'Release Snapshot canonical/checksum/signature integrity is verified before issuance',
]) {
  if (!text.remoteShareEdgeReadme.includes(required)) throw new Error(`Remote share Edge 배포 계약 누락: ${required}`);
}
if (!text.remoteShareEdge.includes("const snapshot = await validateSnapshot(body.snapshot)")) throw new Error('Remote share issuance 전에 signed snapshot 검증이 필요합니다.');

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
