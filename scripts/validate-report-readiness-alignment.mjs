import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const REQUIRED_DOCUMENT_TYPES = ['building_register', 'land_register', 'land_use_plan', 'registry'];
const PROPERTY_ID = 'daon-bangbae-815-11';

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
  id: `doc-${i}`, propertyId: PROPERTY_ID, documentType, verificationStatus: status,
  storagePath: `property/document/doc-${i}.pdf`, fileData: new Blob(['%PDF-1.7 test original']), fileSize: new Blob(['%PDF-1.7 test original']).size,
}));
const bundle = (documents = docs(), verificationCandidates = [], verifications = []) => ({
  documents, verificationCandidates, verifications, dataSources: [],
});
const mediaPolicy = loadTs('src/domain/professionalReport/reportAccessPolicy.ts');
// Exercise the actual TypeScript scoping helper, including media, comparable sources,
// verification candidates, documents, spaces, and Digital Twin assets.
const mixed = bundle();
mixed.media = [
  { id: 'own-exterior', propertyId: PROPERTY_ID, category: 'exterior' },
  { id: 'foreign-interior', propertyId: 'foreign-property', category: 'interior' },
];
mixed.dataSources = [
  { id: 'own-source', propertyId: PROPERTY_ID, resourceType: 'comparable_transaction_set' },
  { id: 'foreign-comparable', propertyId: 'foreign-property', resourceType: 'comparable_transaction_set' },
];
mixed.verificationCandidates = [
  { propertyId: PROPERTY_ID, decisionStatus: 'approved' },
  { propertyId: 'foreign-property', decisionStatus: 'pending' },
];
mixed.spaces = [
  { id: 'own-space', propertyId: PROPERTY_ID },
  { id: 'foreign-space', propertyId: 'foreign-property' },
];
mixed.digitalTwinAssets = [
  { id: 'own-3d', propertyId: PROPERTY_ID },
  { id: 'foreign-3d', propertyId: 'foreign-property' },
];
mixed.documents.push({ ...docs()[0], id: 'foreign-document', propertyId: 'foreign-property' });
const scoped = readiness.scopeDataRoomBundle(mixed, PROPERTY_ID);
for (const key of ['documents', 'media', 'dataSources', 'verificationCandidates', 'spaces', 'digitalTwinAssets']) {
  assert.ok(scoped[key].every((row) => row.propertyId === PROPERTY_ID), key + ': cross-Property row leaked');
}
assert.equal(scoped.media.length, 1, 'foreign media must not reach report rendering');
assert.equal(scoped.dataSources.length, 1, 'foreign comparables must not reach report analysis');
assert.equal(scoped.verificationCandidates.length, 1, 'foreign pending candidate must not block this Property');
assert.equal(scoped.spaces.length, 1, 'foreign floor must not enter report');
assert.equal(scoped.digitalTwinAssets.length, 1, 'foreign 3D asset must not enter report');
assert.equal(mixed.media.length, 2, 'original Data Room bundle must remain untouched');
// Dashboard readiness must not inherit another Property's ready Snapshot, assets or documents.
// The report builder already scopes mixed bundles; the readiness dashboard must do the same.
const foreignOnlyBundle = {
  ...bundle(docs().map((document) => ({ ...document, propertyId: 'foreign-property' }))),
  media: [{ id: 'foreign-photo', propertyId: 'foreign-property' }],
  dataSources: [{ id: 'foreign-source', propertyId: 'foreign-property' }],
  reportSnapshots: [{ id: 'foreign-final', propertyId: 'foreign-property', status: 'ready' }],
  digitalTwinAssets: [{ id: 'foreign-3d', propertyId: 'foreign-property', processingStatus: 'ready' }],
  spaces: [{ id: 'foreign-space', propertyId: 'foreign-property' }],
};
const dashboardProperty = {
  id: PROPERTY_ID, address: '서울 서초구 방배동 815-11',
  landAreaSqm: 100, totalFloorAreaSqm: 200, managerName: '검증 담당',
};
const foreignOnlyReadiness = readiness.assessPropertyReadiness(dashboardProperty, foreignOnlyBundle);
for (const stageId of ['documents', 'provenance', 'verification', 'media', 'report', 'digital_twin']) {
  assert.equal(foreignOnlyReadiness.stages.find((stage) => stage.id === stageId)?.state, 'missing',
    `foreign-only Data Room must not mark ${stageId} as ready`);
}
assert.equal(foreignOnlyReadiness.readyCount, 1, 'only the own Property core fields may be ready');


const verificationStage = (statuses, decisions = [], foreignRecords = []) => readiness.assessPropertyReadiness(dashboardProperty, {
  ...foreignOnlyBundle,
  verifications: [
    ...statuses.map((status) => ({ propertyId: PROPERTY_ID, status })),
    ...foreignRecords,
  ],
  verificationCandidates: decisions.map((decisionStatus) => ({ propertyId: PROPERTY_ID, decisionStatus })),
}).stages.find((stage) => stage.id === 'verification');
for (const [statuses, decisions, expected] of [
  [[], [], 'missing'],
  [['verified'], [], 'ready'],
  [['estimated'], [], 'partial'],
  [['confirmed'], [], 'partial'],
  [['verified', 'unverified'], [], 'partial'],
  [['verified'], ['pending'], 'partial'],
  [['verified'], ['held'], 'partial'],
  [[], ['pending'], 'partial'],
  [['verified'], ['approved', 'rejected'], 'ready'],
]) {
  assert.equal(verificationStage(statuses, decisions).state, expected,
    'verification stage must distinguish completed verification from recorded or unresolved work');
}
assert.equal(verificationStage([], [], [{ propertyId: 'foreign-property', status: 'verified' }]).state, 'missing',
  'foreign verification must not certify this Property');
assert.match(verificationStage(['verified'], ['held']).detail, /대기\/보류 1건/);
console.log('PASS dashboard verification readiness: nine status cases, Property isolation and unresolved count');

// A model upload is not an as-built, dimension-verified Digital Twin.
// This dashboard signal must not claim READY for failed, pending, sample,
// deleted, or another Property's 3D files.
const twinStage = (assets) => readiness.assessPropertyReadiness(dashboardProperty, {
  ...foreignOnlyBundle, digitalTwinAssets: assets,
}).stages.find((stage) => stage.id === 'digital_twin');
const twinAsset = (overrides = {}) => ({
  id: 'model-1', propertyId: PROPERTY_ID, assetType: 'glb', processingStatus: 'ready',
  metadata: {}, ...overrides,
});
assert.equal(twinStage([twinAsset({ assetType: 'floor_plan', processingStatus: 'uploaded' })]).state, 'partial',
  'an uploaded floor plan must not be READY 3D');
assert.equal(twinStage([twinAsset({ processingStatus: 'failed' })]).state, 'partial',
  'a failed 3D model must not be READY');
assert.equal(twinStage([twinAsset()]).state, 'partial',
  'a renderable but unverified 3D model must not claim dimensional verification');
assert.equal(twinStage([twinAsset({ deletedAt: '2026-10-24' })]).state, 'missing',
  'a deleted model is not an active Digital Twin');
assert.equal(twinStage([twinAsset({ propertyId: 'foreign-property', metadata: {
  horizontalScaleVerified: true, heightStatus: 'verified', sourceFloorPlanAssetId: 'plan-1',
} })]).state, 'missing', 'foreign 3D model must not count');
assert.equal(twinStage([twinAsset({ metadata: {
  horizontalScaleVerified: true, heightStatus: 'verified', sourceFloorPlanAssetId: 'plan-1',
} })]).state, 'partial', 'unlinked source plan must never certify 3D readiness');
assert.equal(twinStage([
  twinAsset({ id: 'plan-1', assetType: 'floor_plan', processingStatus: 'ready' }),
  twinAsset({ metadata: {
    horizontalScaleVerified: true, heightStatus: 'verified', sourceFloorPlanAssetId: 'plan-1',
  } }),
]).state, 'ready', 'ready source plan and dimensional verification metadata are required');
assert.match(twinStage([twinAsset()]).detail, /검증 필요/, 'unverified 3D must visibly disclose its limitations');
console.log('PASS Digital Twin readiness: failed/uploaded/unverified/deleted/foreign vs dimension-checked models');

const mixedDashboardBundle = {
  ...foreignOnlyBundle,
  documents: [...foreignOnlyBundle.documents, ...docs()],
  reportSnapshots: [...foreignOnlyBundle.reportSnapshots, { id: 'own-draft', propertyId: PROPERTY_ID, status: 'draft' }],
};
assert.deepEqual(
  readiness.assessPropertyReadiness(dashboardProperty, mixedDashboardBundle),
  readiness.assessPropertyReadiness(dashboardProperty, readiness.scopeDataRoomBundle(mixedDashboardBundle, PROPERTY_ID)),
  'mixed Data Room dashboard assessment must equal the authoritative Property-only assessment',
);

const assessed = readiness.assessRequiredDocumentReadiness(bundle());
assert.equal(assessed.connected.length, 4);
assert.equal(assessed.verified.length, 4);
assert.equal(readiness.assessRequiredDocumentReadiness(bundle(docs('confirmed'))).verified.length, 0);
assert.equal(readiness.assessRequiredDocumentReadiness(bundle(docs('confirmed'), [], [{
  fieldKey: 'document:doc-0', propertyId: PROPERTY_ID, status: 'verified',
}])).verified.length, 1);

const builder = readFileSync('src/services/reportEngine/reportDataBuilder.ts', 'utf8');
assert.match(builder, /scopeDataRoomBundle\(inputBundle,\s*property\.id\)/, 'Builder must isolate the entire Data Room bundle before rendering');
assert.match(builder, /asset\.propertyId\s*===\s*propertyId/, 'Generated 3D assets must be Property-scoped');
assert.match(builder, /assessRequiredDocumentReadiness\(bundle,\s*property\.id\)/, 'Report builder must scope evidence to its Property');
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
const snapshotSource = readFileSync('src/services/reportEngine/reportSnapshotService.ts', 'utf8');
assert.match(snapshotSource, /scopeDataRoomBundle\(await propertyDataRoomRepository\.getBundle\(current\.propertyId\),\s*current\.propertyId\)/,
  'Snapshot finalization must isolate mixed Data Room rows');
const snapshotService = loadTs('src/services/reportEngine/reportSnapshotService.ts', {
  '../../domain/professionalReport/reportAccessPolicy': mediaPolicy,
  '../../repositories/propertyDataRoomRepository': { propertyDataRoomRepository: repository },
  '../propertyReadinessService': { assessRequiredDocumentReadiness: readiness.assessRequiredDocumentReadiness, scopeDataRoomBundle: readiness.scopeDataRoomBundle },
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
// A mixed Data Room bundle must never use another Property's originals,
 // source inventory, or document attestations to finalize this Property's report.
await check('foreign Property original cannot satisfy required documents', bundle(
  docs().map((document, i) => i === 0 ? { ...document, propertyId: 'foreign-property' } : document),
), false);
await check('foreign Property verification cannot attest local document', bundle(
  docs('confirmed'), [], docs('confirmed').map((document) => ({
    propertyId: 'foreign-property', fieldKey: `document:${document.id}`, status: 'verified',
  })),
), false);
const foreignInventory = bundle([]);
foreignInventory.dataSources = [{
  propertyId: 'foreign-property', resourceType: 'source_document_inventory',
  metadata: { originalSourcePresence: 'confirmed', documentType: 'building_register' },
}];
assert.equal(readiness.assessRequiredDocumentReadiness(foreignInventory, PROPERTY_ID).present.length, 0,
  'foreign Property inventory must not count as original presence');
assert.equal(readiness.assessRequiredDocumentReadiness(bundle(docs()), PROPERTY_ID).verified.length, 4,
  'same Property originals must remain eligible');

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
].map((document) => ({ ...document, propertyId: PROPERTY_ID, storagePath: `property/document/${document.id}.pdf`, fileData: new Blob(['%PDF-1.7 test original']), fileSize: new Blob(['%PDF-1.7 test original']).size }));
assert.equal(readiness.assessRequiredDocumentReadiness(bundle(bangbaeFourFiles)).connected.length, 3, 'duplicate registry is not land register');
assert.equal(readiness.assessRequiredDocumentReadiness(bundle(bangbaeFourFiles)).verified.length, 3, 'four files do not equal four required document types');
await check('two registry copies cannot substitute for land register', bundle(bangbaeFourFiles), false);
await check('no connected original documents', bundle([]), false);
await check('explicit verified document attestation', bundle(docs('confirmed'), [], docs('confirmed').map(d => ({ propertyId: PROPERTY_ID, fieldKey: `document:${d.id}`, status: 'verified' }))), true);
await check('pending verification candidate', bundle(docs(), [{ propertyId: PROPERTY_ID, decisionStatus: 'pending' }]), false);
await check('held verification candidate', bundle(docs(), [{ propertyId: PROPERTY_ID, decisionStatus: 'held' }]), false);
await check('foreign pending candidate cannot block this Property', bundle(docs(), [{ propertyId: 'foreign-property', decisionStatus: 'pending' }]), true);
await check('foreign held candidate cannot block this Property', bundle(docs(), [{ propertyId: 'foreign-property', decisionStatus: 'held' }]), true);
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
await check('legacy spatial interior photo cannot be finalized', bundle(), false, true, (s) => {
  s.snapshotData.spatial = { media: [{ id: 'interior', mediaType: 'photo', sourceOrigin: 'owner_provided' }] };
});
await check('legacy spatial sample map cannot be finalized', bundle(), false, true, (s) => {
  s.snapshotData.spatial = { media: [{ id: 'sample', mediaType: 'map_capture', sourceOrigin: 'sample' }] };
});
await check('verified spatial roadview remains permitted', bundle(), true, true, (s) => {
  s.snapshotData.spatial = { media: [{ id: 'roadview', mediaType: 'roadview_capture', sourceOrigin: 'roadview' }] };
});
await check('unrelated property retains its own media policy', bundle(docs().map((document) => ({ ...document, propertyId: 'unrelated-property' }))), true, true, (s) => {
  s.propertyId = 'unrelated-property';
  s.snapshotData.identity.id = 'unrelated-property';
  s.snapshotData.media.internalPhotoAllowed = true;
  s.snapshotData.media.mainImage.value = 'allowed.jpg';
});
stale = true;
await check('stale snapshot', bundle(), false);
console.log('PASS report readiness alignment: 42 service scenarios + full Data Room Property isolation + binary integrity + distinct document types + shared policy + builder guards');

// Prevent stale/invalid/future-dated Snapshots from passing the final readiness gate.
await import('./validate-report-snapshot-freshness.mjs');
await import('./validate-report-final-provenance.mjs');

// Spatial media has no exterior/interior category. A generic photo is not proof
// of exterior origin; sample/unknown/AI media must never enter the report.
// Run the actual TS service with its real policy (not a reimplemented predicate).
const spatialView = loadTs('src/services/spatialMediaViewService.ts', {
  '../domain/propertyDataRoom/spatialMediaModel': {
    getSpatialVerificationLevel: (status) => ({
      unknown: 0, estimated: 1, ai_estimated: 1, source_provided: 2,
      document_verified: 3, field_checked: 4, owner_confirmed: 5, agent_verified: 5,
      conflict: 0, rejected: 0,
    })[status] ?? 0,
    isReportSafeMedia: (asset) =>
      asset.sourceOrigin !== 'ai_generated' &&
      !['conflict', 'rejected'].includes(asset.verificationStatus) &&
      ['report', 'public_share'].includes(asset.visibilityScope),
  },
  '../domain/professionalReport/reportAccessPolicy': mediaPolicy,
}).spatialMediaViewService;
const spatialAsset = (id, mediaType, sourceOrigin) => ({
  id, mediaType, sourceOrigin, visibilityScope: 'report',
  verificationStatus: 'source_provided', originalFilename: id + '.jpg',
});
const spatialBundle = {
  floorPlans: [], spaces: [], mediaSpaceLinks: [], viewerScenes: [], viewerNodes: [],
  viewerEdges: [], walkthroughRoutes: [], walkthroughSteps: [], verificationEvents: [],
  mediaAssets: [
    spatialAsset('generic-photo', 'photo', 'owner_provided'),
    spatialAsset('roadview', 'roadview_capture', 'roadview'),
    spatialAsset('floorplan', 'floorplan_image', 'owner_provided'),
    spatialAsset('sample-map', 'map_capture', 'sample'),
    spatialAsset('unknown-map', 'map_capture', 'unknown'),
    spatialAsset('ai-map', 'map_capture', 'ai_generated'),
  ],
};
const mediaIds = (result) => result.media.map((item) => item.id);
assert.deepEqual(mediaIds(spatialView.buildReportSpatialSnapshot(spatialBundle, false)), ['roadview', 'floorplan'],
  'Bangbae restricted report must not expose generic, sample, unknown, or AI media');
assert.deepEqual(mediaIds(spatialView.buildReportSpatialSnapshot(spatialBundle, true)), ['generic-photo', 'roadview', 'floorplan'],
  'unrestricted report must still reject sample/unknown/AI media');
assert.equal(spatialView.summarize(spatialBundle, false).reportSafeMedia, 2,
  'spatial readiness count must match the restricted report media payload');
assert.equal(spatialView.summarize(spatialBundle, true).reportSafeMedia, 3);
assert.deepEqual(mediaIds(spatialView.buildReportSpatialSnapshot({
  ...spatialBundle, mediaPolicy: { allowInteriorPhotos: false },
}, true)), ['roadview', 'floorplan'],
  'Data Room media policy must not be bypassed by an unrestricted caller');
assert.match(builder, /buildReportSpatialSnapshot\(spatialBundle,\s*internalPhotoAllowed\(property\)\)/,
  'report builder must propagate authoritative Property media restriction');
const snapshotPageSource = readFileSync('src/pages/ProfessionalReportSnapshotPage.tsx', 'utf8');
assert.match(snapshotPageSource, /spatial:\s*model\.spatial\s*\?/,
  'legacy Snapshot preview/print must sanitize spatial media before rendering');
assert.match(snapshotSource, /spatial:\s*viewModel\.spatial\s*\?/,
  'new Snapshot persistence must sanitize spatial media');
console.log('PASS typed spatial media privacy: restricted/unrestricted/legacy/policy/sample consistency');
