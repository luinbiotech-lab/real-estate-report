import { beginRequest, kakaoConfigured, naverConfigured, sendJson } from './_lib/providerProxy.mjs';

export default async function handler(request, response) {
  const state = beginRequest(request, response);
  if (state.handled) return;
  sendJson(response, 200, {
    naverConfigured: naverConfigured(),
    kakaoConfigured: kakaoConfigured(),
    publicDataConfigured: Boolean(process.env.DATA_GO_KR_SERVICE_KEY),
    allowedOriginCount: String(process.env.MAP_PROXY_ALLOWED_ORIGINS || '').split(',').map((v) => v.trim()).filter(Boolean).length,
    runtime: 'vercel-serverless',
  }, state.origin);
}
