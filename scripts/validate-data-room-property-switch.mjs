import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

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
      propertyRepository: repository, propertyDataRoomService: service,
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
  h.bundleRequests.get('B').resolve({ documents: [{ id: 'B-doc' }] });
  await pendingB;
  if (phase === 'property') h.propertyRequests.get('A').resolve({ id: 'A' });
  else h.bundleRequests.get('A').resolve({ documents: [{ id: 'A-doc' }] });
  await pendingA;
  return h.state;
}

for (const phase of ['property', 'bundle']) {
  const state = await race(method, phase);
  assert.equal(state.property?.id, 'B', `stale A ${phase} response must not overwrite B`);
  assert.equal(state.bundle.documents[0].id, 'B-doc', `stale A ${phase} response must not overwrite B documents`);
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

console.log('PASS Data Room route isolation: late Property/bundle responses, mismatched IDs, render/cleanup guards, negative control');
