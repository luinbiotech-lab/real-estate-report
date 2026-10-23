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
property = undefined;
assert.equal((await evaluate(past)).isStale, true, 'missing property must fail closed');
console.log('PASS report Snapshot freshness: 6 scenarios; invalid/future time and missing property fail closed');
