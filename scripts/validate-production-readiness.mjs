import { existsSync, readFileSync } from 'node:fs';

const files = {
  envExample: '.env.example',
  serverEnv: 'server/env.mjs',
  proxy: 'server/proxy.mjs',
  authProvider: 'src/services/authProviderService.ts',
  shareProvider: 'src/services/externalShareProviderService.ts',
  authMigration: 'supabase/migrations/20260916_auth_profiles_rls.sql',
  shareMigration: 'supabase/migrations/20260915_external_public_share.sql',
};

for (const file of Object.values(files)) {
  if (!existsSync(file)) throw new Error(`Production readiness 필수 파일 누락: ${file}`);
}

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readFileSync(file, 'utf8')]));

for (const key of ['NAVER_MAP_CLIENT_ID=', 'NAVER_MAP_CLIENT_SECRET=', 'KAKAO_REST_API_KEY=', 'VITE_KAKAO_JAVASCRIPT_KEY=']) {
  if (!text.envExample.includes(key)) throw new Error(`환경변수 예시 누락: ${key}`);
}
if (!text.envExample.includes('Server-only credentials. Never commit real values.')) throw new Error('서버 전용 지도 credential 보안 경계를 명시해야 합니다.');

if (!text.authProvider.includes("status: 'not_configured'") || !text.authProvider.includes('REMOTE AUTH')) throw new Error('실제 Auth backend 미연결 상태를 명시해야 합니다.');
if (!text.shareProvider.includes("status: 'not_configured'") || !text.shareProvider.includes('REMOTE / PUBLIC')) throw new Error('Remote public share 미연결 상태를 명시해야 합니다.');

if (!text.authMigration.includes('Do not apply it to GPS/Sports projects')) throw new Error('Auth migration은 부동산 전용 backend에만 적용해야 합니다.');
if (!text.authMigration.includes('Do NOT expose service_role credentials to the browser')) throw new Error('service_role browser 노출 금지 경계가 필요합니다.');
if (!text.shareMigration.includes('token_hash')) throw new Error('Remote share migration은 raw token 대신 hash 저장 설계를 유지해야 합니다.');

for (const marker of ['/api/maps/geocode', '/api/maps/static', '/api/poi/search']) {
  if (!text.proxy.includes(marker)) throw new Error(`production proxy 승격 대상 route 누락: ${marker}`);
}

const status = {
  localDevelopment: 'READY',
  authBackend: 'NOT_CONFIGURED',
  remotePublicShare: 'NOT_CONFIGURED',
  productionFrontendHost: 'MISSING_EXTERNAL_INFRA',
  protectedBackendProxy: 'MISSING_EXTERNAL_INFRA',
  productionDomainAllowlist: 'CHECK_REQUIRED',
};

console.log('Production readiness boundary: PASS');
console.log(JSON.stringify(status, null, 2));
