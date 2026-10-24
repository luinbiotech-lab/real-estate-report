import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync('src/services/reportEngine/reportFinalizationUiState.ts', 'utf8');
const page = readFileSync('src/pages/ProfessionalReportSnapshotPage.tsx', 'utf8');
// The production remote repository creates a NEW immutable final Snapshot ID.
// Without navigation, the page's snapshot.id !== route ID guard spins forever.
assert.match(page, /getFinalizedSnapshotDestination\(requestedId, ready\)/);
assert.match(page, /if \(destination\) navigate\(destination, \{ replace: true \}\)/);
assert.match(page, /else setSnapshot\(ready\)/);
assert.match(page, /getSnapshotFinalizationUiState\(snapshot\.status, reportReady, freshness\)/);
assert.match(page, /disabled=\{confirming \|\| !finalizationUi\.canRequestReady\}/);
assert.match(page, /setFreshnessError\('Data Room 최신성 확인에 실패했습니다/);
assert.match(page, /\{freshnessError && snapshot\.status === 'draft'/);

function compile(sourceText) {
  const compiled = ts.transpileModule(sourceText, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  runInNewContext(compiled, { module, exports: module.exports });
  return module.exports.getSnapshotFinalizationUiState;
}
function scenarios(gate) {
  const fresh = { isStale: false, snapshotGeneratedAt: '2026-10-24T00:00:00Z' };
  const stale = { ...fresh, isStale: true };
  assert.equal(gate('draft', true, undefined).canRequestReady, false, 'pending/failed freshness must fail closed');
  assert.match(gate('draft', true, undefined).label, /최신성/);
  assert.equal(gate('draft', true, stale).canRequestReady, false, 'stale draft must not be confirmable');
  assert.equal(gate('draft', false, fresh).canRequestReady, false, 'unverified draft must not be confirmable');
  assert.equal(gate('draft', true, fresh).canRequestReady, true, 'fresh verified draft may request authoritative confirmation');
  assert.equal(gate('ready', true, fresh).canRequestReady, false, 'immutable final cannot be reconfirmed');
  assert.equal(gate('archived', true, fresh).canRequestReady, false, 'archived snapshot cannot be reconfirmed');
  assert.equal(gate('failed', true, fresh).canRequestReady, false, 'failed snapshot cannot be confirmed');
}
scenarios(compile(source));
function compileDestination(sourceText) {
  const compiled = ts.transpileModule(sourceText, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  runInNewContext(compiled, { module, exports: module.exports });
  return module.exports.getFinalizedSnapshotDestination;
}
function finalizationDestinationScenarios(resolve) {
  assert.equal(resolve('draft-1', { id: 'draft-1' }), null, 'local in-place ready retains the route');
  assert.equal(resolve('draft-1', { id: 'final-2' }), '/professional-report/snapshot/final-2', 'remote immutable final must navigate');
  assert.equal(resolve('draft-1', { id: 'final/2' }), '/professional-report/snapshot/final%2F2', 'final ID must be URL-safe');
  assert.throws(() => resolve('draft-1', { id: '' }), /Snapshot ID/, 'invalid final ID must fail closed');
}
finalizationDestinationScenarios(compileDestination(source));
const brokenRoute = source.replace('ready.id === requestedId ? null', 'ready.id !== requestedId ? null');
assert.notEqual(brokenRoute, source, 'remote route negative control must mutate the real helper');
assert.throws(() => finalizationDestinationScenarios(compileDestination(brokenRoute)), /remote immutable final|local in-place ready/, 'remote route regression must be detected');
// Negative control: bypassing the freshness-pending branch must fail.
const mutation = source.replace('if (!freshness) return', 'if (false) return');
assert.notEqual(mutation, source, 'negative control must modify real gate');
assert.throws(() => scenarios(compile(mutation)), /isStale|latest|freshness/, 'negative control must be detected');
console.log('PASS Snapshot finalization UI: 8 gate + 4 final-route scenarios; freshness and remote-route negative controls detected');
