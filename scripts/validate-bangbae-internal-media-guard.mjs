import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Execute the real policy module, not a reimplemented policy model.
const source = readFileSync('src/domain/professionalReport/reportAccessPolicy.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
const execute = runInNewContext(`(function(require, module, exports) { ${compiled}\n})`, {});
execute(() => { throw new Error('Unexpected runtime import in media policy'); }, module, module.exports);
const { internalPhotoAllowed, isBangbae81511, reportMediaCategoryAllowed, reportSnapshotInternalPhotoAllowed } = module.exports;

const cases = [
  ['parcel address / explicit true', { id: 'other', name: '', address: '서울 서초구 방배동 815-11', detailAddress: '', internalPhotoAllowed: true }, false],
  ['road address / explicit true', { id: 'other', name: '', address: '서울 서초구 동광로18길 7', detailAddress: '', internalPhotoAllowed: true }, false],
  ['property ID / explicit true', { id: 'daon-bangbae-815-11', name: '', address: '', detailAddress: '', internalPhotoAllowed: true }, false],
  ['parcel address / explicit false', { id: 'other', name: '', address: '방배동 815-11', detailAddress: '', internalPhotoAllowed: false }, false],
  ['unrelated / explicit true', { id: 'other', name: '', address: '서초구 서초동 1', detailAddress: '', internalPhotoAllowed: true }, true],
  ['unrelated / explicit false', { id: 'other', name: '', address: '서초구 서초동 1', detailAddress: '', internalPhotoAllowed: false }, false],
  ['unrelated / unset', { id: 'other', name: '', address: '서초구 서초동 1', detailAddress: '', internalPhotoAllowed: undefined }, true],
];
for (const [label, property, expected] of cases) {
  assert.equal(internalPhotoAllowed(property), expected, label);
  if (expected === false) {
    assert.equal(reportMediaCategoryAllowed('interior', internalPhotoAllowed(property)), false, `${label}: interior`);
  }
}
assert.equal(isBangbae81511(cases[2][1]), true, 'property ID must be sufficient even when address is unavailable');
assert.equal(reportMediaCategoryAllowed('exterior', false), true, 'exterior photos remain allowed');
// Historical snapshots can contain a stale 'true' flag. Never trust it for Bangbae.
assert.equal(reportSnapshotInternalPhotoAllowed({ id: 'daon-bangbae-815-11' }, true), false, 'legacy ID-only snapshot must be denied');
assert.equal(reportSnapshotInternalPhotoAllowed({ address: '방배동 815-11' }, true), false, 'legacy parcel snapshot must be denied');
assert.equal(reportSnapshotInternalPhotoAllowed({ address: '서초구 서초동 1' }, true), true, 'unrelated snapshot must retain explicit permission');
assert.equal(reportSnapshotInternalPhotoAllowed({ address: '서초구 서초동 1' }, false), false, 'explicit deny remains denied');
const snapshotPage = readFileSync('src/pages/ProfessionalReportSnapshotPage.tsx', 'utf8');
assert.match(snapshotPage, /reportSnapshotInternalPhotoAllowed\(\{/, 'snapshot preview must re-evaluate current property privacy');
assert.match(snapshotPage, /id: propertyId/, 'authoritative snapshot property ID must override untrusted stored identity');
assert.match(snapshotPage, /\}, snapshot\.propertyId\);/, 'snapshot preview must pass authoritative property ID');
assert.match(snapshotPage, /internalPhotoAllowed: false/, 'snapshot preview must pass the effective restriction to the 7P renderer');
assert.match(snapshotPage, /item\.id !== 'property-main'/, 'unclassified primary image must fail closed');
assert.match(snapshotPage, /reportMediaCategoryAllowed\(item\.category, false\)/, 'only explicitly non-interior media remains');
console.log('PASS: Bangbae hard-deny internal media, seven property cases and exterior allowance');

// Snapshot routes are reused by React Router. Prevent a late A response from
// rendering/printing A while the URL already points to B.
// These source assertions accompany a deterministic async model; not browser E2E.
for (const [pattern, label] of [
  [/setLoading\(true\);\s*setSnapshot\(undefined\);/, 'reset snapshot before loading a new route'],
  [/return \(\) => \{ active = false; \};/, 'invalidate the old request on route change'],
  [/if \(!active\) return;/, 'discard stale snapshot fetches'],
  [/value\.id !== snapshotId/, 'reject a mismatched repository snapshot ID'],
  [/if \(active\) setFreshness\(nextFreshness\)/, 'discard stale freshness'],
  [/if \(active\) setLoading\(false\)/, 'old route must not complete new loading'],
  [/snapshot && snapshot\.id !== snapshotId/, 'guard render before effects reset stale state'],
  [/currentRouteSnapshotId\.current === requestedId\) setSnapshot\(ready\)/, 'guard stale confirm completion'],
  [/currentRouteSnapshotId\.current === requestedId\) navigate\(/, 'guard stale regeneration navigation'],
]) assert.match(snapshotPage, pattern, label);

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
function snapshotRouteModel() {
  const state = { route: '', loading: false, snapshot: undefined, freshness: undefined, error: '' };
  let previous;
  const canPrint = () => !state.loading && state.snapshot?.id === state.route;
  function load(id, fetchSnapshot, evaluateFreshness = async () => ({ isStale: false })) {
    if (previous) previous.active = false;
    const request = { active: true };
    previous = request;
    state.route = id; state.loading = true; state.snapshot = undefined;
    state.freshness = undefined; state.error = '';
    return (async () => {
      try {
        const value = await fetchSnapshot();
        if (!request.active) return;
        if (!value || value.id !== id) {
          state.error = 'Snapshot mismatch';
          return;
        }
        state.snapshot = value;
        const fresh = await evaluateFreshness(value);
        if (request.active) state.freshness = fresh;
      } catch (reason) {
        if (request.active) state.error = String(reason);
      } finally {
        if (request.active) state.loading = false;
      }
    })();
  }
  return { state, load, canPrint };
}
const route = snapshotRouteModel();
const lateA = deferred();
const pendingA = route.load('A', () => lateA.promise);
assert.equal(route.canPrint(), false, 'A is not printable while loading');
const pendingB = route.load('B', async () => ({ id: 'B' }));
await pendingB;
assert.equal(route.state.snapshot?.id, 'B');
assert.equal(route.canPrint(), true);
lateA.resolve({ id: 'A' });
await pendingA;
assert.equal(route.state.snapshot?.id, 'B', 'late A must not replace B');
assert.equal(route.canPrint(), true, 'B must remain printable');
const wrong = await route.load('C', async () => ({ id: 'A' }));
assert.equal(route.state.snapshot, undefined, 'mismatched response must not be shown');
assert.equal(route.canPrint(), false, 'mismatched response must not be printable');
const delayedFreshness = deferred();
const pendingD = route.load('D', async () => ({ id: 'D' }), () => delayedFreshness.promise);
await Promise.resolve();
const pendingE = route.load('E', async () => ({ id: 'E' }));
await pendingE;
delayedFreshness.resolve({ isStale: true });
await pendingD;
assert.equal(route.state.snapshot?.id, 'E', 'stale freshness must not replace the current route');
assert.equal(route.state.freshness?.isStale, false, 'old stale state must not contaminate new report');
console.log('PASS: snapshot route isolation model (late fetch, mismatched ID, stale freshness, print guard); NOT browser E2E');
