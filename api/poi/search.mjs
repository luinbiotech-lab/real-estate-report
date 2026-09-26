import { beginRequest, poiSearch, requestSearchParams } from '../_lib/providerProxy.mjs';

export default async function handler(request, response) {
  const state = beginRequest(request, response);
  if (state.handled) return;
  return poiSearch(requestSearchParams(request), response, state.origin);
}
