import { existsSync, readFileSync } from 'node:fs';

const files = {
  envExample: '.env.example',
  serverEnv: 'server/env.mjs',
  proxy: 'server/proxy.mjs',
  authProvider: 'src/services/authProviderService.ts',
  supabaseRemoteAuthAdapter: 'src/services/supabaseRemoteAuthGateway.ts',
  shareProvider: 'src/services/externalShareProviderService.ts',
  authMigration: 'supabase/migrations/20260916_auth_profiles_rls.sql',
  propertyDataMigration: 'supabase/migrations/20260916_property_data_rls.sql',
  propertyAssetMigration: 'supabase/migrations/20260916_property_asset_storage.sql',
  remoteDataGateway: 'src/services/remoteDataGateway.ts',
  supabaseRemoteDataAdapter: 'src/services/supabaseRemoteDataGateway.ts',
  shareMigration: 'supabase/migrations/20260915_external_public_share.sql',
  remoteAuthAdminEdge: 'supabase/functions/remote-auth-admin/index.ts',
  remoteAuthAdminReadme: 'supabase/functions/remote-auth-admin/README.md',
  remoteShareEdge: 'supabase/functions/remote-public-share/index.ts',
  remoteShareEdgeReadme: 'supabase/functions/remote-public-share/README.md',
  packageJson: 'package.json',
  packageLock: 'package-lock.json',
  excel: 'src/utils/excel.ts',
  spreadsheetSecurityDecision: 'docs/security-spreadsheet-parser.md',
};

for (const file of Object.values(files)) {
  if (!existsSync(file)) throw new Error(`Production readiness 필수 파일 누락: ${file}`);
}

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readFileSync(file, 'utf8')]));

for (const key of ['NAVER_MAP_CLIENT_ID=', 'NAVER_MAP_CLIENT_SECRET=', 'KAKAO_REST_API_KEY=', 'VITE_KAKAO_JAVASCRIPT_KEY=']) {
  if (!text.envExample.includes(key)) throw new Error(`환경변수 예시 누락: ${key}`);
}
if (!text.envExample.includes('Server-only credentials. Never commit real values.')) throw new Error('서버 전용 지도 credential 보안 경계를 명시해야 합니다.');

if (!text.authProvider.includes("status: 'not_configured'") || !text.authProvider.includes("label: 'REMOTE AUTH'")) throw new Error('실제 Auth backend 미연결 상태를 명시해야 합니다.');
if (!text.shareProvider.includes("availability: 'not_configured'") || !text.shareProvider.includes("label: 'REMOTE / PUBLIC'")) throw new Error('Remote public share 미연결 상태를 명시해야 합니다.');

for (const marker of [
  'export class SupabaseRemoteAuthGateway',
  'createSupabaseRemoteAuthGateway',
  'createMemoryRemoteAuthTokenStore',
  "'/auth/v1/token?grant_type=password'",
  "'/auth/v1/token?grant_type=refresh_token'",
  '/functions/v1/${this.adminFunctionName}',
]) {
  if (!text.supabaseRemoteAuthAdapter.includes(marker)) throw new Error(`Supabase Remote Auth adapter 준비상태 누락: ${marker}`);
}
if (!text.authProvider.includes('new NotConfiguredRemoteAuthGateway()')) throw new Error('실제 backend 연결 전 기본 RemoteAuthGateway는 미연결 상태를 유지해야 합니다.');

if (!text.authMigration.includes('Do not apply it to GPS/Sports projects')) throw new Error('Auth migration은 부동산 전용 backend에만 적용해야 합니다.');
if (!text.authMigration.includes('Do NOT expose service_role credentials to the browser')) throw new Error('service_role browser 노출 금지 경계가 필요합니다.');
if (!text.shareMigration.includes('token_hash') || !text.shareMigration.includes('snapshot_payload jsonb not null')) throw new Error('Remote share migration은 token hash + immutable snapshot payload 설계를 유지해야 합니다.');

for (const marker of [
  'create table if not exists public.properties',
  'create table if not exists public.property_objects',
  'create table if not exists public.property_verification_candidates',
  'create table if not exists public.property_verifications',
  'create table if not exists public.report_snapshots',
  'create table if not exists public.company_settings',
  'properties_delete_owner_only',
  'verification_candidates_update_verifier',
  'report_snapshots_insert_role',
]) {
  if (!text.propertyDataMigration.includes(marker)) throw new Error(`Property/Data persistence 준비상태 누락: ${marker}`);
}
for (const marker of [
  'create table if not exists public.property_assets',
  'property_assets_no_inline_binary',
  "values ('daon-property-assets', 'daon-property-assets', false, 52428800)",
  'No anon policies are created. Bucket remains private.',
]) {
  if (!text.propertyAssetMigration.includes(marker)) throw new Error(`Property asset storage 준비상태 누락: ${marker}`);
}
if (!text.remoteDataGateway.includes('export interface RemoteDataGateway') || !text.remoteDataGateway.includes('REMOTE DATA Provider가 아직 연결되지 않았습니다')) {
  throw new Error('Remote Data Gateway contract 또는 미연결 상태 표시가 필요합니다.');
}
for (const marker of [
  'export class SupabaseRemoteDataGateway',
  'export class SupabaseRemoteAssetStorageGateway',
  'createSupabaseRemoteDataGateway',
  'createSupabaseRemoteAssetStorageGateway',
  "const ASSET_BUCKET = 'daon-property-assets'",
  'getAccessToken: () => Promise<string | null>',
  'getActorId: () => Promise<string | null>',
]) {
  if (!text.supabaseRemoteDataAdapter.includes(marker)) throw new Error(`Supabase Remote Data adapter 준비상태 누락: ${marker}`);
}
if (!text.remoteDataGateway.includes('new NotConfiguredRemoteDataGateway()')) throw new Error('실제 backend 연결 전 기본 RemoteDataGateway는 미연결 상태를 유지해야 합니다.');

for (const marker of [
  "Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')",
  "Deno.env.get('DAON_OWNER_BOOTSTRAP_KEY')",
  "case 'bootstrap_owner'",
  "case 'invite_user'",
  "case 'update_role'",
  "case 'set_active'",
  "case 'list_profiles'",
  "throw new Error('bootstrap_already_completed')",
  "throw new Error('last_active_owner_protected')",
]) {
  if (!text.remoteAuthAdminEdge.includes(marker)) throw new Error(`Remote Auth admin server code 준비상태 누락: ${marker}`);
}
if (!text.remoteAuthAdminReadme.includes('PREPARED ONLY / NOT DEPLOYED') || !text.remoteAuthAdminReadme.includes('Do **not** use `--no-verify-jwt`')) {
  throw new Error('Remote Auth admin Edge는 준비됨/미배포 상태와 JWT 경계를 명시해야 합니다.');
}

for (const marker of [
  "Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')",
  "case 'issue'",
  "case 'resolve'",
  "case 'revoke'",
  "case 'add_review'",
  "const snapshot = await validateSnapshot(body.snapshot)",
]) {
  if (!text.remoteShareEdge.includes(marker)) throw new Error(`Remote public share server code 준비상태 누락: ${marker}`);
}
if (!text.remoteShareEdgeReadme.includes('PREPARED ONLY / NOT DEPLOYED') || !text.remoteShareEdgeReadme.includes('--no-verify-jwt')) {
  throw new Error('Remote public share Edge는 준비됨/미배포 상태와 배포 JWT 경계를 명시해야 합니다.');
}

for (const marker of ['/api/maps/geocode', '/api/maps/static', '/api/poi/search']) {
  if (!text.proxy.includes(marker)) throw new Error(`production proxy 승격 대상 route 누락: ${marker}`);
}

for (const marker of [
  'MAX_EXCEL_IMPORT_BYTES = 10 * 1024 * 1024',
  'hasExcelFileSignature',
  'cellFormula: false',
  'bookVBA: false',
]) {
  if (!text.excel.includes(marker)) throw new Error(`Excel upload mitigation 누락: ${marker}`);
}
for (const marker of ['CVE-2023-30533', 'CVE-2024-22363', 'RELEASE ADVISORY REVIEW REQUIRED']) {
  if (!text.spreadsheetSecurityDecision.includes(marker)) throw new Error(`Spreadsheet security decision 누락: ${marker}`);
}

const pkg = JSON.parse(text.packageJson);
const lock = JSON.parse(text.packageLock);
const lockedXlsxVersion = String(lock.packages?.['node_modules/xlsx']?.version ?? '');

function compareVersion(a, b) {
  const av = a.split('.').map((value) => Number.parseInt(value, 10) || 0);
  const bv = b.split('.').map((value) => Number.parseInt(value, 10) || 0);
  for (let i = 0; i < Math.max(av.length, bv.length); i += 1) {
    const diff = (av[i] ?? 0) - (bv[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

const spreadsheetParserDependency = !lockedXlsxVersion
  ? 'MISSING'
  : compareVersion(lockedXlsxVersion, '0.20.2') < 0
    ? 'UPGRADE_REQUIRED'
    : 'PATCHED_PINNED_REVIEW_AT_RELEASE';

if (spreadsheetParserDependency === 'MISSING' || spreadsheetParserDependency === 'UPGRADE_REQUIRED') {
  throw new Error(`Spreadsheet parser dependency 상태가 Production 기준을 충족하지 않습니다: ${spreadsheetParserDependency}`);
}

const status = {
  localDevelopment: 'READY',
  remoteAuthServerCode: 'PREPARED_NOT_DEPLOYED',
  supabaseRemoteAuthAdapter: 'PREPARED_NOT_CONNECTED',
  authBackend: 'NOT_CONFIGURED',
  propertyDataSchemaAndRls: 'PREPARED_NOT_APPLIED',
  propertyAssetStorageBoundary: 'PREPARED_NOT_APPLIED',
  remoteDataGatewayContract: 'PREPARED',
  supabaseRemoteDataAdapter: 'PREPARED_NOT_CONNECTED',
  remoteDataProviderConnection: 'NOT_CONFIGURED',
  remotePublicShareServerCode: 'PREPARED_NOT_DEPLOYED',
  remotePublicShareBackend: 'NOT_CONFIGURED',
  productionFrontendHost: 'MISSING_EXTERNAL_INFRA',
  protectedBackendProxy: 'MISSING_EXTERNAL_INFRA',
  productionDomainAllowlist: 'CHECK_REQUIRED',
  spreadsheetParserDependency,
  spreadsheetParserKnownAdvisoryFloor: '>=0.20.2',
  spreadsheetParserReleaseAdvisoryReview: 'REQUIRED',
  spreadsheetParserSpec: String(pkg.dependencies?.xlsx ?? 'MISSING'),
  spreadsheetParserLockedVersion: lockedXlsxVersion || 'MISSING',
};

console.log('Production readiness boundary: PASS');
console.log(JSON.stringify(status, null, 2));
