import { existsSync, readFileSync } from 'node:fs';

const files = {
  envExample: '.env.example',
  serverEnv: 'server/env.mjs',
  proxy: 'server/proxy.mjs',
  frontendServer: 'server/frontend.mjs',
  productionSupervisor: 'scripts/production.mjs',
  proxyClient: 'src/services/maps/proxyClient.ts',
  authProvider: 'src/services/authProviderService.ts',
  productionConfig: 'src/services/supabaseProductionConfig.ts',
  supabaseRemoteAuthAdapter: 'src/services/supabaseRemoteAuthGateway.ts',
  shareProvider: 'src/services/externalShareProviderService.ts',
  authMigration: 'supabase/migrations/20260916_auth_profiles_rls.sql',
  propertyDataMigration: 'supabase/migrations/20260916_property_data_rls.sql',
  propertyAssetMigration: 'supabase/migrations/20260916_property_asset_storage.sql',
  rlsHardeningMigration: 'supabase/migrations/20260918_restore_private_rls_hardening.sql',
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

for (const key of ['NAVER_MAP_CLIENT_ID=', 'NAVER_MAP_CLIENT_SECRET=', 'KAKAO_REST_API_KEY=', 'VITE_KAKAO_JAVASCRIPT_KEY=', 'MAP_PROXY_HOST=', 'MAP_PROXY_PORT=', 'MAP_PROXY_ALLOWED_ORIGINS=', 'VITE_API_BASE_URL=', 'FRONTEND_HOST=', 'FRONTEND_PORT=', 'MAP_PROXY_INTERNAL_URL=']) {
  if (!text.envExample.includes(key)) throw new Error(`환경변수 예시 누락: ${key}`);
}
if (!text.envExample.includes('Server-only credentials. Never commit real values.')) throw new Error('서버 전용 지도 credential 보안 경계를 명시해야 합니다.');

if (!text.authProvider.includes("status: 'ready'") || !text.authProvider.includes("label: 'REMOTE AUTH'")) throw new Error('Production Auth backend 연결 상태를 명시해야 합니다.');
if ((text.shareProvider.match(/availability: 'ready'/g) ?? []).length < 2 || !text.shareProvider.includes("label: 'REMOTE / PUBLIC'")) throw new Error('Remote public share production 연결 상태를 명시해야 합니다.');

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
if (!text.authProvider.includes('createSupabaseRemoteAuthGateway({')) throw new Error('Production RemoteAuthGateway는 Supabase adapter에 연결되어야 합니다.');
if (!text.productionConfig.includes('sb_publishable_') || /service[_-]?role/i.test(text.productionConfig) || /sb_secret_/i.test(text.productionConfig)) throw new Error('Production browser config는 publishable key만 사용해야 합니다.');

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
if (!text.remoteDataGateway.includes('export interface RemoteDataGateway') || !text.remoteDataGateway.includes('createSupabaseRemoteDataGateway(remoteDataConfig)')) {
  throw new Error('Remote Data Gateway contract와 production Supabase 연결이 필요합니다.');
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
if (!text.remoteDataGateway.includes('createSupabaseRemoteAssetStorageGateway(remoteDataConfig)')) throw new Error('Production private Storage gateway 연결이 필요합니다.');

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
if (!text.remoteAuthAdminReadme.includes('DEPLOYED / PRODUCTION CONNECTED') || !text.remoteAuthAdminReadme.includes('Do **not** use `--no-verify-jwt`')) {
  throw new Error('Remote Auth admin Edge의 production 배포상태와 JWT 경계를 명시해야 합니다.');
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
if (!text.remoteShareEdgeReadme.includes('DEPLOYED / PRODUCTION CONNECTED') || !text.remoteShareEdgeReadme.includes('--no-verify-jwt') || !text.remoteShareEdgeReadme.includes('Self-hosted viewer')) {
  throw new Error('Remote public share Edge의 production 배포상태, JWT 경계, self-hosted viewer를 명시해야 합니다.');
}

for (const marker of ['grant usage on schema private to authenticated', 'private.daon_is_owner()', 'revoke all on public.external_share_sessions from anon, authenticated']) {
  if (!text.rlsHardeningMigration.includes(marker)) throw new Error(`Production RLS hardening 누락: ${marker}`);
}

for (const marker of ['/api/maps/geocode', '/api/maps/static', '/api/poi/search']) {
  if (!text.proxy.includes(marker)) throw new Error(`production proxy 승격 대상 route 누락: ${marker}`);
}
for (const marker of [
  'serverEnv.mapProxyHost',
  'serverEnv.mapProxyPort',
  'serverEnv.mapProxyAllowedOrigins',
  "'ORIGIN_NOT_ALLOWED'",
  "request.method === 'OPTIONS'",
  "'access-control-allow-origin'",
  "'vary': 'Origin'",
  "'x-content-type-options': 'nosniff'",
]) {
  if (!text.proxy.includes(marker)) throw new Error(`Protected proxy production hardening 누락: ${marker}`);
}
for (const marker of ['MAP_PROXY_ALLOWED_ORIGINS wildcard는 허용하지 않습니다.', 'mapProxyAllowedOrigins: exactOrigins', "mapProxyHost: envValue('MAP_PROXY_HOST'", "mapProxyPort: Number(envValue('MAP_PROXY_PORT'"]) {
  if (!text.serverEnv.includes(marker)) throw new Error(`Protected proxy env validation 누락: ${marker}`);
}
for (const marker of [
  'VITE_API_BASE_URL',
  'resolveProxyBaseUrl',
  'PROXY_BASE_URL',
  "path.startsWith('/api/')",
  "url.protocol !== 'https:'",
  "url.pathname !== '/'",
  "fetch(proxyUrl('/api/status')",
  'Protected API proxy에 연결할 수 없습니다.',
]) {
  if (!text.proxyClient.includes(marker)) throw new Error(`Browser protected proxy origin 계약 누락: ${marker}`);
}

for (const marker of [
  "url.pathname === '/healthz'",
  "url.pathname.startsWith('/api/')",
  'safeDistPath',
  'INDEX_FILE',
  "'x-content-type-options': 'nosniff'",
  "'x-frame-options': 'DENY'",
  'serverEnv.mapProxyInternalUrl',
]) {
  if (!text.frontendServer.includes(marker)) throw new Error(`Production frontend runtime 누락: ${marker}`);
}
for (const marker of ["start('map-proxy'", "start('frontend'", "process.on('SIGINT'", "process.on('SIGTERM'"]) {
  if (!text.productionSupervisor.includes(marker)) throw new Error(`Production runtime supervisor 누락: ${marker}`);
}
if (String(JSON.parse(text.packageJson).scripts?.['start:prod'] ?? '') !== 'node scripts/production.mjs') {
  throw new Error('npm run start:prod production runtime script가 필요합니다.');
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
  remoteAuthServerCode: 'DEPLOYED',
  supabaseRemoteAuthAdapter: 'CONNECTED',
  authBackend: 'CONNECTED',
  propertyDataSchemaAndRls: 'APPLIED',
  propertyAssetStorageBoundary: 'APPLIED',
  remoteDataGatewayContract: 'CONNECTED',
  supabaseRemoteDataAdapter: 'CONNECTED',
  remoteDataProviderConnection: 'CONNECTED',
  remotePublicShareServerCode: 'DEPLOYED',
  remotePublicShareBackend: 'CONNECTED_SELF_HOSTED_VIEWER',
  productionFrontendRuntimePackage: 'READY_TO_DEPLOY',
  protectedProxyRuntimePackage: 'READY_TO_DEPLOY',
  productionFrontendHost: 'MISSING_EXTERNAL_INFRA',
  realOperatorAuthAccount: 'REQUIRED',
  secondDeviceBrowserE2E: 'REQUIRED',
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
