import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Execute the actual TS scope helper, not a duplicated model of its behavior.
const source = readFileSync('src/services/reportEngine/reportSpatialPropertyScope.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function load(code) {
  const module = { exports: {} };
  runInNewContext(`(function(module, exports) { ${code}\n})`, { Set, Map })(module, module.exports);
  return module.exports.scopeReportSpatialBundle;
}
const scope = load(compiled);
const own = 'P';
const foreign = 'Q';
const row = (id, propertyId = own, extra = {}) => ({ id, propertyId, ...extra });
const bundle = {
  mediaPolicy: { propertyId: foreign, allowInteriorPhotos: true },
  floorPlans: [row('plan'), row('foreign-plan', foreign)],
  spaces: [row('space'), row('foreign-space', foreign)],
  mediaAssets: [row('media'), row('foreign-media', foreign)],
  mediaSpaceLinks: [row('link', own, { mediaAssetId: 'media', spaceId: 'space' }), row('foreign-link', foreign, { mediaAssetId: 'foreign-media' }), row('cross-link', own, { mediaAssetId: 'foreign-media' })],
  viewerScenes: [row('scene', own, { floorPlanId: 'plan' }), row('foreign-scene', foreign), row('cross-scene', own, { floorPlanId: 'foreign-plan' })],
  viewerNodes: [row('node', own, { sceneId: 'scene', spaceId: 'space' }), row('foreign-node', foreign, { sceneId: 'foreign-scene' }), row('cross-node', own, { sceneId: 'scene', linkedMediaAssetId: 'foreign-media' }), row('dangling-node', own, { sceneId: 'scene', linkedViewerNodeId: 'cross-node' })],
  viewerEdges: [{ id: 'edge', sceneId: 'scene', fromNodeId: 'node', toNodeId: 'node' }, { id: 'foreign-edge', sceneId: 'foreign-scene', fromNodeId: 'foreign-node', toNodeId: 'foreign-node' }, { id: 'cross-edge', sceneId: 'scene', fromNodeId: 'node', toNodeId: 'foreign-node' }],
  walkthroughRoutes: [row('route'), row('foreign-route', foreign)],
  walkthroughSteps: [{ id: 'step', routeId: 'route', viewerNodeId: 'node' }, { id: 'foreign-step', routeId: 'foreign-route' }, { id: 'cross-step', routeId: 'route', mediaAssetId: 'foreign-media' }],
  verificationEvents: [row('verification', own, { targetType: 'space', targetId: 'space' }), row('foreign-verification', foreign, { targetType: 'space', targetId: 'foreign-space' }), row('cross-verification', own, { targetType: 'space', targetId: 'foreign-space' })],
};
const expected = {
  floorPlans: ['plan'], spaces: ['space'], mediaAssets: ['media'], mediaSpaceLinks: ['link'],
  viewerScenes: ['scene'], viewerNodes: ['node'], viewerEdges: ['edge'],
  walkthroughRoutes: ['route'], walkthroughSteps: ['step'], verificationEvents: ['verification'],
};
const result = scope(bundle, own);
for (const [key, ids] of Object.entries(expected)) {
  assert.deepEqual(Array.from(result[key], (entry) => entry.id), ids, `${key}: foreign or dangling reference must be excluded`);
}
assert.equal(result.mediaPolicy, undefined, 'foreign media policy must not authorize interior photos');
const ownPolicy = { propertyId: own, allowInteriorPhotos: false };
assert.equal(scope({ ...bundle, mediaPolicy: ownPolicy }, own).mediaPolicy, ownPolicy, 'own media policy must be preserved');
assert.equal(bundle.floorPlans.length, 2, 'source bundle must not be mutated');
// Verify the builder actually uses this boundary on typed AND legacy input.
const builder = readFileSync('src/services/reportEngine/reportDataBuilder.ts', 'utf8');
assert.match(builder, /scopeReportSpatialBundle\(typedSpatialBundle, property\.id\)/);
assert.match(builder, /scopeDataRoomBundle\(bundle, property\.id\)/);
assert.match(builder, /mergePreferTyped\(scopeReportSpatialBundle\(typedSpatialBundle, property\.id\), scopedBundle\)/);
assert.match(builder, /fromLegacyBundle\(scopedBundle\)/);
// Negative control: removing the primary floor-plan owner filter must leak a foreign row.
const weakened = source.replace('bundle.floorPlans.filter((row) => row.propertyId === propertyId)', 'bundle.floorPlans.filter((row) => true)');
assert.notEqual(weakened, source, 'negative control must mutate real source');
const weakenedCompiled = ts.transpileModule(weakened, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
assert.deepEqual(Array.from(load(weakenedCompiled)(bundle, own).floorPlans, (entry) => entry.id), ['plan', 'foreign-plan'], 'negative control must reproduce foreign plan contamination');
console.log('PASS report spatial Property boundary: 10 typed collections, policy, cross-references, legacy builder wiring, negative control');
