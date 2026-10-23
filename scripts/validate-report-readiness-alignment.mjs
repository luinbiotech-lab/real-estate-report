import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const REQUIRED_DOCUMENT_TYPES = ['building_register', 'land_register', 'land_use_plan', 'registry'];

function loadTs(path, imports = {}) {
  const compiled = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: path,
  }).outputText;
  const module = { exports: {} };
  const fn = runInNewContext(`(function(require, module, exports) { ${compiled}\n})`, {});
  fn((name) => {
    if (!Object.hasOwn(imports, name)) throw new Error(`Unexpected runtime import: ${name} in ${path}`);
    return imports[name];
  }, module, module.exports);
  return module.exports;
}

const readiness = loadTs('src/services/propertyReadinessService.ts', {
  '../domain/propertyDataRoom/labels': { REQUIRED_DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS: {} },
});
const docs = (status = 'verified') => REQUIRED_DOCUMENT_TYPES.map((documentType, i) => ({
  id: `doc-${i}`, documentType, verificationStatus: status,
}));
const bundle = (documents = docs(), verificationCandidates = [], verifications = []) => ({
  documents, verificationCandidates, verifications, dataSources: [],
});
const assessed = readiness.assessRequiredDocumentReadiness(bundle());
assert.equal(assessed.connected.length, 4);
assert.equal(assessed.verified.length, 4);
assert.equal(readiness.assessRequiredDocumentReadiness(bundle(docs('confirmed'))).verified.length, 0);
assert.equal(readiness.assessRequiredDocumentReadiness(bundle(docs('confirmed'), [], [{
  fieldKey: 'document:doc-0', status: 'verified',
}])).verified.length, 1);

const builder = readFileSync('src/services/reportEngine/reportDataBuilder.ts', 'utf8');
assert.match(builder, /assessRequiredDocumentReadiness\(bundle\)/, 'Report builder must use shared verified-document policy');
assert.match(builder, /requiredDocumentReadiness\.verified\.length\s*===\s*REQUIRED_DOCUMENT_TYPES\.length/, 'Builder must require all documents verified');
assert.match(builder, /requiredDocumentReadiness\.connected\.includes\(type\)/, 'Builder must require actual connected originals');
assert.doesNotMatch(builder, /document\.verificationStatus\s*===\s*'verified'\s*\|\|\s*document\.verificationStatus\s*===\s*'confirmed'/, 'Confirmed-only must not bypass report gate');

let currentSnapshot;
let currentBundle;
let stale = false;
let statusWrites = 0;
const repository = {
  async getReportSnapshot() { return currentSnapshot; },
  async getBundle() { return currentBundle; },
  async updateReportSnapshotStatus(id, status) { statusWrites += 1; return { id, status }; },
};
const snapshotService = loadTs('src/services/reportEngine/reportSnapshotService.ts', {
  '../../domain/professionalReport/reportAccessPolicy': { reportMediaCategoryAllowed: () => true },
  '../../repositories/propertyDataRoomRepository': { propertyDataRoomRepository: repository },
  '../propertyReadinessService': { assessRequiredDocumentReadiness: readiness.assessRequiredDocumentReadiness },
  '../../domain/propertyDataRoom/labels': { REQUIRED_DOCUMENT_TYPES },
  './reportSnapshotFreshnessService': { reportSnapshotFreshnessService: { async evaluate() { return { isStale: stale }; } } },
  './reportDataBuilder': { PROFESSIONAL_REPORT_TEMPLATE_ID: 'master', PROFESSIONAL_REPORT_TEMPLATE_VERSION: 'v3', REPORT_ENGINE_VERSION: '1', reportDataBuilder: {} },
}).reportSnapshotService;

async function check(label, dataRoom, expectPass, reportReady = true) {
  currentBundle = dataRoom;
  currentSnapshot = { id: 'snapshot-1', propertyId: 'daon-bangbae-815-11', status: 'draft', generatedAt: '2026-10-23T01:00:00Z',
    snapshotData: { generated: { templateId: 'master' }, dataQuality: { reportReady, requiredDocumentsMissing: [], missingFields: [] } } };
  const before = statusWrites;
  if (expectPass) {
    const result = await snapshotService.markReady(currentSnapshot.id);
    assert.equal(result.status, 'ready', label);
    assert.equal(statusWrites, before + 1, `${label}: must write exactly once`);
  } else {
    await assert.rejects(snapshotService.markReady(currentSnapshot.id), (error) => typeof error?.message === 'string', label);
    assert.equal(statusWrites, before, `${label}: must never write ready status`);
  }
}

await check('verified four required documents', bundle(), true);
await check('confirmed-only must be rejected', bundle(docs('confirmed')), false);
await check('one required document missing', bundle(docs().slice(1)), false);
await check('no connected original documents', bundle([]), false);
await check('explicit verified document attestation', bundle(docs('confirmed'), [], docs('confirmed').map(d => ({ fieldKey: `document:${d.id}`, status: 'verified' }))), true);
await check('pending verification candidate', bundle(docs(), [{ decisionStatus: 'pending' }]), false);
await check('held verification candidate', bundle(docs(), [{ decisionStatus: 'held' }]), false);
await check('snapshot already not report-ready', bundle(), false, false);
stale = true;
await check('stale snapshot', bundle(), false);
console.log('PASS report readiness alignment: 9 service scenarios + shared policy + builder guards');
