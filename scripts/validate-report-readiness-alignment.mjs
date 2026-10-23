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
  const fn = runInNewContext(`(function(require, module, exports) { ${compiled}\n})`, { Blob });
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
  storagePath: `property/document/doc-${i}.pdf`, fileData: new Blob(['%PDF-1.7 test original']), fileSize: new Blob(['%PDF-1.7 test original']).size,
}));
const bundle = (documents = docs(), verificationCandidates = [], verifications = []) => ({
  documents, verificationCandidates, verifications, dataSources: [],
});
const mediaPolicy = loadTs('src/domain/professionalReport/reportAccessPolicy.ts');
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
  '../../domain/professionalReport/reportAccessPolicy': mediaPolicy,
  '../../repositories/propertyDataRoomRepository': { propertyDataRoomRepository: repository },
  '../propertyReadinessService': { assessRequiredDocumentReadiness: readiness.assessRequiredDocumentReadiness },
  '../../domain/propertyDataRoom/labels': { REQUIRED_DOCUMENT_TYPES },
  './reportSnapshotFreshnessService': { reportSnapshotFreshnessService: { async evaluate() { return { isStale: stale }; } } },
  './reportDataBuilder': { PROFESSIONAL_REPORT_TEMPLATE_ID: 'master', PROFESSIONAL_REPORT_TEMPLATE_VERSION: 'v3', REPORT_ENGINE_VERSION: '1', reportDataBuilder: {} },
}).reportSnapshotService;

async function check(label, dataRoom, expectPass, reportReady = true, mutate = () => {}) {
  currentBundle = dataRoom;
  currentSnapshot = {
    id: 'snapshot-1', propertyId: 'daon-bangbae-815-11', reportType: 'professional_report',
    templateId: 'master', templateVersion: 'v3', engineVersion: '1',
    status: 'draft', generatedAt: '2026-10-23T01:00:00Z',
    snapshotData: {
      identity: { id: 'daon-bangbae-815-11' },
      generated: { templateId: 'master', templateVersion: 'v3', engineVersion: '1', generatedAt: '2026-10-23T01:00:00Z' },
      dataQuality: { reportReady, requiredDocumentsMissing: [], missingFields: [] },
      media: { internalPhotoAllowed: false, mainImage: { value: null }, additionalImages: { value: [] }, items: [] },
    },
  };
  mutate(currentSnapshot);
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
await check('verified metadata without original bytes', bundle(docs().map((document, i) =>
  i === 0 ? { ...document, fileData: undefined } : document)), false);
await check('zero-byte original', bundle(docs().map((document, i) =>
  i === 0 ? { ...document, fileData: new Blob([]), fileSize: 0 } : document)), false);
await check('deleted verified original', bundle(docs().map((document, i) =>
  i === 0 ? { ...document, deletedAt: '2026-10-23T00:00:00Z' } : document)), false);
await check('mismatched original binary size', bundle(docs().map((document, i) =>
  i === 0 ? { ...document, fileSize: document.fileSize + 1 } : document)), false);
await check('missing Storage path despite original bytes', bundle(docs().map((document, i) =>
  i === 0 ? { ...document, storagePath: '' } : document)), false);
await check('verified attestation cannot replace missing binary', bundle(
  docs('confirmed').map((document, i) => i === 0 ? { ...document, fileData: undefined } : document),
  [], [{ fieldKey: 'document:doc-0', status: 'verified' }]), false);
// Bangbae's four source files include TWO registry copies, not a land-register
// certificate. Document count alone must never satisfy four distinct types.
const bangbaeFourFiles = [
  { id: 'building', documentType: 'building_register', verificationStatus: 'verified' },
  { id: 'land-registry', documentType: 'registry', verificationStatus: 'verified' },
  { id: 'building-registry', documentType: 'registry', verificationStatus: 'verified' },
  { id: 'land-use', documentType: 'land_use_plan', verificationStatus: 'verified' },
].map((document) => ({ ...document, storagePath: `property/document/${document.id}.pdf`, fileData: new Blob(['%PDF-1.7 test original']), fileSize: new Blob(['%PDF-1.7 test original']).size }));
assert.equal(readiness.assessRequiredDocumentReadiness(bundle(bangbaeFourFiles)).connected.length, 3, 'duplicate registry is not land register');
assert.equal(readiness.assessRequiredDocumentReadiness(bundle(bangbaeFourFiles)).verified.length, 3, 'four files do not equal four required document types');
await check('two registry copies cannot substitute for land register', bundle(bangbaeFourFiles), false);
await check('no connected original documents', bundle([]), false);
await check('explicit verified document attestation', bundle(docs('confirmed'), [], docs('confirmed').map(d => ({ fieldKey: `document:${d.id}`, status: 'verified' }))), true);
await check('pending verification candidate', bundle(docs(), [{ decisionStatus: 'pending' }]), false);
await check('held verification candidate', bundle(docs(), [{ decisionStatus: 'held' }]), false);
await check('snapshot already not report-ready', bundle(), false, false);
// A verified Data Room must not finalize a mismatched or legacy report payload.
await check('wrong Property identity', bundle(), false, true, (s) => { s.snapshotData.identity.id = 'another-property'; });
await check('missing Property identity', bundle(), false, true, (s) => { delete s.snapshotData.identity.id; });
await check('wrong report type', bundle(), false, true, (s) => { s.reportType = 'other'; });
await check('wrong Snapshot template ID', bundle(), false, true, (s) => { s.templateId = 'legacy'; });
await check('wrong Snapshot template version', bundle(), false, true, (s) => { s.templateVersion = 'v2'; });
await check('wrong Snapshot engine version', bundle(), false, true, (s) => { s.engineVersion = 'old'; });
await check('wrong payload template ID', bundle(), false, true, (s) => { s.snapshotData.generated.templateId = 'legacy'; });
await check('wrong payload template version', bundle(), false, true, (s) => { s.snapshotData.generated.templateVersion = 'v2'; });
await check('wrong payload engine version', bundle(), false, true, (s) => { s.snapshotData.generated.engineVersion = 'old'; });
await check('payload generation time mismatch', bundle(), false, true, (s) => { s.snapshotData.generated.generatedAt = '2026-10-23T02:00:00Z'; });
// A stored legacy payload can still contain forbidden media even when the
// preview sanitizes it. Final immutable Snapshot must not preserve that payload.
await check('legacy stored interior flag must be rejected', bundle(), false, true, (s) => { s.snapshotData.media.internalPhotoAllowed = true; });
await check('unclassified main hero must be rejected', bundle(), false, true, (s) => { s.snapshotData.media.mainImage.value = 'legacy-interior.jpg'; });
await check('legacy additional image must be rejected', bundle(), false, true, (s) => { s.snapshotData.media.additionalImages.value = ['legacy.jpg']; });
await check('interior item must be rejected', bundle(), false, true, (s) => { s.snapshotData.media.items = [{ id: 'interior-1', category: 'interior' }]; });
await check('unknown item category must be rejected', bundle(), false, true, (s) => { s.snapshotData.media.items = [{ id: 'unknown-1', category: 'other' }]; });
await check('legacy property main item must be rejected', bundle(), false, true, (s) => { s.snapshotData.media.items = [{ id: 'property-main', category: 'exterior' }]; });
await check('missing media section must be rejected', bundle(), false, true, (s) => { delete s.snapshotData.media; });
await check('explicit exterior media remains permitted', bundle(), true, true, (s) => { s.snapshotData.media.items = [{ id: 'exterior-1', category: 'exterior' }]; });
await check('unrelated property retains its own media policy', bundle(), true, true, (s) => {
  s.propertyId = 'unrelated-property';
  s.snapshotData.identity.id = 'unrelated-property';
  s.snapshotData.media.internalPhotoAllowed = true;
  s.snapshotData.media.mainImage.value = 'allowed.jpg';
});
stale = true;
await check('stale snapshot', bundle(), false);
console.log('PASS report readiness alignment: 35 service scenarios + binary integrity + distinct document types + shared policy + builder guards');

// Prevent stale/invalid/future-dated Snapshots from passing the final readiness gate.
await import('./validate-report-snapshot-freshness.mjs');
await import('./validate-report-final-provenance.mjs');
