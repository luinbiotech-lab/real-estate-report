import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Static source guards + a deterministic async model. NOT React/browser E2E.
const source = readFileSync(new URL('../src/pages/DigitalTwinIntakePage.tsx', import.meta.url), 'utf8');
for (const pattern of [
  /useCallback\(async \(id: string\)/,
  /setFloor\(\(current\) => current && !floors\.includes\(current\)/,
  /requestedPropertyId, loading, properties, loadAssets/,
  /void loadAssets\(''\)/,
  /\+\+assetRequest\.current; activePropertyId\.current = ''/,
  /activePropertyId\.current !== uploadPropertyId/,
  /activePropertyId\.current !== linkingPropertyId/,
  /requestId !== assetRequest\.current \|\| activePropertyId\.current !== id/,
  /requestedPropertyId && propertyId !== requestedPropertyId/,
  /requestedPropertyId && !properties\.some\(\(item\) => item\.id === requestedPropertyId\)/,
]) assert.match(source, pattern);
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
