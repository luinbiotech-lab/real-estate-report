import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

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

// Runtime import closure: every relative module reachable from the container entrypoint must be inside a path the
// runtime stage copies. Regression for the 2026-10 container smoke failure (server/proxy.mjs -> ../api/*.mjs was
// never copied, so the map proxy died with ERR_MODULE_NOT_FOUND and the whole runtime stopped).
const copiedRoots = [...dockerfile.matchAll(/^COPY --from=build \/app\/(\S+) \.\/(\S+)$/gm)].map((m) => normalize(m[2]));
if (!copiedRoots.length) throw new Error('Production container runtime COPY 계약을 찾을 수 없습니다.');
const isCopied = (file) => copiedRoots.some((root) => file === root || file.startsWith(`${root}/`));
const seen = new Set();
const queue = ['scripts/production.mjs', 'server/frontend.mjs', 'server/proxy.mjs'];
while (queue.length) {
  const file = normalize(queue.shift());
  if (seen.has(file)) continue;
  seen.add(file);
  if (!existsSync(file)) throw new Error(`Production runtime import 대상 파일 없음: ${file}`);
  if (!isCopied(file)) throw new Error(`Production container runtime 이미지에 복사되지 않는 모듈: ${file} (Dockerfile runtime COPY 필요)`);
  const source = readFileSync(file, 'utf8');
  const specifiers = [
    ...source.matchAll(/^\s*import\s[^'"]*?['"](\.{1,2}\/[^'"]+)['"]/gm),
    ...source.matchAll(/\bimport\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g),
    ...source.matchAll(/spawn\(process\.execPath,\s*\[\s*['"]([^'"]+\.mjs)['"]/g),
  ].map((m) => m[1]);
  for (const spec of specifiers) queue.push(spec.startsWith('.') ? join(dirname(file), spec) : spec);
}
for (const required of ['server/proxy.mjs', 'api/property-discovery.mjs']) {
  if (!seen.has(required)) throw new Error(`Runtime import closure 검사가 ${required}에 도달하지 못했습니다.`);
}

console.log('Production container contract: PASS');
