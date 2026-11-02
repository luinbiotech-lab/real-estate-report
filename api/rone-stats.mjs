import { allowedOrigin, fail, sendJson } from './_lib/providerProxy.mjs';
import { RONE_OPS, buildRoneUrl, parseRoneResponse } from './_lib/roneStats.mjs';

/*
 * Read-only server proxy for 한국부동산원 R-ONE 부동산통계 Open API (owner request 2026-11-03).
 * The key (RONE_API_KEY) stays on the server; the browser and logs never see it. Only whitelisted operations
 * (table list / items / data) and whitelisted parameters are forwarded. R-ONE has no CORS, so a proxy is required.
 */
export default async function handler(request, response) {
  const origin = allowedOrigin(request);
  if (origin === null) return fail(response, 403, 'ORIGIN_NOT_ALLOWED', '허용되지 않은 origin입니다.');
  if (request.method !== 'GET') return fail(response, 405, 'METHOD_NOT_ALLOWED', 'GET 요청만 지원합니다.', origin);
  const params = new URL(request.url || '/', 'https://vercel.invalid').searchParams;
  const op = params.get('op') || '';
  if (!RONE_OPS[op]) return fail(response, 400, 'INVALID_OP', `op는 ${Object.keys(RONE_OPS).join(', ')} 중 하나여야 합니다.`, origin);
  const key = String(process.env.RONE_API_KEY || '').trim();
  let url;
  try {
    url = buildRoneUrl(op, params, key);
  } catch (error) {
    return fail(response, 400, 'INVALID_REQUEST', error instanceof Error ? error.message : String(error), origin);
  }
  try {
    const upstream = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const parsed = parseRoneResponse(op, upstream.status, await upstream.text());
    return sendJson(response, parsed.ok ? 200 : 502, { ...parsed, keyConfigured: Boolean(key), source: '한국부동산원 R-ONE 부동산통계정보 Open API' }, origin);
  } catch (error) {
    return fail(response, 502, 'RONE_UNAVAILABLE', error instanceof Error ? error.message : 'R-ONE 요청 실패', origin);
  }
}
