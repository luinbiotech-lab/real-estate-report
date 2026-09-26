import { existsSync, readFileSync } from 'node:fs';

const file = 'render.yaml';
if (!existsSync(file)) throw new Error('Render production blueprint 누락: render.yaml');
const text = readFileSync(file, 'utf8');

for (const marker of [
  'type: web',
  'runtime: docker',
  'name: daon-real-estate-report',
  'branch: feat/daon-master-code-lock',
  'region: singapore',
  'healthCheckPath: /healthz',
  'autoDeployTrigger: checksPass',
  'renderSubdomainPolicy: enabled',
  'key: FRONTEND_HOST',
  'value: 0.0.0.0',
  'key: FRONTEND_PORT',
  'key: MAP_PROXY_HOST',
  'key: MAP_PROXY_PORT',
  'key: MAP_PROXY_INTERNAL_URL',
  'key: VITE_SUPABASE_URL',
  'https://neeqcfxjwotyiodrlzvq.supabase.co',
  'key: VITE_SUPABASE_PUBLISHABLE_KEY',
  'key: VITE_KAKAO_JAVASCRIPT_KEY',
  'key: NAVER_MAP_CLIENT_ID',
  'key: NAVER_MAP_CLIENT_SECRET',
  'key: KAKAO_REST_API_KEY',
  'key: MAP_PROXY_ALLOWED_ORIGINS',
]) {
  if (!text.includes(marker)) throw new Error(`Render blueprint 계약 누락: ${marker}`);
}

for (const secretKey of [
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_KAKAO_JAVASCRIPT_KEY',
  'NAVER_MAP_CLIENT_ID',
  'NAVER_MAP_CLIENT_SECRET',
  'KAKAO_REST_API_KEY',
  'MAP_PROXY_ALLOWED_ORIGINS',
]) {
  const index = text.indexOf(`key: ${secretKey}`);
  if (index < 0) throw new Error(`Render env 누락: ${secretKey}`);
  const block = text.slice(index, index + 120);
  if (!block.includes('sync: false')) throw new Error(`Render env는 Blueprint에 값을 커밋하지 않아야 합니다: ${secretKey}`);
}

if (/sb_secret_|service_role|DAON_OWNER_BOOTSTRAP_KEY\s*:\s*\S+/.test(text)) {
  throw new Error('Render blueprint에 server/admin secret 값이 포함되어 있습니다.');
}

console.log('Render production blueprint boundary: PASS');
