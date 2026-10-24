import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Execute the actual TypeScript service; only its external policy dependencies are stubbed.
const source = readFileSync('src/services/spatialMediaViewService.ts', 'utf8');
const levels = { unknown: 0, estimated: 1, ai_estimated: 1, source_provided: 2, document_verified: 3, field_checked: 4, owner_confirmed: 5, agent_verified: 5, conflict: 0, rejected: 0 };
function load(code) {
  const compiled = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  const imports = {
    '../domain/propertyDataRoom/spatialMediaModel': {
      getSpatialVerificationLevel: (status) => levels[status],
      isReportSafeMedia: (asset) => (asset.visibilityScope === 'report' || asset.visibilityScope === 'public_share') &&
        asset.sourceOrigin !== 'ai_generated' && !['conflict', 'rejected'].includes(asset.verificationStatus),
    },
    '../domain/professionalReport/reportAccessPolicy': {
      reportSpatialMediaAllowed: (type, origin, allowInternal) => !['sample', 'unknown', 'ai_generated'].includes(origin) &&
        (allowInternal || ['roadview_capture', 'map_capture', 'floorplan_image', 'drone_image'].includes(type)),
    },
  };
  runInNewContext(`(function(require, module, exports) { ${compiled}\n})`, { Set, Math })(
    (name) => { assert.ok(Object.hasOwn(imports, name), `unexpected import: ${name}`); return imports[name]; },
    module, module.exports,
  );
  return module.exports.spatialMediaViewService;
}
const service = load(source);
const clone = (value) => JSON.parse(JSON.stringify(value));
const baseline = {
  floorPlans: [{ id: 'plan', scaleStatus: 'unknown', extractionStatus: 'uploaded', verificationStatus: 'estimated' }],
  spaces: [{ id: 'space', verificationStatus: 'estimated' }],
  mediaAssets: [{ id: 'media', mediaType: 'floorplan_image', sourceOrigin: 'public_source', visibilityScope: 'report', verificationStatus: 'estimated' }],
  mediaSpaceLinks: [], viewerScenes: [], walkthroughRoutes: [], walkthroughSteps: [], verificationEvents: [],
};
const ready = clone(baseline);
Object.assign(ready.floorPlans[0], { scaleStatus: 'verified', extractionStatus: 'verified', verificationStatus: 'document_verified' });
ready.spaces[0].verificationStatus = 'document_verified';
ready.mediaAssets[0].verificationStatus = 'document_verified';
const reportReady = (bundle) => service.summarize(bundle, false).reportSpatialReady;
assert.equal(reportReady(baseline), false, 'estimated/uploaded evidence must not be report-ready');
assert.equal(reportReady(ready), true, 'verified plan/space/media can be report-ready');
for (const field of ['scaleStatus', 'extractionStatus', 'verificationStatus']) {
  const item = clone(ready);
  item.floorPlans[0][field] = baseline.floorPlans[0][field];
  assert.equal(reportReady(item), false, `unverified floor plan ${field} must block`);
}
for (const type of ['spaces', 'mediaAssets']) {
  const item = clone(ready);
  item[type][0].verificationStatus = 'estimated';
  assert.equal(reportReady(item), false, `estimated ${type} must block`);
}
const mixedPlan = clone(ready);
mixedPlan.floorPlans.push({ id: 'other-floor', scaleStatus: 'unknown', extractionStatus: 'uploaded', verificationStatus: 'estimated' });
assert.equal(reportReady(mixedPlan), false, 'another unscaled floor must block full report spatial readiness');
const mixedSpace = clone(ready);
mixedSpace.spaces.push({ id: 'unverified-room', verificationStatus: 'estimated' });
assert.equal(reportReady(mixedSpace), false, 'another estimated space must block full report spatial readiness');
const mixedMedia = clone(ready);
mixedMedia.mediaAssets.push({ id: 'unverified-image', mediaType: 'map_capture', sourceOrigin: 'public_source', visibilityScope: 'report', verificationStatus: 'estimated' });
assert.equal(reportReady(mixedMedia), false, 'another unverified included image must block full report spatial readiness');
const deleted = clone(ready);
deleted.floorPlans[0].deletedAt = '2026-10-24T00:00:00Z';
assert.equal(reportReady(deleted), false, 'deleted plan must not count');
const conflict = clone(ready);
conflict.spaces[0].verificationStatus = 'conflict';
assert.equal(reportReady(conflict), false, 'conflicting evidence must block');
const sample = clone(ready);
sample.mediaAssets[0].sourceOrigin = 'sample';
assert.equal(reportReady(sample), false, 'sample media must not be report-grade evidence');
// Negative control: removing the verified-evidence gate reproduces the false-ready condition.
const strict = 'spatialReady && verifiedScaledPlan && verifiedSpace && verifiedReportMedia && conflictCount === 0';
assert.ok(source.includes(strict), 'strict guard must remain in the real service');
const weakened = load(source.replace(strict, 'spatialReady && reportSafeMediaCount(mediaAssets, photosAllowed) > 0 && conflictCount === 0'));
assert.equal(weakened.summarize(baseline, false).reportSpatialReady, true, 'negative control must reproduce false-ready');
console.log('PASS report spatial evidence readiness: 13 cases + permissive-formula negative control');
