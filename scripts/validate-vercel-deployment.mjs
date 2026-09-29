import { existsSync, readFileSync } from 'node:fs';

const files = [
  'vercel.json',
  'api/_lib/providerProxy.mjs',
  'api/healthz.mjs',
  'api/status.mjs',
  'api/maps/geocode.mjs',
  'api/maps/static.mjs',
  'api/poi/search.mjs',
];
for (const file of files) if (!existsSync(file)) throw new Error(`Vercel deployment contract file missing: ${file}`);

const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
if (
  config.framework !== 'vite'
  || config.outputDirectory !== 'dist'
  || config.buildCommand !== 'VITE_REQUIRE_REMOTE_AUTH=true VITE_REMOTE_OPERATIONAL_MODE=true npm run build'
) {
  throw new Error('Vercel Vite build/output/production-mode contract mismatch.');
}
const rewrites = Array.isArray(config.rewrites) ? config.rewrites : [];
const rewriteMap = new Map(rewrites.map((row) => [row.source, row.destination]));
for (const [source, destination] of [
  ['/healthz', '/api/healthz'],
  ['/property/:path*', '/index.html'],
  ['/document/:path*', '/index.html'],
  ['/professional-report/:path*', '/index.html'],
  ['/migration-readiness', '/index.html'],
  ['/backup', '/index.html'],
]) {
  if (rewriteMap.get(source) !== destination) throw new Error(`Vercel rewrite missing: ${source} -> ${destination}`);
}
if (rewrites.some((row) => String(row.source).includes('api/') && row.destination === '/index.html')) {
  throw new Error('Vercel SPA rewrites must not shadow /api routes.');
}

const proxyText = readFileSync('api/_lib/providerProxy.mjs', 'utf8');
for (const marker of [
  'MAP_PROXY_ALLOWED_ORIGINS',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'NAVER_MAP_CLIENT_ID',
  'NAVER_MAP_CLIENT_SECRET',
  'KAKAO_REST_API_KEY',
  'ORIGIN_NOT_ALLOWED',
  'API_NOT_CONFIGURED',
]) {
  if (!proxyText.includes(marker)) throw new Error(`Vercel provider proxy marker missing: ${marker}`);
}
for (const forbidden of ['VITE_NAVER_MAP_CLIENT_SECRET', 'VITE_KAKAO_REST_API_KEY', 'VITE_SUPABASE_SERVICE_ROLE_KEY']) {
  if (proxyText.includes(forbidden)) throw new Error(`Server secret must not use VITE_ prefix: ${forbidden}`);
}

function mockResponse() {
  const headers = new Map();
  return {
    statusCode: 0,
    body: '',
    setHeader(name, value) { headers.set(String(name).toLowerCase(), String(value)); },
    end(value = '') { this.body += Buffer.isBuffer(value) ? value.toString('utf8') : String(value); },
    headers,
  };
}

const original = {
  naverId: process.env.NAVER_MAP_CLIENT_ID,
  naverSecret: process.env.NAVER_MAP_CLIENT_SECRET,
  kakao: process.env.KAKAO_REST_API_KEY,
  allowed: process.env.MAP_PROXY_ALLOWED_ORIGINS,
};
try {
  process.env.NAVER_MAP_CLIENT_ID = 'CI_NAVER_ID';
  process.env.NAVER_MAP_CLIENT_SECRET = 'CI_NAVER_SECRET';
  process.env.KAKAO_REST_API_KEY = 'CI_KAKAO_SECRET';
  process.env.MAP_PROXY_ALLOWED_ORIGINS = 'https://allowed.example';

  const { default: statusHandler } = await import('../api/status.mjs');
  const statusRes = mockResponse();
  await statusHandler({ method: 'GET', url: '/api/status', headers: {} }, statusRes);
  const status = JSON.parse(statusRes.body);
  if (statusRes.statusCode !== 200 || status.naverConfigured !== true || status.kakaoConfigured !== true || status.runtime !== 'vercel-serverless') {
    throw new Error('Vercel /api/status contract failed.');
  }
  const serialized = JSON.stringify(status);
  if (/CI_NAVER_SECRET|CI_KAKAO_SECRET/.test(serialized)) throw new Error('Vercel status leaked server secret values.');

  const { default: healthHandler } = await import('../api/healthz.mjs');
  const healthRes = mockResponse();
  await healthHandler({ method: 'GET', url: '/api/healthz', headers: {} }, healthRes);
  const health = JSON.parse(healthRes.body);
  if (healthRes.statusCode !== 200 || health.status !== 'ok' || health.frontend !== true || health.proxyConfigured !== true) {
    throw new Error('Vercel /healthz contract failed.');
  }

  const deniedRes = mockResponse();
  await statusHandler({ method: 'GET', url: '/api/status', headers: { origin: 'https://evil.example' } }, deniedRes);
  if (deniedRes.statusCode !== 403 || !deniedRes.body.includes('ORIGIN_NOT_ALLOWED')) {
    throw new Error('Vercel exact-origin boundary failed.');
  }
} finally {
  if (original.naverId === undefined) delete process.env.NAVER_MAP_CLIENT_ID; else process.env.NAVER_MAP_CLIENT_ID = original.naverId;
  if (original.naverSecret === undefined) delete process.env.NAVER_MAP_CLIENT_SECRET; else process.env.NAVER_MAP_CLIENT_SECRET = original.naverSecret;
  if (original.kakao === undefined) delete process.env.KAKAO_REST_API_KEY; else process.env.KAKAO_REST_API_KEY = original.kakao;
  if (original.allowed === undefined) delete process.env.MAP_PROXY_ALLOWED_ORIGINS; else process.env.MAP_PROXY_ALLOWED_ORIGINS = original.allowed;
}

console.log('Vercel static frontend + serverless protected proxy contract: PASS');
