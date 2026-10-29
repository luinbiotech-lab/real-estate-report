import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { importTs } from './lib/ts-module-loader.mjs';

// The loader scopes the bundle with the real helper (2026-10-30); inject it, never a re-implementation.
const { scopeDataRoomBundle } = await importTs('src/services/propertyReadinessService.ts');

// Run the actual Data Room loader, not a separately reimplemented state machine.
// A late response for Property A must never overwrite B's Property/Data Room.
const source = readFileSync('src/pages/PropertyDataRoomPage.tsx', 'utf8');
const begin = source.indexOf('  const load = useCallback(async () => {');
const endMarker = '  }, [id]);';
const end = source.indexOf(endMarker, begin);
assert.ok(begin >= 0 && end > begin, 'Data Room loader must exist');
const method = source.slice(begin, end + endMarker.length);
assert.match(source, /loading \|\| \(property && property\.id !== id\)/, 'synchronous route guard must hide old Property');
assert.match(source, /return \(\) => \{ loadRequestRef\.current \+= 1; \}/, 'route cleanup must invalidate pending requests');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function makeHarness(loaderSource) {
  const propertyRequests = new Map([['A', deferred()], ['B', deferred()]]);
  const bundleRequests = new Map([['A', deferred()], ['B', deferred()]]);
  const requestRef = { current: 0 };
  const state = { property: undefined, bundle: undefined, loading: false, error: '' };
  const repository = { getById: (id) => propertyRequests.get(id).promise };
  const service = { getBundle: (id) => bundleRequests.get(id).promise };
  const compiled = ts.transpileModule(`${loaderSource}\nmodule.exports = load;`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  function loadFor(id) {
    const module = { exports: {} };
    const wrapper = runInNewContext(`(function(module) { ${compiled} })`, {
      id, useCallback: (callback) => callback, loadRequestRef: requestRef,
      setLoading: (value) => { state.loading = value; },
      setError: (value) => { state.error = value; },
      setProperty: (value) => { state.property = value; },
      setBundle: (value) => { state.bundle = value; },
      propertyRepository: repository, propertyDataRoomService: service, scopeDataRoomBundle,
      emptyBundle: { documents: [], media: [] },
    });
    wrapper(module);
    return module.exports;
  }
  return { state, loadFor, propertyRequests, bundleRequests };
}

async function race(loaderSource, phase) {
  const h = makeHarness(loaderSource);
  const pendingA = h.loadFor('A')();
  if (phase === 'bundle') {
    h.propertyRequests.get('A').resolve({ id: 'A' });
    await Promise.resolve();
  }
  const pendingB = h.loadFor('B')();
  h.propertyRequests.get('B').resolve({ id: 'B' });
  // B's bundle also carries a foreign A row; the loader must drop it.
  h.bundleRequests.get('B').resolve({ documents: [{ id: 'B-doc', propertyId: 'B' }, { id: 'A-leak', propertyId: 'A' }] });
  await pendingB;
  if (phase === 'property') h.propertyRequests.get('A').resolve({ id: 'A' });
  else h.bundleRequests.get('A').resolve({ documents: [{ id: 'A-doc', propertyId: 'A' }] });
  await pendingA;
  return h.state;
}

for (const phase of ['property', 'bundle']) {
  const state = await race(method, phase);
  assert.equal(state.property?.id, 'B', `stale A ${phase} response must not overwrite B`);
  assert.equal(state.bundle.documents[0].id, 'B-doc', `stale A ${phase} response must not overwrite B documents`);
  assert.deepEqual(state.bundle.documents.map((row) => row.id), ['B-doc'], 'foreign Property rows must be scoped out of the Data Room UI');
  assert.equal(state.loading, false);
  assert.equal(state.error, '');
}

const missing = makeHarness(method);
const pendingMissing = missing.loadFor('A')();
missing.propertyRequests.get('A').resolve({ id: 'wrong-property' });
await pendingMissing;
assert.equal(missing.state.property, undefined, 'wrong Property ID must not render');
assert.match(missing.state.error, /찾을 수 없습니다/);
assert.equal(missing.state.loading, false);

// Negative control: removing the request guards must reintroduce the cross-Property race.
const unsafe = method.replaceAll('if (requestId !== loadRequestRef.current) return;', '');
assert.notEqual(unsafe, method, 'negative-control mutation must apply');
const badState = await race(unsafe, 'bundle');
assert.equal(badState.property?.id, 'A', 'negative control must reproduce stale A overwrite');

// Exercise the actual Snapshot identity gate, not a parallel implementation.
// Previously markReady() checked embedded identity, but preview/PDF did not.
const snapshotPageSource = readFileSync('src/pages/ProfessionalReportSnapshotPage.tsx', 'utf8');
const snapshotGuardStart = snapshotPageSource.indexOf('function snapshotMatchesProperty(');
const snapshotGuardEnd = snapshotPageSource.indexOf('\n}\n', snapshotGuardStart);
assert.ok(snapshotGuardStart >= 0 && snapshotGuardEnd > snapshotGuardStart, 'Snapshot identity guard must exist');
const snapshotGuardSource = snapshotPageSource.slice(snapshotGuardStart, snapshotGuardEnd + 2);
const snapshotRenderGuard = snapshotPageSource.indexOf('if (!snapshotMatchesProperty(snapshot)) return');
assert.ok(snapshotRenderGuard > snapshotGuardEnd, 'Snapshot preview must fail closed on cross-Property data');
assert.ok(snapshotRenderGuard < snapshotPageSource.indexOf('const report = <DaonProfessionalReportMaster'),
  'Snapshot identity guard must execute before report rendering and PDF printing');

function compileSnapshotGuard(code) {
  const js = ts.transpileModule(`${code}\nmodule.exports = snapshotMatchesProperty;`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  runInNewContext(`(function(module) { ${js} })`)(module);
  return module.exports;
}
const snapshotGuard = compileSnapshotGuard(snapshotGuardSource);
const storedSnapshot = (propertyId, embeddedId) => ({ propertyId, snapshotData: { identity: { id: embeddedId } } });
assert.equal(snapshotGuard(storedSnapshot('A', 'A')), true, 'matching Property must remain readable');
assert.equal(snapshotGuard(storedSnapshot('A', 'B')), false, 'foreign Property must never be printed');
assert.equal(snapshotGuard(storedSnapshot('A', undefined)), false, 'missing identity must fail closed');
assert.equal(snapshotGuard(storedSnapshot('', 'A')), false, 'missing owner must fail closed');
const weakenedGuard = snapshotGuardSource.replace('identity?.id === snapshot.propertyId', 'true');
assert.notEqual(weakenedGuard, snapshotGuardSource, 'negative-control mutation must apply');
assert.equal(compileSnapshotGuard(weakenedGuard)(storedSnapshot('A', 'B')), true,
  'negative control must reproduce foreign-Property exposure');
console.log('PASS Snapshot embedded-Property identity gate: matching/foreign/missing and negative control');

console.log('PASS Data Room route isolation: late Property/bundle responses, mismatched IDs, render/cleanup guards, negative control');
