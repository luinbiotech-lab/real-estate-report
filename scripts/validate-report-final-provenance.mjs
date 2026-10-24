import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Exercise the actual remote Snapshot finalization method with an isolated gateway.
// Finalization must never rewrite the source report's generation timestamp.
const source = readFileSync('src/repositories/propertyDataRoomRepository.ts', 'utf8');
const start = source.indexOf('  async updateReportSnapshotStatus(');
const end = source.indexOf('  async createNextReportSnapshot(', start);
assert.ok(start >= 0 && end > start, 'Snapshot transition method must be found');
const method = source.slice(start, end);

async function check(actualMethod) {
  const compiled = ts.transpileModule(`const repository = { ${actualMethod} }; module.exports = repository;`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const generatedAt = '2026-10-23T01:00:00Z';
  const draft = {
    id: 'draft-1', propertyId: 'property-1', reportType: 'professional_report',
    reportVersion: 5, status: 'draft', generatedAt, createdAt: generatedAt,
    templateId: 'daon-master', templateVersion: 'v1', engineVersion: 'report-engine-1',
    snapshotData: { generated: { generatedAt, templateId: 'daon-master', templateVersion: 'v1', engineVersion: 'report-engine-1' } },
  };
  const previous = { ...draft, id: 'previous-final', reportVersion: 6, status: 'ready' };
  const before = JSON.stringify(draft);
  const writes = [];
  const gateway = {
    listReportSnapshots: async () => [draft, previous],
    createReportSnapshot: async (input) => { writes.push(input); },
  };
  const module = { exports: {} };
  const fn = runInNewContext(`(function(module) { ${compiled}\n})`, {
    REMOTE_OPERATIONAL_MODE: true,
    findRemoteSnapshot: async (id) => id === draft.id ? draft : previous,
    remoteDataGateway: gateway,
    crypto: { randomUUID: () => 'new-final-id' },
    Date, Error, Math,
  });
  fn(module);
  const finalized = await module.exports.updateReportSnapshotStatus(draft.id, 'ready');
  assert.equal(writes.length, 1, 'must create exactly one immutable final');
  assert.equal(writes[0].status, 'final');
  assert.equal(finalized.id, 'new-final-id');
  assert.equal(finalized.reportVersion, 7);
  assert.equal(finalized.status, 'ready');
  assert.equal(finalized.generatedAt, generatedAt, 'generation timestamp is immutable provenance');
  assert.equal(finalized.snapshotData.generated.generatedAt, generatedAt, 'embedded provenance must match');
  assert.ok(Date.parse(finalized.createdAt) >= Date.parse(generatedAt), 'new final record may have a new createdAt');
  assert.equal(JSON.stringify(draft), before, 'original draft must not be mutated');
}

await check(method);
// Negative control: restoring the old generatedAt reset must fail this regression.
const badMethod = method.replace("status: 'ready',", "generatedAt: now,\n        status: 'ready',");
assert.notEqual(badMethod, method, 'negative-control mutation must apply');
await assert.rejects(check(badMethod), /generation timestamp is immutable provenance/);
console.log('PASS remote Snapshot final provenance: immutable generatedAt, new version/ID, original preserved, negative control detected');
