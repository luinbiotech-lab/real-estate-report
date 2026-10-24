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


// Execute the real ReportDataBuilder.build method with isolated read-only repositories.
// A mismatched Property lookup must fail before any spatial fetch or Snapshot assembly.
function loadReportBuilder(code) {
  const begin = code.indexOf('  async build(propertyId: string, options:');
  const end = code.indexOf('\n  }\n}\n\nexport const reportDataBuilder', begin);
  assert.ok(begin >= 0 && end > begin, 'actual report builder method must be present');
  const method = code.slice(begin, end + '\n  }'.length);
  const transpiled = ts.transpileModule(
    `class Harness { constructor() { this.now = () => '2026-10-24T00:00:00Z'; } ${method} }; module.exports = Harness;`,
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  return (state) => {
    const module = { exports: {} };
    runInNewContext(`(function(module) { ${transpiled}\n})`, {
      propertyRepository: { getById: async () => state.property },
      propertyDataRoomRepository: { getBundle: async () => ({ digitalTwinAssets: [] }) },
      spatialMediaRepository: { getBundle: async () => { state.spatialCalls += 1; return { floorPlans: [] }; } },
      scopeDataRoomBundle: (bundle) => bundle,
      scopeReportSpatialBundle: (bundle) => bundle,
      spatialMediaCompatibilityService: {
        mergePreferTyped: (typed) => typed,
        fromLegacyBundle: () => ({ floorPlans: [] }),
      },
      buildProfessionalReportViewModel: (property) => ({ identity: { id: property.id }, generated: {}, media: {} }),
      spatialMediaViewService: { buildReportSpatialSnapshot: () => ({ media: [] }) },
      internalPhotoAllowed: () => false,
      module, Date, Error, Promise,
    })(module);
    return new module.exports();
  };
}
const realBuilder = loadReportBuilder(builder);
const wrong = { property: { id: 'foreign' }, spatialCalls: 0 };
await assert.rejects(realBuilder(wrong).build(own), /물건 ID가 조회 결과와 일치하지 않습니다/);
assert.equal(wrong.spatialCalls, 0, 'foreign Property must be rejected before reading spatial assets');
const absent = { property: null, spatialCalls: 0 };
await assert.rejects(realBuilder(absent).build(own), /물건을 찾을 수 없습니다/);
const matching = { property: { id: own }, spatialCalls: 0 };
const built = await realBuilder(matching).build(own);
assert.equal(built.identity.id, own);
assert.equal(matching.spatialCalls, 1, 'matching Property should build normally');
// Negative control: the previous implementation assembled the wrong Property as a report.
const identityGuard = "if (property.id !== propertyId) throw new Error('보고서 대상 물건 ID가 조회 결과와 일치하지 않습니다. 다시 조회해 주세요.');";
assert.ok(builder.includes(identityGuard), 'identity guard must exist in actual builder');
const weakenedBuilder = loadReportBuilder(builder.replace(identityGuard, '/* removed Property identity guard */'));
const leaked = { property: { id: 'foreign' }, spatialCalls: 0 };
assert.equal((await weakenedBuilder(leaked).build(own)).identity.id, 'foreign', 'negative control must reproduce cross-Property report');
console.log('PASS report Property lookup identity mismatch: fail-closed, missing Property, valid build, negative control');
