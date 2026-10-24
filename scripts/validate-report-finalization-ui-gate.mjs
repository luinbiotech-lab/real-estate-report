import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync('src/services/reportEngine/reportFinalizationUiState.ts', 'utf8');
const page = readFileSync('src/pages/ProfessionalReportSnapshotPage.tsx', 'utf8');
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
// Negative control: bypassing the freshness-pending branch must fail.
const mutation = source.replace('if (!freshness) return', 'if (false) return');
assert.notEqual(mutation, source, 'negative control must modify real gate');
assert.throws(() => scenarios(compile(mutation)), /isStale|latest|freshness/, 'negative control must be detected');
console.log('PASS Snapshot finalization UI gate: 8 scenarios, failed/pending freshness fail-closed, negative control detected');
