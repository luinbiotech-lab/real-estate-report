import { existsSync, readFileSync } from 'node:fs';

const checklist = 'docs/production-connection-checklist.md';
if (!existsSync(checklist)) throw new Error(`Production connection checklist 누락: ${checklist}`);

const text = readFileSync(checklist, 'utf8');

for (const required of [
  'Deployment Readiness Package',
  '기존 GPS Tracker / Sports-AI Supabase 프로젝트를 재사용하지 않는다',
  '`service_role`, `sb_secret_`',
  'legacy JWT는 payload의 `role=anon`만 browser-safe로 인정',
  '`role=service_role`은 거부',
  'blocker 0',
  'Controlled Execution',
  'second-device',
  'record count reconciliation',
  'VIEWER read 허용 / write·delete 차단',
  'EDITOR verification approval 차단',
  'ADMIN property delete/company settings write 차단',
  'OWNER property delete/company settings write 허용',
  'private bucket public 직접 접근 차단',
  '50 MiB hard cap',
  '`xlsx` locked version = `0.20.3`',
  'PATCHED_PINNED_REVIEW_AT_RELEASE',
  'CVE-2023-30533',
  'CVE-2024-22363',
  'browser bundle/source map secret scan',
  'Production E2E',
  'GitHub Actions 전체 PASS',
  'REMOTE AUTH server + browser adapter = CONNECTED',
  'Property/Data schema + RLS = APPLIED',
  'REMOTE DATA adapter = CONNECTED',
  'REMOTE / PUBLIC server + self-hosted viewer = CONNECTED',
  'real operator OWNER account = REQUIRED',
  'production runtime package = READY_TO_DEPLOY',
  'npm run start:prod',
  'VITE_API_BASE_URL',
  'MAP_PROXY_ALLOWED_ORIGINS',
  '/healthz',
  '/api/status',
]) {
  if (!text.includes(required)) throw new Error(`Production connection checklist 필수 규칙 누락: ${required}`);
}

for (const stale of [
  'xlsx@0.18.5',
  'spreadsheetParserDependency = UPGRADE_REQUIRED',
  'dependency upgrade 완료',
]) {
  if (text.includes(stale)) throw new Error(`Production connection checklist 과거 상태 잔존: ${stale}`);
}

console.log('Production connection checklist integrity: PASS');
