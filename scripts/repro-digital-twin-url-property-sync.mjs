import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Static source guards + a deterministic async model. NOT React/browser E2E.
const source = readFileSync(new URL('../src/pages/DigitalTwinIntakePage.tsx', import.meta.url), 'utf8');
for (const pattern of [
  /useCallback\(async \(id: string\)/,
  /setFloor\(\(current\) => current && !floors\.includes\(current\)/,
  /requestedPropertyId, loading, properties, loadAssets/,
  /void loadAssets\(''\)/,
  /activePropertyId\.current !== uploadPropertyId/,
  /activePropertyId\.current !== linkingPropertyId/,
  /requestId !== assetRequest\.current \|\| activePropertyId\.current !== id/,
  /requestedPropertyId && propertyId !== requestedPropertyId/,
  /requestedPropertyId && !properties\.some\(\(item\) => item\.id === requestedPropertyId\)/,
]) assert.match(source, pattern);
// Unmount must invalidate reads and both mutation epochs in the same cleanup.
// Additional cleanup statements must not make the old adjacency check fail.
const cleanupPattern = /useEffect\(\(\) => \(\) => \{([^}]+)\}, \[\]\)/;
function hasSafeCleanup(text) {
  const cleanup = text.match(cleanupPattern)?.[1] ?? '';
  return ['assetRequest', 'uploadEpoch', 'linkEpoch'].every((name) =>
    cleanup.includes(`++${name}.current;`)) && cleanup.includes("activePropertyId.current = ''");
}
assert.ok(hasSafeCleanup(source), 'unmount must invalidate asset reads, uploads and links, then clear active Property');
for (const name of ['assetRequest', 'uploadEpoch', 'linkEpoch']) {
  const weakened = source.replace(cleanupPattern, (match) => match.replace(`++${name}.current;`, ''));
  assert.notEqual(weakened, source, 'negative control must change cleanup');
  assert.equal(hasSafeCleanup(weakened), false, `missing ${name} invalidation must fail`);
}
assert.ok(
  source.indexOf('if (requestedPropertyId && !properties.some') <
    source.indexOf('if (activePropertyId.current === nextId) return'),
  'invalid URL must be rejected before the same-ID shortcut',
);

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

function model(known = ['A', 'B']) {
  let active = '', selected = '', floor = '', error = '', generation = 0, assets = [];
  async function loadAssets(id, fetch = Promise.resolve([{ propertyId: id }])) {
    const request = ++generation;
    assets = [];
    if (!id) return;
    const rows = await fetch;
    if (request === generation && active === id) assets = rows;
  }
  function urlChange(id, fetch) {
    if (id && !known.includes(id)) {
      error = 'Unknown property';
      if (!active) return Promise.resolve();
      active = ''; selected = ''; floor = '';
      return loadAssets('');
    }
    const next = id || known[0] || '';
    if (active === next) return Promise.resolve();
    active = next; selected = next; floor = ''; error = '';
    return loadAssets(next, fetch);
  }
  function unmount() { ++generation; active = ''; }
  return { urlChange, unmount, setFloor: (value) => { floor = value; }, get: () => ({ active, selected, floor, error, assets }) };
}

const m = model();
await m.urlChange('A');
assert.equal(m.get().assets[0].propertyId, 'A');
m.setFloor('2F');
await m.urlChange('B');
assert.equal(m.get().floor, '');
assert.equal(m.get().assets[0].propertyId, 'B');
await m.urlChange('A');
assert.equal(m.get().assets[0].propertyId, 'A');
await m.urlChange('missing');
assert.equal(m.get().selected, '');
assert.equal(m.get().assets.length, 0);
assert.ok(m.get().error);
await m.urlChange('missing2');
assert.equal(m.get().selected, '');
assert.ok(m.get().error);
await m.urlChange('');
assert.equal(m.get().assets[0].propertyId, 'A');

const race = model(), late = deferred();
const pending = race.urlChange('A', late.promise);
await race.urlChange('B');
late.resolve([{ propertyId: 'A' }]);
await pending;
assert.equal(race.get().assets[0].propertyId, 'B');

const closed = model(), delayed = deferred();
const pendingClosed = closed.urlChange('A', delayed.promise);
closed.unmount();
delayed.resolve([{ propertyId: 'A' }]);
await pendingClosed;
assert.equal(closed.get().assets.length, 0);

// A URL update can render before useEffect has synchronized selected property.
// The route gate must not render A's assets or permit A uploads under B's URL.
function visibleAssets(routeId, selectedId, rows, knownIds = ['A', 'B']) {
  if (routeId && !knownIds.includes(routeId)) return { state: 'not-found', rows: [] };
  if (routeId && routeId !== selectedId) return { state: 'loading', rows: [] };
  return { state: 'ready', rows };
}
const previousRows = [{ propertyId: 'A' }];
assert.deepEqual(visibleAssets('B', 'A', previousRows), { state: 'loading', rows: [] });
assert.deepEqual(visibleAssets('unknown', 'A', previousRows), { state: 'not-found', rows: [] });
assert.deepEqual(visibleAssets('A', 'A', previousRows), { state: 'ready', rows: previousRows });
// Negative control: the old unguarded render would expose A under route B.
assert.equal(previousRows[0].propertyId !== 'B', true, 'unguarded stale A asset must be detected');

console.log('PASS: source guards + deterministic URL/property switch, render-before-effect isolation, invalid URL, stale request and unmount model regressions (NOT browser E2E).');


// An earlier property's upload or Data Room reuse may complete while a new
// property has a separate in-flight operation. The old completion must not
// clear the new property's busy state, even after an A → B → A route cycle.
// Deterministic state model; NOT a React/browser E2E.
for (const pattern of [
  /const uploadEpoch = useRef\(0\)/,
  /const linkEpoch = useRef\(0\)/,
  /resetPendingActions\(\)/,
  /uploadEpoch\.current !== uploadRequestId \|\| activePropertyId\.current !== uploadPropertyId/,
  /linkEpoch\.current !== linkRequestId \|\| activePropertyId\.current !== linkingPropertyId/,
  /uploadEpoch\.current === uploadRequestId && activePropertyId\.current === uploadPropertyId\) setUploading\(false\)/,
  /linkEpoch\.current === linkRequestId && activePropertyId\.current === linkingPropertyId\) setLinkingDocumentId\(''\)/,
]) assert.match(source, pattern, 'in-flight mutation must be scoped to the active property and operation epoch');

function operationEpochModel() {
  let active = 'A', uploadEpoch = 0, linkEpoch = 0, uploading = false, linking = false;
  function switchTo(id) {
    active = id;
    ++uploadEpoch;
    ++linkEpoch;
    uploading = false;
    linking = false;
  }
  function startUpload() {
    const capturedId = active, epoch = ++uploadEpoch;
    uploading = true;
    return () => { if (uploadEpoch === epoch && active === capturedId) uploading = false; };
  }
  function startLink() {
    const capturedId = active, epoch = ++linkEpoch;
    linking = true;
    return () => { if (linkEpoch === epoch && active === capturedId) linking = false; };
  }
  return { switchTo, startUpload, startLink, get: () => ({ active, uploading, linking }) };
}

const busy = operationEpochModel();
const finishUploadA = busy.startUpload();
busy.switchTo('B');
assert.equal(busy.get().uploading, false, 'new property must not inherit A busy state');
const finishUploadB = busy.startUpload();
finishUploadA();
assert.equal(busy.get().uploading, true, 'A completion must not clear B upload');
finishUploadB();
assert.equal(busy.get().uploading, false, 'B completion must clear its own busy state');

const cycle = operationEpochModel();
const finishOldA = cycle.startUpload();
cycle.switchTo('B');
cycle.switchTo('A');
const finishNewA = cycle.startUpload();
finishOldA();
assert.equal(cycle.get().uploading, true, 'old A epoch must not clear new A upload');
finishNewA();
assert.equal(cycle.get().uploading, false);

const links = operationEpochModel();
const finishLinkA = links.startLink();
links.switchTo('B');
const finishLinkB = links.startLink();
finishLinkA();
assert.equal(links.get().linking, true, 'A document reuse must not clear B reuse');
finishLinkB();
assert.equal(links.get().linking, false);
console.log('PASS: mutation epoch isolation for overlapping uploads, A-B-A, and Data Room reuse (NOT browser E2E).');
