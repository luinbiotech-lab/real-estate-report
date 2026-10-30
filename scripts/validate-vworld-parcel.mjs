import assert from 'node:assert/strict';
import handler from '../api/vworld/parcel.mjs';

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_KEY = process.env.VWORLD_API_KEY;
const ORIGINAL_DOMAIN = process.env.VWORLD_REGISTERED_DOMAIN;
const ORIGINAL_ENV = process.env.VERCEL_ENV;
const ORIGINAL_ENABLED = process.env.VWORLD_PROXY_ENABLED;
const ORIGINAL_TOKEN = process.env.VWORLD_PROXY_ACCESS_TOKEN;
const PILOT_TOKEN = 'mock-pilot-token-0123456789-abcdefghijklmnopqrstuvwxyz';

function responseRecorder() {
  const headers = {};
  return {
    statusCode: 200,
    setHeader(name, value) { headers[name.toLowerCase()] = value; },
    end(body = '') { this.body = String(body); this.headers = headers; },
  };
}
async function call(url, token = PILOT_TOKEN) {
  const response = responseRecorder();
  await handler({ method: 'GET', url, headers: token ? { 'x-daon-vworld-pilot-token': token } : {} }, response);
  return { status: response.statusCode, body: JSON.parse(response.body) };
}
try {
  const pnu = '1165010100108150011';
  process.env.VWORLD_PROXY_ACCESS_TOKEN = PILOT_TOKEN;
  process.env.VWORLD_PROXY_ENABLED = 'true';
  process.env.VERCEL_ENV = 'preview';
  delete process.env.VWORLD_API_KEY;
  assert.equal((await call('/api/vworld/parcel?pnu=' + pnu)).status, 503);
  assert.equal((await call('/api/vworld/parcel?pnu=INVALID')).status, 400);

  process.env.VWORLD_API_KEY = 'test-key-do-not-publish';
  delete process.env.VWORLD_REGISTERED_DOMAIN;
  let requests = 0;
  assert.equal((await call('/api/vworld/parcel?pnu=' + pnu, null)).status, 401);
  process.env.VERCEL_ENV = 'production';
  assert.equal((await call('/api/vworld/parcel?pnu=' + pnu)).status, 404);
  process.env.VERCEL_ENV = 'preview';
  process.env.VWORLD_PROXY_ENABLED = 'false';
  assert.equal((await call('/api/vworld/parcel?pnu=' + pnu)).status, 404);
  process.env.VWORLD_PROXY_ENABLED = 'true';
  globalThis.fetch = async (url, options) => {
    requests += 1;
    const u = new URL(url);
    assert.equal(u.origin, 'https://api.vworld.kr');
    assert.equal(u.searchParams.get('data'), 'LP_PA_CBND_BUBUN');
    assert.equal(u.searchParams.get('attrFilter'), 'pnu:=:' + pnu);
    assert.equal(u.searchParams.get('domain'), 'https://real-estate-report.vercel.app');
    assert.equal(u.searchParams.get('key'), process.env.VWORLD_API_KEY);
    assert.ok(options.signal);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        response: { status: 'OK', result: { featureCollection: { features: [
          { id: 'parcel-1', properties: { pnu }, geometry: { type: 'Polygon', coordinates: [] } },
        ] } } },
      }),
    };
  };
  const success = await call('/api/vworld/parcel?pnu=' + pnu);
  assert.equal(success.status, 200);
  assert.equal(success.body.source, 'VWorld');
  assert.equal(success.body.verificationStatus, 'unverified');
  assert.equal(success.body.features.length, 1);
  assert.ok(!JSON.stringify(success.body).includes(process.env.VWORLD_API_KEY));
  assert.equal(requests, 1);

  globalThis.fetch = async () => ({ ok: false, status: 403 });
  const authFailure = await call('/api/vworld/parcel?pnu=' + pnu);
  assert.equal(authFailure.status, 502);
  assert.equal(authFailure.body.code, 'VWORLD_AUTH_FAILED');

  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ response: { status: 'ERROR' } }) });
  const resultFailure = await call('/api/vworld/parcel?pnu=' + pnu);
  assert.equal(resultFailure.status, 502);
  assert.equal(resultFailure.body.code, 'VWORLD_RESULT_UNAVAILABLE');
  console.log('VWorld parcel proxy mock validation PASS');
} finally {
  globalThis.fetch = ORIGINAL_FETCH;
  if (ORIGINAL_KEY === undefined) delete process.env.VWORLD_API_KEY;
  else process.env.VWORLD_API_KEY = ORIGINAL_KEY;
  if (ORIGINAL_DOMAIN === undefined) delete process.env.VWORLD_REGISTERED_DOMAIN;
  else process.env.VWORLD_REGISTERED_DOMAIN = ORIGINAL_DOMAIN;
  for (const [key, value] of [['VERCEL_ENV', ORIGINAL_ENV], ['VWORLD_PROXY_ENABLED', ORIGINAL_ENABLED], ['VWORLD_PROXY_ACCESS_TOKEN', ORIGINAL_TOKEN]]) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}
