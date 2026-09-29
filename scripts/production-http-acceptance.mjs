const rawBase = process.env.DAON_PRODUCTION_BASE_URL?.trim() || '';
if (!rawBase) throw new Error('DAON_PRODUCTION_BASE_URL이 필요합니다. 실제 production host 없이 acceptance smoke를 통과 처리하지 않습니다.');

const base = new URL(rawBase);
if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
  throw new Error('DAON_PRODUCTION_BASE_URL은 credential/query/hash/path 없는 HTTPS origin이어야 합니다.');
}

const apiBaseRaw = process.env.DAON_PRODUCTION_API_BASE_URL?.trim() || base.origin;
const apiBase = new URL(apiBaseRaw);
if (apiBase.protocol !== 'https:' || apiBase.username || apiBase.password || apiBase.search || apiBase.hash || apiBase.pathname !== '/') {
  throw new Error('DAON_PRODUCTION_API_BASE_URL은 credential/query/hash/path 없는 HTTPS origin이어야 합니다.');
}

async function request(url, init = {}) {
  const response = await fetch(url, { ...init, cache: 'no-store', redirect: 'error' });
  return response;
}

function requireHeader(response, name, expected) {
  const value = response.headers.get(name) || '';
  if (expected && !value.toLowerCase().includes(expected.toLowerCase())) {
    throw new Error(`${name} header가 production 기준과 다릅니다: ${value || 'MISSING'}`);
  }
  if (!value) throw new Error(`${name} header가 없습니다.`);
}

const health = await request(new URL('/healthz', base));
if (!health.ok) throw new Error(`/healthz failed: ${health.status}`);
const healthJson = await health.json();
if (healthJson.status !== 'ok' || healthJson.frontend !== true) throw new Error('/healthz payload가 올바르지 않습니다.');
requireHeader(health, 'x-content-type-options', 'nosniff');

const root = await request(base);
if (!root.ok) throw new Error(`root failed: ${root.status}`);
const rootHtml = await root.text();
if (!rootHtml.includes('id="root"')) throw new Error('Production root가 DA:ON SPA를 반환하지 않습니다.');
requireHeader(root, 'x-content-type-options', 'nosniff');
requireHeader(root, 'x-frame-options', 'deny');

const deep = await request(new URL('/property/daon-bangbae-815-11', base));
if (!deep.ok || !(deep.headers.get('content-type') || '').includes('text/html')) throw new Error('SPA deep-link fallback이 동작하지 않습니다.');
const deepHtml = await deep.text();
if (!deepHtml.includes('id="root"')) throw new Error('SPA deep-link가 index.html을 반환하지 않습니다.');

const status = await request(new URL('/api/status', apiBase));
if (!status.ok) throw new Error(`protected proxy /api/status failed: ${status.status}`);
const statusText = await status.text();
if (/service[_-]?role|sb_secret_|NAVER_MAP_CLIENT_SECRET|KAKAO_REST_API_KEY/i.test(statusText)) {
  throw new Error('/api/status 응답에 server secret 또는 secret identifier가 노출되었습니다.');
}
const statusJson = JSON.parse(statusText);
if (typeof statusJson.naverConfigured !== 'boolean' || typeof statusJson.kakaoConfigured !== 'boolean') {
  throw new Error('/api/status provider readiness payload가 올바르지 않습니다.');
}

const head = await request(base, { method: 'HEAD' });
if (!head.ok) throw new Error(`HEAD root failed: ${head.status}`);

console.log(JSON.stringify({
  productionBaseUrl: base.origin,
  productionApiBaseUrl: apiBase.origin,
  frontendHealth: 'PASS',
  spaFallback: 'PASS',
  securityHeaders: 'PASS',
  protectedProxyStatus: 'PASS',
  naverConfigured: statusJson.naverConfigured,
  kakaoConfigured: statusJson.kakaoConfigured,
}, null, 2));
console.log('External production HTTP acceptance smoke: PASS');
