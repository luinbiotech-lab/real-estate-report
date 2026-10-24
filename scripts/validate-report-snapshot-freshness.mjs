import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Exercise the actual freshness service, with read-only repository doubles.
const source = readFileSync('src/services/reportEngine/reportSnapshotFreshnessService.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
let property = { id: 'P', updatedAt: '2026-10-01T00:00:00Z' };
let legacy = { documents: [], reportSnapshots: [] };
let spatial = { spaces: [] };
const module = { exports: {} };
const fn = runInNewContext(`(function(require, module, exports) { ${compiled}\n})`, { Date });
const imports = {
  '../../repositories/propertyDataRoomRepository': { propertyDataRoomRepository: { getBundle: async () => legacy } },
  '../../repositories/propertyRepository': { propertyRepository: { getById: async () => property } },
  '../../repositories/spatialMediaRepository': { spatialMediaRepository: { getBundle: async () => spatial } },
};
fn((name) => {
  if (!Object.hasOwn(imports, name)) throw new Error(`Unexpected runtime import: ${name}`);
  return imports[name];
}, module, module.exports);
const evaluate = (generatedAt) => module.exports.reportSnapshotFreshnessService.evaluate({
  id: 'S', propertyId: 'P', generatedAt,
});
const past = '2026-10-02T00:00:00Z';
assert.equal((await evaluate(past)).isStale, false, 'unchanged property remains fresh');
legacy = {
  documents: [{ updatedAt: '2026-10-03T00:00:00Z' }],
  reportSnapshots: [{ updatedAt: '2026-10-10T00:00:00Z' }],
};
assert.equal((await evaluate(past)).isStale, true, 'new document makes snapshot stale');
legacy = { documents: [], reportSnapshots: [{ updatedAt: '2026-10-10T00:00:00Z' }] };
assert.equal((await evaluate(past)).isStale, false, 'other snapshots must not make snapshot stale');
assert.equal((await evaluate('not-a-date')).isStale, true, 'invalid generatedAt must fail closed');
assert.equal((await evaluate(new Date(Date.now() + 60 * 60 * 1000).toISOString())).isStale, true, 'future-dated generatedAt must fail closed');

for (const decisionStatus of ['approved', 'rejected', 'held']) {
  legacy = { documents: [], reportSnapshots: [], verificationCandidates: [{
    createdAt: '2026-10-01T00:00:00Z', reviewedAt: '2026-10-03T00:00:00Z', decisionStatus,
  }] };
  const result = await evaluate(past);
  assert.equal(result.isStale, true, 'a later candidate review must invalidate the Snapshot: ' + decisionStatus);
  assert.equal(result.latestDataAt, '2026-10-03T00:00:00.000Z');
}
legacy = { documents: [], reportSnapshots: [], verificationCandidates: [{
  createdAt: '2026-10-01T00:00:00Z', reviewedAt: '2026-10-01T12:00:00Z', decisionStatus: 'approved',
}] };
assert.equal((await evaluate(past)).isStale, false, 'review before generation must remain fresh');
legacy = { documents: [], reportSnapshots: [] };
spatial = { verificationEvents: [{ createdAt: '2026-10-01T00:00:00Z', reviewedAt: '2026-10-03T00:00:00Z' }] };
assert.equal((await evaluate(past)).isStale, true, 'later spatial review must invalidate Snapshot');
spatial = { spaces: [] };

property = undefined;
assert.equal((await evaluate(past)).isStale, true, 'missing property must fail closed');
console.log('PASS report Snapshot freshness: 11 scenarios; invalid/future time and missing property fail closed');
