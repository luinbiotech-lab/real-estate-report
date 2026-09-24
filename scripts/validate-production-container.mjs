import { existsSync, readFileSync } from 'node:fs';

for (const file of ['Dockerfile', '.dockerignore', 'server/frontend.mjs', 'server/proxy.mjs', 'scripts/production.mjs']) {
  if (!existsSync(file)) throw new Error(`Production container 필수 파일 누락: ${file}`);
}

const dockerfile = readFileSync('Dockerfile', 'utf8');
const ignore = readFileSync('.dockerignore', 'utf8');

for (const marker of [
  'FROM node:20-bookworm-slim AS build',
  'RUN npm ci',
  'RUN npm run build && npm run scan:build-secrets',
  'FROM node:20-bookworm-slim AS runtime',
  'USER node',
  'EXPOSE 4174',
  'HEALTHCHECK',
  'CMD ["node", "scripts/production.mjs"]',
  'MAP_PROXY_HOST=127.0.0.1',
  'FRONTEND_HOST=0.0.0.0',
]) {
  if (!dockerfile.includes(marker)) throw new Error(`Production container 계약 누락: ${marker}`);
}

for (const marker of ['.env', '.env.*', 'node_modules', '.git', 'artifacts']) {
  if (!ignore.includes(marker)) throw new Error(`Docker build context 보호 누락: ${marker}`);
}

for (const forbidden of ['NAVER_MAP_CLIENT_SECRET=', 'KAKAO_REST_API_KEY=', 'SUPABASE_SERVICE_ROLE_KEY=', 'DAON_OWNER_BOOTSTRAP_KEY=']) {
  if (dockerfile.includes(forbidden)) throw new Error(`Server-only secret을 Docker build ARG/ENV로 고정하면 안 됩니다: ${forbidden}`);
}

console.log('Production container contract: PASS');
