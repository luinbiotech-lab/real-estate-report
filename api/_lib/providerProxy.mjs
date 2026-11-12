const NAVER_GEOCODE = 'https://maps.apigw.ntruss.com/map-geocode/v2/geocode';
const NAVER_STATIC = 'https://maps.apigw.ntruss.com/map-static/v2/raster';
const KAKAO_BASE = 'https://dapi.kakao.com';
const VWORLD_IMAGE = 'https://api.vworld.kr/req/image';

function configuredAllowedOrigins() {
  return String(process.env.MAP_PROXY_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => new URL(value).origin);
}

export function allowedOrigin(request) {
  const origin = typeof request.headers?.origin === 'string' ? request.headers.origin : '';
  if (!origin) return undefined;
  const normalized = new URL(origin).origin;
  const allowed = configuredAllowedOrigins();
  if (allowed.includes(normalized)) return normalized;

  const vercelHost = String(process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '').trim();
  if (vercelHost) {
    const candidate = vercelHost.startsWith('http') ? new URL(vercelHost).origin : `https://${vercelHost}`;
    if (normalized === candidate) return normalized;
  }
  return null;
}

export function securityHeaders(origin) {
  return {
    ...(origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  };
}

export function sendJson(response, status, body, origin) {
  response.statusCode = status;
  for (const [key, value] of Object.entries({ 'content-type': 'application/json; charset=utf-8', ...securityHeaders(origin) })) {
    response.setHeader(key, value);
  }
  response.end(JSON.stringify(body));
}

export function fail(response, status, code, message, origin) {
  sendJson(response, status, { code, message }, origin);
}

export function naverConfigured() {
  return Boolean(process.env.NAVER_MAP_CLIENT_ID && process.env.NAVER_MAP_CLIENT_SECRET);
}
export function kakaoConfigured() {
  return Boolean(process.env.KAKAO_REST_API_KEY);
}
function naverHeaders() {
  return {
    'x-ncp-apigw-api-key-id': process.env.NAVER_MAP_CLIENT_ID || '',
    'x-ncp-apigw-api-key': process.env.NAVER_MAP_CLIENT_SECRET || '',
  };
}
function kakaoHeaders() {
  return { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY || ''}` };
}

export async function relayJson(upstream, response, provider, origin) {
  const text = await upstream.text();
  if (!upstream.ok) {
    const auth = upstream.status === 401 || upstream.status === 403;
    return fail(
      response,
      upstream.status,
      auth ? 'AUTH_FAILED' : 'UPSTREAM_FAILED',
      auth ? `${provider} 인증에 실패했습니다.` : `${provider} 요청에 실패했습니다. (${upstream.status})`,
      origin,
    );
  }
  response.statusCode = 200;
  response.setHeader('content-type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
  for (const [key, value] of Object.entries(securityHeaders(origin))) response.setHeader(key, value);
  response.end(text);
}

export async function geocode(searchParams, response, origin) {
  const query = searchParams.get('query')?.trim();
  if (!query) return fail(response, 400, 'INVALID_REQUEST', '검색할 주소가 필요합니다.', origin);
  if (searchParams.get('provider') === 'kakao') {
    if (!kakaoConfigured()) return fail(response, 503, 'API_NOT_CONFIGURED', 'Kakao REST API 설정이 없습니다.', origin);
    const upstream = await fetch(`${KAKAO_BASE}/v2/local/search/address.json?${new URLSearchParams({ query, size: searchParams.get('size') || '10' })}`, { headers: kakaoHeaders() });
    return relayJson(upstream, response, 'Kakao', origin);
  }
  if (!naverConfigured()) return fail(response, 503, 'API_NOT_CONFIGURED', 'NAVER Maps API 설정이 없습니다.', origin);
  const upstream = await fetch(`${NAVER_GEOCODE}?${new URLSearchParams({ query })}`, { headers: naverHeaders() });
  return relayJson(upstream, response, 'NAVER Geocoding', origin);
}

export const vworldConfigured = () => Boolean(String(process.env.VWORLD_API_KEY || '').trim());
function vworldDomain() {
  const raw = String(process.env.VWORLD_API_DOMAIN || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'localhost').trim();
  return raw.replace(/^https?:\/\//, '').split('/')[0] || 'localhost';
}

/**
 * VWorld (국토교통부 공간정보 오픈플랫폼) 2D image API. Public map with source attribution, chosen for distributed PDF
 * reports (2026-11-11 review: NAVER static map redistribution terms not confirmed). The key stays server-side; the
 * client adds the centre marker and the "© 국토교통부 브이월드" attribution onto the image.
 */
// Only these two VWorld base maps are requested; any other value falls back to the street map.
export const VWORLD_BASEMAPS = { map: 'GRAPHIC', aerial: 'PHOTO' };
export function vworldStaticMapUrl(latitude, longitude, key = String(process.env.VWORLD_API_KEY || '').trim(), domain = vworldDomain(), layer = 'map') {
  const params = new URLSearchParams({
    service: 'image', request: 'getmap', key, domain, format: layer === 'aerial' ? 'jpeg' : 'png', basemap: VWORLD_BASEMAPS[layer] || 'GRAPHIC',
    center: `${longitude},${latitude}`, crs: 'EPSG:4326', zoom: '17', size: '800,450',
  });
  return `${VWORLD_IMAGE}?${params}`;
}

async function vworldStaticMap(latitude, longitude, response, origin, layer = 'map') {
  if (!vworldConfigured()) return fail(response, 503, 'API_NOT_CONFIGURED', 'VWorld API 설정이 없습니다.', origin);
  const upstream = await fetch(vworldStaticMapUrl(latitude, longitude, undefined, undefined, layer === 'aerial' ? 'aerial' : 'map'));
  const type = upstream.headers.get('content-type') || '';
  // VWorld reports key/domain errors as 200 with an XML/JSON body: only an image is passed through.
  if (!upstream.ok || !type.startsWith('image/')) return fail(response, 502, 'UPSTREAM_ERROR', 'VWorld 지도 이미지를 받지 못했습니다.', origin);
  response.statusCode = 200;
  response.setHeader('content-type', type);
  for (const [key, value] of Object.entries(securityHeaders(origin))) response.setHeader(key, value);
  response.end(Buffer.from(await upstream.arrayBuffer()));
}

export async function staticMap(searchParams, response, origin) {
  const latitude = Number(searchParams.get('latitude'));
  const longitude = Number(searchParams.get('longitude'));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return fail(response, 400, 'INVALID_REQUEST', '유효한 위도와 경도가 필요합니다.', origin);
  }
  if (searchParams.get('provider') === 'vworld') return vworldStaticMap(latitude, longitude, response, origin, searchParams.get('layer') === 'aerial' ? 'aerial' : 'map');
  if (!naverConfigured()) return fail(response, 503, 'API_NOT_CONFIGURED', 'NAVER Maps API 설정이 없습니다.', origin);
  const position = `${longitude} ${latitude}`;
  const params = new URLSearchParams({
    crs: 'EPSG:4326', w: '800', h: '450', center: `${longitude},${latitude}`, level: '16',
    maptype: 'basic', format: 'png', scale: '1', lang: 'ko', markers: `type:d|size:mid|color:red|pos:${position}`,
  });
  const upstream = await fetch(`${NAVER_STATIC}?${params}`, { headers: naverHeaders() });
  if (!upstream.ok) return relayJson(upstream, response, 'NAVER Static Map', origin);
  response.statusCode = 200;
  response.setHeader('content-type', upstream.headers.get('content-type') || 'image/png');
  for (const [key, value] of Object.entries(securityHeaders(origin))) response.setHeader(key, value);
  response.end(Buffer.from(await upstream.arrayBuffer()));
}

export async function poiSearch(searchParams, response, origin) {
  if (!kakaoConfigured()) return fail(response, 503, 'API_NOT_CONFIGURED', 'Kakao REST API 설정이 없습니다.', origin);
  const mode = searchParams.get('mode') === 'category' ? 'category' : 'keyword';
  const allowed = ['query', 'x', 'y', 'radius', 'sort', 'size', 'category_group_code'];
  const params = new URLSearchParams();
  for (const key of allowed) {
    const value = searchParams.get(key);
    if (value) params.set(key, value);
  }
  if (mode === 'keyword' && !params.get('query')) return fail(response, 400, 'INVALID_REQUEST', '검색어가 필요합니다.', origin);
  if (mode === 'category' && !params.get('category_group_code')) return fail(response, 400, 'INVALID_REQUEST', '카테고리 코드가 필요합니다.', origin);
  const upstream = await fetch(`${KAKAO_BASE}/v2/local/search/${mode}.json?${params}`, { headers: kakaoHeaders() });
  return relayJson(upstream, response, 'Kakao POI', origin);
}

export function beginRequest(request, response) {
  const origin = allowedOrigin(request);
  if (origin === null) {
    fail(response, 403, 'ORIGIN_NOT_ALLOWED', '허용되지 않은 origin입니다.');
    return { handled: true };
  }
  if (request.method === 'OPTIONS') {
    response.statusCode = 204;
    response.setHeader('access-control-allow-methods', 'GET, OPTIONS');
    response.setHeader('access-control-allow-headers', 'content-type');
    for (const [key, value] of Object.entries(securityHeaders(origin))) response.setHeader(key, value);
    response.end();
    return { handled: true };
  }
  if (request.method !== 'GET') {
    fail(response, 405, 'METHOD_NOT_ALLOWED', 'GET 요청만 지원합니다.', origin);
    return { handled: true };
  }
  return { handled: false, origin };
}

export function requestSearchParams(request) {
  return new URL(request.url || '/', 'https://vercel.invalid').searchParams;
}
