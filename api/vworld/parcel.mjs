import { timingSafeEqual } from 'node:crypto';
import { beginRequest, requestSearchParams, sendJson } from '../_lib/providerProxy.mjs';

const VWORLD_DATA_URL = 'https://api.vworld.kr/req/data';
const PARCEL_LAYER = 'LP_PA_CBND_BUBUN';
const PNU_PATTERN = /^[0-9]{19}$/;
const DEFAULT_DOMAIN = 'https://real-estate-report.vercel.app';

function validPilotToken(request) {
  const expected = process.env.VWORLD_PROXY_ACCESS_TOKEN || '';
  const received = request.headers?.['x-daon-vworld-pilot-token'];
  if (expected.length < 32 || typeof received !== 'string' || received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}


// Prototype endpoint: private VWorld key remains in the serverless runtime.
// A Production rollout must additionally review authentication, quota/rate limits,
// provider terms, registered domain constraints and official provenance.
export default async function handler(request, response) {
  // Restrict pilot to Vercel Preview; never expose a paid-provider proxy in Production.
  if (process.env.VERCEL_ENV !== 'preview' || process.env.VWORLD_PROXY_ENABLED !== 'true') {
    return sendJson(response, 404, { code: 'NOT_FOUND', message: '지원하지 않는 API 경로입니다.' });
  }
  if (!validPilotToken(request)) {
    return sendJson(response, 401, { code: 'UNAUTHORIZED', message: 'Pilot 접근 권한이 없습니다.' });
  }
  const state = beginRequest(request, response);
  if (state.handled) return;

  const params = requestSearchParams(request);
  const pnu = (params.get('pnu') || '').trim();
  if (!PNU_PATTERN.test(pnu)) {
    return sendJson(response, 400, { code: 'INVALID_PNU', message: '19자리 숫자 PNU가 필요합니다.' }, state.origin);
  }

  const key = process.env.VWORLD_API_KEY;
  if (!key) {
    return sendJson(response, 503, { code: 'API_NOT_CONFIGURED', message: 'VWorld 연동 설정이 없습니다.' }, state.origin);
  }

  const domain = process.env.VWORLD_REGISTERED_DOMAIN || DEFAULT_DOMAIN;
  let registeredDomain;
  try {
    const parsed = new URL(domain);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
      throw new Error('INVALID_DOMAIN');
    }
    registeredDomain = parsed.origin;
  } catch {
    return sendJson(response, 503, { code: 'DOMAIN_NOT_CONFIGURED', message: 'VWorld 등록 도메인 설정을 확인하세요.' }, state.origin);
  }

  const upstreamParams = new URLSearchParams({
    service: 'data',
    request: 'GetFeature',
    version: '2.0',
    data: PARCEL_LAYER,
    key,
    domain: registeredDomain,
    format: 'json',
    attrFilter: `pnu:=:${pnu}`,
    size: '1',
    page: '1',
    geometry: 'true',
    attribute: 'true',
    crs: 'EPSG:4326',
  });

  try {
    const upstream = await fetch(`${VWORLD_DATA_URL}?${upstreamParams}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(9000),
      cache: 'no-store',
    });

    if (!upstream.ok) {
      const authError = upstream.status === 401 || upstream.status === 403;
      return sendJson(response, authError ? 502 : 502, {
        code: authError ? 'VWORLD_AUTH_FAILED' : 'VWORLD_UPSTREAM_FAILED',
        message: 'VWorld 조회에 실패했습니다.',
        upstreamStatus: upstream.status,
      }, state.origin);
    }

    const payload = await upstream.json();
    const responseData = payload?.response;
    if (!responseData || responseData.status !== 'OK') {
      return sendJson(response, 502, {
        code: 'VWORLD_RESULT_UNAVAILABLE',
        message: 'VWorld에서 정상 조회 결과를 반환하지 않았습니다.',
        providerStatus: typeof responseData?.status === 'string' ? responseData.status : 'UNKNOWN',
      }, state.origin);
    }

    const features = responseData.result?.featureCollection?.features;
    if (!Array.isArray(features)) {
      return sendJson(response, 502, { code: 'VWORLD_SCHEMA_MISMATCH', message: 'VWorld 응답 구조를 확인해야 합니다.' }, state.origin);
    }

    // Do not persist or mark attributes as verified official registry facts.
    const rows = features.slice(0, 1).map((feature) => ({
      id: typeof feature?.id === 'string' ? feature.id : null,
      geometry: feature?.geometry ?? null,
      properties: feature?.properties && typeof feature.properties === 'object' ? feature.properties : {},
    }));
    return sendJson(response, 200, {
      source: 'VWorld',
      layer: PARCEL_LAYER,
      query: { pnu },
      retrievedAt: new Date().toISOString(),
      verificationStatus: 'unverified',
      features: rows,
    }, state.origin);
  } catch {
    return sendJson(response, 502, { code: 'VWORLD_UNAVAILABLE', message: 'VWorld 연결 또는 응답 처리에 실패했습니다.' }, state.origin);
  }
}
