import http from 'node:http';
import { serverEnv } from './env.mjs';

const HOST = serverEnv.mapProxyHost;
const PORT = serverEnv.mapProxyPort;
const NAVER_GEOCODE = 'https://maps.apigw.ntruss.com/map-geocode/v2/geocode';
const NAVER_STATIC = 'https://maps.apigw.ntruss.com/map-static/v2/raster';
const KAKAO_BASE = 'https://dapi.kakao.com';

function corsHeaders(origin) {
  if (!origin) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '600',
    'vary': 'Origin',
  };
}

function securityHeaders(origin) {
  return {
    ...corsHeaders(origin),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  };
}

const json = (response, status, body, origin) => {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...securityHeaders(origin) });
  response.end(JSON.stringify(body));
};
const fail = (response, status, code, message, origin) => json(response, status, { code, message }, origin);
const naverConfigured = () => Boolean(serverEnv.naverClientId && serverEnv.naverClientSecret);
const kakaoConfigured = () => Boolean(serverEnv.kakaoRestApiKey);
const naverHeaders = () => ({ 'x-ncp-apigw-api-key-id': serverEnv.naverClientId, 'x-ncp-apigw-api-key': serverEnv.naverClientSecret });
const kakaoHeaders = () => ({ Authorization: `KakaoAK ${serverEnv.kakaoRestApiKey}` });

async function relayJson(upstream, response, provider, origin) {
  const text = await upstream.text();
  if (!upstream.ok) {
    const auth = upstream.status === 401 || upstream.status === 403;
    return fail(response, upstream.status, auth ? 'AUTH_FAILED' : 'UPSTREAM_FAILED', auth ? `${provider} 인증에 실패했습니다.` : `${provider} 요청에 실패했습니다. (${upstream.status})`, origin);
  }
  response.writeHead(200, { 'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8', ...securityHeaders(origin) });
  response.end(text);
}

async function geocode(url, response, origin) {
  const query = url.searchParams.get('query')?.trim();
  if (!query) return fail(response, 400, 'INVALID_REQUEST', '검색할 주소가 필요합니다.', origin);
  if (url.searchParams.get('provider') === 'kakao') {
    if (!kakaoConfigured()) return fail(response, 503, 'API_NOT_CONFIGURED', 'Kakao REST API 설정이 없습니다.', origin);
    const upstream = await fetch(`${KAKAO_BASE}/v2/local/search/address.json?${new URLSearchParams({ query, size: url.searchParams.get('size') || '10' })}`, { headers: kakaoHeaders() });
    return relayJson(upstream, response, 'Kakao', origin);
  }
  if (!naverConfigured()) return fail(response, 503, 'API_NOT_CONFIGURED', 'NAVER Maps API 설정이 없습니다.', origin);
  const upstream = await fetch(`${NAVER_GEOCODE}?${new URLSearchParams({ query })}`, { headers: naverHeaders() });
  return relayJson(upstream, response, 'NAVER Geocoding', origin);
}

async function staticMap(url, response, origin) {
  const latitude = Number(url.searchParams.get('latitude'));
  const longitude = Number(url.searchParams.get('longitude'));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return fail(response, 400, 'INVALID_REQUEST', '유효한 위도와 경도가 필요합니다.', origin);
  if (url.searchParams.get('provider') === 'kakao') {
    if (!kakaoConfigured()) return fail(response, 503, 'API_NOT_CONFIGURED', 'Kakao REST API 설정이 없습니다.', origin);
    const location = `${longitude},${latitude}`;
    const params = new URLSearchParams({ center: location, markers: `location:${location}|option:false`, size: '800x450', format: 'png', scale: '1', lv: '4', logo_pos: 'BOTTOM_RIGHT' });
    const upstream = await fetch(`${KAKAO_BASE}/v2/maps/staticmap?${params}`, { headers: kakaoHeaders() });
    if (!upstream.ok) return relayJson(upstream, response, 'Kakao Static Map', origin);
    response.writeHead(200, { 'content-type': upstream.headers.get('content-type') || 'image/png', ...securityHeaders(origin) });
    response.end(Buffer.from(await upstream.arrayBuffer()));
    return;
  }
  if (!naverConfigured()) return fail(response, 503, 'API_NOT_CONFIGURED', 'NAVER Maps API 설정이 없습니다.', origin);
  const position = `${longitude} ${latitude}`;
  const params = new URLSearchParams({ crs: 'EPSG:4326', w: '800', h: '450', center: `${longitude},${latitude}`, level: '16', maptype: 'basic', format: 'png', scale: '1', lang: 'ko', markers: `type:d|size:mid|color:red|pos:${position}` });
  const upstream = await fetch(`${NAVER_STATIC}?${params}`, { headers: naverHeaders() });
  if (!upstream.ok) return relayJson(upstream, response, 'NAVER Static Map');
  response.writeHead(200, { 'content-type': upstream.headers.get('content-type') || 'image/png', ...securityHeaders(origin) });
  response.end(Buffer.from(await upstream.arrayBuffer()));
}

async function poiSearch(url, response, origin) {
  if (!kakaoConfigured()) return fail(response, 503, 'API_NOT_CONFIGURED', 'Kakao REST API 설정이 없습니다.', origin);
  const mode = url.searchParams.get('mode') === 'category' ? 'category' : 'keyword';
  const allowed = ['query', 'x', 'y', 'radius', 'sort', 'size', 'category_group_code'];
  const params = new URLSearchParams();
  for (const key of allowed) { const value = url.searchParams.get(key); if (value) params.set(key, value); }
  if (mode === 'keyword' && !params.get('query')) return fail(response, 400, 'INVALID_REQUEST', '검색어가 필요합니다.', origin);
  if (mode === 'category' && !params.get('category_group_code')) return fail(response, 400, 'INVALID_REQUEST', '카테고리 코드가 필요합니다.', origin);
  const upstream = await fetch(`${KAKAO_BASE}/v2/local/search/${mode}.json?${params}`, { headers: kakaoHeaders() });
  return relayJson(upstream, response, 'Kakao POI', origin);
}

const server = http.createServer(async (request, response) => {
  let allowedOrigin;
  try {
    const origin = typeof request.headers.origin === 'string' ? request.headers.origin : '';
    if (origin) {
      const normalizedOrigin = new URL(origin).origin;
      if (!serverEnv.mapProxyAllowedOrigins.includes(normalizedOrigin)) {
        return fail(response, 403, 'ORIGIN_NOT_ALLOWED', '허용되지 않은 origin입니다.');
      }
      allowedOrigin = normalizedOrigin;
    }

    if (request.method === 'OPTIONS') {
      response.writeHead(204, securityHeaders(allowedOrigin));
      response.end();
      return;
    }

    const url = new URL(request.url || '/', `http://${request.headers.host || `${HOST}:${PORT}`}`);
    if (request.method !== 'GET') return fail(response, 405, 'METHOD_NOT_ALLOWED', 'GET 요청만 지원합니다.', allowedOrigin);
    if (url.pathname === '/api/status') return json(response, 200, {
      naverConfigured: naverConfigured(),
      kakaoConfigured: kakaoConfigured(),
      allowedOriginCount: serverEnv.mapProxyAllowedOrigins.length,
    }, allowedOrigin);
    if (url.pathname === '/api/maps/geocode') return await geocode(url, response, allowedOrigin);
    if (url.pathname === '/api/maps/static') return await staticMap(url, response, allowedOrigin);
    if (url.pathname === '/api/poi/search') return await poiSearch(url, response, allowedOrigin);
    return fail(response, 404, 'NOT_FOUND', '지원하지 않는 API 경로입니다.', allowedOrigin);
  } catch (error) {
    const message = error instanceof TypeError ? '외부 지도 API에 연결할 수 없습니다.' : 'API proxy 처리 중 오류가 발생했습니다.';
    fail(response, 502, 'PROXY_UPSTREAM_UNAVAILABLE', message, allowedOrigin);
  }
});

server.listen(PORT, HOST, () => console.log(`[map-proxy] http://${HOST}:${PORT} (NAVER: ${naverConfigured() ? 'configured' : 'missing'}, Kakao: ${kakaoConfigured() ? 'configured' : 'missing'}, allowedOrigins: ${serverEnv.mapProxyAllowedOrigins.length})`));
