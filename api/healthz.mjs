import { beginRequest, sendJson } from './_lib/providerProxy.mjs';

export default async function handler(request, response) {
  const state = beginRequest(request, response);
  if (state.handled) return;
  sendJson(response, 200, {
    status: 'ok',
    frontend: true,
    proxyConfigured: true,
    runtime: 'vercel-serverless',
  }, state.origin);
}
