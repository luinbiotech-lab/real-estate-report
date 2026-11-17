// Passkey (얼굴·지문) login regression — 2026-11-17.
// 1) Static: password login is kept, passkey is behind VITE_DAON_PASSKEY_ENABLED, endpoints match Supabase Auth.
// 2) Behavioral: bundles the real gateway (esbuild), runs it in Chromium with a CDP *virtual authenticator*
//    (real navigator.credentials.create/get ceremony, user verification = true) against a mock Supabase Auth
//    passkey server that checks challenge, origin, type and credential id. No Supabase project, key or cost.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const gate = readFileSync('src/components/ProductionAuthGate.tsx', 'utf8');
const gateway = readFileSync('src/services/supabaseRemoteAuthGateway.ts', 'utf8');
const helper = readFileSync('src/services/passkeyWebAuthn.ts', 'utf8');
const failures = [];
const check = (ok, label) => { if (ok) console.log(`PASS ${label}`); else { console.error(`FAIL ${label}`); failures.push(label); } };

check(gate.includes("'Production 로그인'") && gate.includes('remoteAuthGateway.signIn(email, password)'), 'password login kept');
check(gate.includes('PASSKEY_FEATURE_ENABLED && browserSupportsPasskey()'), 'passkey button only when flag on and browser supports');
check(helper.includes("VITE_DAON_PASSKEY_ENABLED === 'true'"), 'passkey default off (flag)');
for (const path of ['/auth/v1/passkeys/authentication/options', '/auth/v1/passkeys/authentication/verify', '/auth/v1/passkeys/registration/options', '/auth/v1/passkeys/registration/verify']) {
  check(gateway.includes(`'${path}'`), `endpoint ${path}`);
}
check(/signInWithPasskey[\s\S]*loadProfile\(userId, tokens\.accessToken\)/.test(gateway), 'passkey sign-in enforces active profile like password');
check(!/service_role|SUPABASE_SECRET|sb_secret_/.test(gateway + helper), 'no server secret in browser code');

const bundle = await build({
  stdin: {
    contents: `import { createSupabaseRemoteAuthGateway, createMemoryRemoteAuthTokenStore } from './src/services/supabaseRemoteAuthGateway.ts';
      window.makeGateway = (url) => createSupabaseRemoteAuthGateway({ projectUrl: url, anonKey: 'sb_publishable_test_passkey_only', tokenStore: createMemoryRemoteAuthTokenStore() });`,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true, write: false, format: 'iife', platform: 'browser',
  define: { 'import.meta.env': '{}' },
  logLevel: 'silent',
});
const script = bundle.outputFiles[0].text;

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const state = { challenges: new Map(), credentials: new Map(), seq: 0 };
const USER = { id: '11111111-2222-3333-4444-555555555555', email: 'passkey-test@example.invalid' };
let origin = '';

const server = createServer(async (req, res) => {
  const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(JSON.stringify(body)); };
  let body = '';
  for await (const chunk of req) body += chunk;
  const json = body ? JSON.parse(body) : {};
  if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(`<!doctype html><meta charset="utf-8"><script>${script}</script>`); return; }
  const auth = req.headers.authorization === 'Bearer access-pw';
  if (req.url === '/auth/v1/passkeys/registration/options') {
    if (!auth) return send(401, { error_code: 'no_authorization', msg: 'no jwt' });
    const challenge = b64u(crypto.getRandomValues(new Uint8Array(32)));
    const id = `reg-${++state.seq}`;
    state.challenges.set(id, { challenge, kind: 'webauthn.create' });
    return send(200, { challenge_id: id, options: {
      challenge, rp: { id: 'localhost', name: 'DA:ON' },
      user: { id: b64u(Buffer.from(USER.id)), name: USER.email, displayName: USER.email },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      excludeCredentials: [...state.credentials.keys()].map((cid) => ({ type: 'public-key', id: cid })),
      timeout: 60000, attestation: 'none',
    } });
  }
  if (req.url === '/auth/v1/passkeys/authentication/options') {
    const challenge = b64u(crypto.getRandomValues(new Uint8Array(32)));
    const id = `auth-${++state.seq}`;
    state.challenges.set(id, { challenge, kind: 'webauthn.get' });
    return send(200, { challenge_id: id, options: { challenge, rpId: 'localhost', userVerification: 'required', timeout: 60000 } });
  }
  if (req.url === '/auth/v1/passkeys/registration/verify' || req.url === '/auth/v1/passkeys/authentication/verify') {
    const entry = state.challenges.get(json.challenge_id);
    if (!entry) return send(400, { error_code: 'webauthn_challenge_not_found', msg: 'challenge not found' });
    state.challenges.delete(json.challenge_id);
    const client = JSON.parse(Buffer.from(json.credential.response.clientDataJSON, 'base64url').toString('utf8'));
    if (client.challenge !== entry.challenge || client.type !== entry.kind || client.origin !== origin) return send(400, { error_code: 'webauthn_verification_failed', msg: 'client data mismatch' });
    if (json.credential.id !== json.credential.rawId) return send(400, { error_code: 'webauthn_verification_failed', msg: 'id/rawId mismatch' });
    if (entry.kind === 'webauthn.create') {
      if (!json.credential.response.attestationObject) return send(400, { error_code: 'webauthn_verification_failed', msg: 'no attestation' });
      if (!auth) return send(401, { error_code: 'no_authorization', msg: 'no jwt' });
      state.credentials.set(json.credential.id, USER.id);
      return send(200, { id: 'passkey-uuid-1', friendly_name: 'Virtual authenticator', created_at: new Date().toISOString() });
    }
    if (!state.credentials.has(json.credential.id)) return send(400, { error_code: 'webauthn_credential_not_found', msg: 'unknown credential' });
    if (!json.credential.response.signature || !json.credential.response.authenticatorData) return send(400, { error_code: 'webauthn_verification_failed', msg: 'no signature' });
    return send(200, { access_token: 'access-pk', refresh_token: 'refresh-pk', expires_in: 3600, token_type: 'bearer', user: USER });
  }
  if (req.url === '/auth/v1/token?grant_type=password') {
    if (json.password !== 'correct horse') return send(400, { error_code: 'invalid_credentials', error_description: 'Invalid login credentials' });
    return send(200, { access_token: 'access-pw', refresh_token: 'refresh-pw', expires_in: 3600, user: USER });
  }
  if (req.url === '/auth/v1/user') return send(200, { id: USER.id });
  if (req.url?.startsWith('/rest/v1/profiles?')) return send(200, [{ user_id: USER.id, email: USER.email, role: 'owner', is_active: true }]);
  send(404, { msg: 'not found' });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
origin = `http://localhost:${server.address().port}`;

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(origin);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true } });

  const noPasskey = await page.evaluate(async (url) => { try { await window.makeGateway(url).signInWithPasskey(); return 'signed-in'; } catch (e) { return `${e.name}:${e.message}`; } }, origin);
  check(noPasskey !== 'signed-in' && /webauthn_credential_not_found|NotAllowedError/.test(noPasskey), `sign-in before registration is refused (${noPasskey.slice(0, 80)})`);

  const result = await page.evaluate(async (url) => {
    const gw = window.makeGateway(url);
    await gw.signIn('passkey-test@example.invalid', 'correct horse');
    const registered = await gw.registerPasskey();
    let duplicate = '';
    try { await gw.registerPasskey(); } catch (e) { duplicate = `${e.name}:${e.message}`; }
    await gw.signOut().catch(() => undefined);
    const fresh = window.makeGateway(url);
    const session = await fresh.signInWithPasskey();
    return { registered, duplicate, session };
  }, origin);
  check(result.registered.id === 'passkey-uuid-1', 'register passkey after password sign-in');
  check(/InvalidStateError|webauthn_credential_exists/.test(result.duplicate), 'same device cannot register twice (excludeCredentials)');
  check(result.session.userId === USER.id && result.session.role === 'owner', 'sign in with passkey -> same user/profile');

  const { credentials } = await cdp.send('WebAuthn.getCredentials', { authenticatorId });
  check(credentials.length === 1 && credentials[0].isResidentCredential, 'one discoverable credential stored on device');

  await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: false });
  const unverified = await page.evaluate(async (url) => { try { await window.makeGateway(url).signInWithPasskey(); return 'signed-in'; } catch (e) { return `${e.name}:${e.message}`; } }, origin);
  check(unverified !== 'signed-in', `face/fingerprint failure blocks sign-in (${unverified.slice(0, 60)})`);
} finally {
  await browser.close();
  server.close();
}

if (failures.length) { console.error(`FAIL passkey login: ${failures.length}`); process.exit(1); }
console.log('PASS passkey login regression');
