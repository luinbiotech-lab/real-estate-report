// Regression tests for scripts/lib/indexeddb-schema-check.mjs (CI step "Validate IndexedDB schema check").
// Locks the two defects found in PR #5's first attempt plus the version boundaries, then checks the real schema.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertIndexedDbSchema, parseDatabaseVersion } from './lib/indexeddb-schema-check.mjs';

const ROOM_STORES = ['roomEvidencePositions', 'roomConditionHistory', 'roomRenovationHistory'];
const storeList = (names) => `for (const name of [${names.map((n) => `'${n}'`).join(', ')}]) {}`;
const schema = (version, stores = ROOM_STORES, extra = '') =>
  `export const RISK_AGENT_FOUNDATION_DATABASE_VERSION = 8;\n${extra}export const DATABASE_VERSION = ${version};\n${storeList(stores)}\n`;
const check = (src) => assertIndexedDbSchema(src, { minVersion: 13, requiredStores: ROOM_STORES, context: 'test' });

// 1. A prefixed constant earlier in the file must not be read as the schema version (PR #5 parsed 8 here).
assert.equal(parseDatabaseVersion(schema(14)), 14);

// 2. Boundaries: below minimum rejected, minimum and forward versions accepted.
assert.throws(() => check(schema(1)), /below required minimum 13/);
assert.throws(() => check(schema(12)), /below required minimum 13/);
assert.equal(check(schema(13)), 13);
assert.equal(check(schema(14)), 14);
assert.equal(check(schema(15)), 15);

// 3. Missing or ambiguous constant fails closed (PR #5 accepted a file with no constant at all).
assert.throws(() => check(storeList(ROOM_STORES)), /found 0/);
assert.throws(() => check(schema(14, ROOM_STORES, 'export const DATABASE_VERSION = 13;\n')), /found 2/);
assert.throws(() => check(schema('14.5')), /found 0/);
assert.throws(() => check(schema(0)), /invalid DATABASE_VERSION/);
assert.throws(() => check('// export const DATABASE_VERSION = 14;\n' + storeList(ROOM_STORES)), /found 0/);

// 4. Each required store is individually enforced.
for (const store of ROOM_STORES) {
  assert.throws(() => check(schema(14, ROOM_STORES.filter((s) => s !== store))), new RegExp(`missing at v14: ${store}`));
}
assert.throws(() => assertIndexedDbSchema(schema(14), { minVersion: 0 }), /positive integer/);

// 5. The real schema satisfies both the room-intelligence (v13) and spatial-media (v14) store sets.
const real = readFileSync('src/repositories/database.ts', 'utf8');
const version = assertIndexedDbSchema(real, { minVersion: 13, requiredStores: ROOM_STORES, context: 'room intelligence' });
assertIndexedDbSchema(real, {
  minVersion: 14,
  requiredStores: ['propertyMediaPolicies', 'floorPlans', 'propertySpacesSpatial', 'mediaAssets', 'mediaSpaceLinks', 'viewerScenes', 'viewerNodes', 'viewerEdges', 'walkthroughRoutes', 'walkthroughSteps', 'verificationEvents'],
  context: 'spatial media',
});

console.log(`DA:ON IndexedDB schema check regression suite: PASS (repository DATABASE_VERSION = ${version})`);
