// Issue #6 regression: native fetch must never be stored unbound and called as a method.
// WebKit throws "Can only call Window.fetch on instances of Window" for `this.fetchImpl = fetch; this.fetchImpl(...)`.
// 1) static scan of src/ for unbound native fetch references, 2) gateways use resolveBrowserFetch,
// 3) runtime test of resolveBrowserFetch against a strict-receiver fetch that mimics WebKit.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE_ROOT = 'src';
const HELPER = 'src/services/browserFetch.ts';
const GATEWAYS = ['src/services/supabaseRemoteAuthGateway.ts', 'src/services/supabaseRemoteDataGateway.ts'];

// --- 1. Static scan --------------------------------------------------------------------------------------------
// An unbound reference is `fetch` used as a value (assigned, defaulted, passed, returned, destructured) rather than
// called. `typeof fetch` (type position) and `fetch(` (direct global call, receiver is the global) are fine.
const UNBOUND = [
  /(?:\?\?|\|\||[=:,(]|\breturn)\s*(?:globalThis\.|window\.|self\.)?fetch\s*(?=[;,)}\]\n]|$)/m,
  /\{\s*(?:[\w$]+\s*,\s*)*fetch\s*(?:,[^}]*)?\}\s*=\s*(?:globalThis|window|self)\b/,
  /(?:globalThis|window|self)\.fetch\.bind\s*\(\s*(?!globalThis|window|self)/,
];
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx|js|mjs)$/.test(name) ? [path] : [];
});
const offenders = [];
for (const file of walk(SOURCE_ROOT)) {
  readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
    const code = line.replace(/\/\/.*$/, '');
    if (/typeof\s+fetch/.test(code) && !/\?\?\s*fetch|=\s*fetch\s*;/.test(code)) return;
    if (UNBOUND.some((pattern) => pattern.test(code))) offenders.push(`${file}:${index + 1}: ${line.trim()}`);
  });
}
assert.deepEqual(offenders, [], `Unbound native fetch reference(s) — WebKit will throw. Use resolveBrowserFetch():\n${offenders.join('\n')}`);

// Self-check the scanner against the exact pre-fix lines so it cannot silently stop matching.
for (const bad of ['    this.fetchImpl = config.fetchImpl ?? fetch;', 'const f = fetch;', 'const client = { fetchImpl: fetch };', 'useClient(fetch)', 'const { fetch } = window;']) {
  assert.ok(UNBOUND.some((pattern) => pattern.test(bad)), `scanner must flag: ${bad}`);
}
for (const good of ['  fetchImpl?: typeof fetch;', 'const response = await fetch(url, init);', 'return (input, init) => globalThis.fetch(input, init);']) {
  assert.ok(!UNBOUND.some((pattern) => pattern.test(good)), `scanner must allow: ${good}`);
}

// --- 2. Gateways route through the helper ----------------------------------------------------------------------
for (const file of GATEWAYS) {
  const text = readFileSync(file, 'utf8');
  assert.ok(text.includes("import { resolveBrowserFetch } from './browserFetch';"), `${file} must import resolveBrowserFetch`);
  assert.ok(text.includes('this.fetchImpl = resolveBrowserFetch(config.fetchImpl);'), `${file} must resolve fetchImpl via resolveBrowserFetch`);
}

// --- 3. Runtime behaviour against a WebKit-like strict receiver ------------------------------------------------
async function loadHelper() {
  const source = readFileSync(HELPER, 'utf8');
  let js;
  try {
    const ts = (await import('typescript')).default;
    js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  } catch {
    const { stripTypeScriptTypes } = await import('node:module');
    if (typeof stripTypeScriptTypes !== 'function') throw new Error('Neither typescript nor node:module.stripTypeScriptTypes is available to load the helper.');
    js = stripTypeScriptTypes(source);
  }
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}

const { resolveBrowserFetch } = await loadHelper();
const originalFetch = globalThis.fetch;
const calls = [];
function strictFetch(input, init) {
  if (this !== undefined && this !== globalThis) throw new TypeError('Can only call Window.fetch on instances of Window');
  calls.push({ input: String(input), method: init?.method });
  return Promise.resolve(new Response('{"ok":true}', { status: 200 }));
}
try {
  globalThis.fetch = strictFetch;

  // Reproduce the defect: the pre-fix pattern throws under a strict receiver.
  const broken = { fetchImpl: globalThis.fetch };
  assert.throws(() => broken.fetchImpl('https://example.test/a'), /Can only call Window\.fetch on instances of Window/);

  // Fixed pattern: stored on an instance and called as a method, receiver stays global.
  class Client { constructor(impl) { this.fetchImpl = resolveBrowserFetch(impl); } get(url) { return this.fetchImpl(url, { method: 'GET' }); } }
  const response = await new Client().get('https://example.test/b');
  assert.equal(response.status, 200);
  assert.deepEqual(calls.at(-1), { input: 'https://example.test/b', method: 'GET' });

  // Late binding: the wrapper reads the current global fetch at call time (e.g. instrumentation installed later).
  const client = new Client();
  let replacedCalled = false;
  globalThis.fetch = function replaced() { replacedCalled = true; return strictFetch.apply(this, arguments); };
  await client.get('https://example.test/c');
  assert.ok(replacedCalled);

  // Injected test doubles pass through untouched.
  const injected = async () => new Response('', { status: 204 });
  assert.equal(resolveBrowserFetch(injected), injected);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('DA:ON browser fetch receiver binding (Issue #6): PASS');
