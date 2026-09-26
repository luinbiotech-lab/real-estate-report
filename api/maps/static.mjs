import { beginRequest, requestSearchParams, staticMap } from '../_lib/providerProxy.mjs';

export default async function handler(request, response) {
  const state = beginRequest(request, response);
  if (state.handled) return;
  return staticMap(requestSearchParams(request), response, state.origin);
}
