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
  floorPlans: [{ id: 'plan', floorId: 'floor-1', scaleStatus: 'unknown', extractionStatus: 'uploaded', verificationStatus: 'estimated' }],
  spaces: [{ id: 'space', floorId: 'floor-1', verificationStatus: 'estimated' }],
  mediaAssets: [{ id: 'media', mediaType: 'floorplan_image', sourceOrigin: 'public_source', visibilityScope: 'report', verificationStatus: 'estimated' }],
  mediaSpaceLinks: [], viewerScenes: [], walkthroughRoutes: [], walkthroughSteps: [], verificationEvents: [],
};
const ready = clone(baseline);
Object.assign(ready.floorPlans[0], { scaleStatus: 'verified', extractionStatus: 'verified', verificationStatus: 'document_verified' });
ready.spaces[0].verificationStatus = 'document_verified';
ready.mediaAssets[0].verificationStatus = 'document_verified';
ready.mediaSpaceLinks = [{ id: 'link', mediaAssetId: 'media', spaceId: 'space', floorId: 'floor-1', matchStatus: 'verified', verificationStatus: 'document_verified' }];
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
const orphanSpace = clone(ready);
orphanSpace.spaces[0].floorId = 'other-floor';
assert.equal(reportReady(orphanSpace), false, 'verified space linked to another floor must not certify plan');
const missingPlanFloor = clone(ready);
delete missingPlanFloor.floorPlans[0].floorId;
assert.equal(reportReady(missingPlanFloor), false, 'verified plan without floor ID must not certify 3D');
const missingSpaceFloor = clone(ready);
delete missingSpaceFloor.spaces[0].floorId;
assert.equal(reportReady(missingSpaceFloor), false, 'verified space without floor ID must not certify 3D');
const emptySecondFloor = clone(ready);
emptySecondFloor.floorPlans.push({ ...ready.floorPlans[0], id: 'plan-2', floorId: 'floor-2' });
assert.equal(reportReady(emptySecondFloor), false, 'another verified floor without a verified mapped space must block');
const validSecondFloor = clone(emptySecondFloor);
validSecondFloor.spaces.push({ ...ready.spaces[0], id: 'space-2', floorId: 'floor-2' });
validSecondFloor.mediaSpaceLinks.push({ ...ready.mediaSpaceLinks[0], id: 'link-2', spaceId: 'space-2', floorId: 'floor-2' });
assert.equal(reportReady(validSecondFloor), true, 'two independently mapped verified floors remain report-ready');
const deleted = clone(ready);
deleted.floorPlans[0].deletedAt = '2026-10-24T00:00:00Z';
assert.equal(reportReady(deleted), false, 'deleted plan must not count');
const conflict = clone(ready);
conflict.spaces[0].verificationStatus = 'conflict';
assert.equal(reportReady(conflict), false, 'conflicting evidence must block');
const sample = clone(ready);
sample.mediaAssets[0].sourceOrigin = 'sample';
assert.equal(reportReady(sample), false, 'sample media must not be report-grade evidence');
const unlinked = clone(ready);
unlinked.mediaSpaceLinks = [];
assert.equal(reportReady(unlinked), false, 'verified media without a space link must not certify a floor');
const suggestedLink = clone(ready);
suggestedLink.mediaSpaceLinks[0].matchStatus = 'suggested';
assert.equal(reportReady(suggestedLink), false, 'suggested media-space matches must not certify a floor');
const unverifiedLink = clone(ready);
unverifiedLink.mediaSpaceLinks[0].verificationStatus = 'estimated';
assert.equal(reportReady(unverifiedLink), false, 'unverified media-space link must not certify a floor');
const foreignAssetLink = clone(ready);
foreignAssetLink.mediaSpaceLinks[0].mediaAssetId = 'other-media';
assert.equal(reportReady(foreignAssetLink), false, 'link to a different media asset must not certify a floor');
const foreignSpaceLink = clone(ready);
foreignSpaceLink.mediaSpaceLinks[0].spaceId = 'other-space';
assert.equal(reportReady(foreignSpaceLink), false, 'link to a different space must not certify a floor');
const wrongFloorLink = clone(ready);
wrongFloorLink.mediaSpaceLinks[0].floorId = 'floor-2';
assert.equal(reportReady(wrongFloorLink), false, 'link floor must agree with the verified space floor');
const deletedLink = clone(ready);
deletedLink.mediaSpaceLinks[0].deletedAt = '2026-10-24T00:00:00Z';
assert.equal(reportReady(deletedLink), false, 'deleted links must not certify a floor');
const unmappedSecondFloor = clone(validSecondFloor);
unmappedSecondFloor.mediaSpaceLinks.pop();
assert.equal(reportReady(unmappedSecondFloor), false, 'every verified plan floor requires a verified media-space mapping');
// Negative control: removing the verified-evidence gate reproduces the false-ready condition.
const strict = 'spatialReady && verifiedScaledPlan && verifiedSpace && verifiedReportMedia && verifiedMediaMapping && conflictCount === 0';
assert.ok(source.includes(strict), 'strict guard must remain in the real service');
const weakened = load(source.replace(strict, 'spatialReady && reportSafeMediaCount(mediaAssets, photosAllowed) > 0 && conflictCount === 0'));
assert.equal(weakened.summarize(baseline, false).reportSpatialReady, true, 'negative control must reproduce false-ready');
console.log('PASS report spatial evidence readiness: 26 cases + permissive-formula negative control');
