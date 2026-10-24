import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function load(path, imports = {}, override) {
  const source = override ?? readFileSync(path, 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const module = { exports: {} };
  runInNewContext(`(function(require, module, exports) { ${js}\n})`, { Set, Map, Math })(
    (name) => {
      assert.ok(Object.hasOwn(imports, name), `unexpected runtime import: ${name}`);
      return imports[name];
    }, module, module.exports,
  );
  return module.exports;
}
const model = load('src/domain/propertyDataRoom/spatialMediaModel.ts');
const reportPolicy = load('src/domain/professionalReport/reportAccessPolicy.ts', {
  '../propertyDataRoom/bangbaeIdentity': { BANGBAE_815_11_PROPERTY_IDS: [
    'sample-bangbae-815-11', 'daon-bangbae-815-11',
  ] },
});
const scope = load('src/services/reportEngine/reportSpatialPropertyScope.ts');
const compatibility = load('src/services/spatialMediaCompatibilityService.ts');
const scopeLegacy = (bundle, propertyId) => {
  const result = { ...bundle };
  for (const key of ['documents', 'media', 'verifications', 'verificationCandidates', 'dataSources',
    'reportSnapshots', 'digitalTwinAssets', 'spaces', 'spaceMediaLinks']) {
    result[key] = (bundle[key] ?? []).filter((row) => row.propertyId === propertyId);
  }
  return result;
};
const imports = {
  '../domain/propertyDataRoom/spatialMediaModel': model,
  '../domain/professionalReport/reportAccessPolicy': reportPolicy,
  './propertyReadinessService': { scopeDataRoomBundle: scopeLegacy },
  './reportEngine/reportSpatialPropertyScope': scope,
  './spatialMediaCompatibilityService': { spatialMediaCompatibilityService: compatibility.spatialMediaCompatibilityService },
};
const path = 'src/services/spatialDataRoomPanelPolicy.ts';
const source = readFileSync(path, 'utf8');
const policy = load(path, imports);
const empty = () => ({
  floorPlans: [], spaces: [], mediaAssets: [], mediaSpaceLinks: [], viewerScenes: [],
  viewerNodes: [], viewerEdges: [], walkthroughRoutes: [], walkthroughSteps: [], verificationEvents: [],
});
const typed = empty();
typed.floorPlans = [{ id: 'own-plan', propertyId: 'a' }, { id: 'foreign-plan', propertyId: 'b' }];
typed.mediaAssets = [{ id: 'own-media', propertyId: 'a' }, { id: 'foreign-media', propertyId: 'b' }];
typed.mediaPolicy = { propertyId: 'b', allowInteriorPhotos: true };
const filtered = policy.prepareSpatialPanelBundle(typed, undefined, 'a');
assert.deepEqual(Array.from(filtered.floorPlans, (row) => row.id), ['own-plan']);
assert.deepEqual(Array.from(filtered.mediaAssets, (row) => row.id), ['own-media']);
assert.equal(filtered.mediaPolicy, undefined, 'foreign policy must be discarded');
const legacy = {
  digitalTwinAssets: [], spaces: [], spaceMediaLinks: [],
  media: ['a', 'b'].map((propertyId) => ({
    id: propertyId, propertyId, mediaType: 'image', fileName: propertyId + '.jpg',
    storagePath: propertyId, aiTags: [], verificationStatus: 'verified', createdAt: '2026-10-25',
  })),
};
assert.deepEqual(Array.from(policy.prepareSpatialPanelBundle(empty(), legacy, 'a').mediaAssets, (row) => row.id), ['legacy-media-a']);
assert.deepEqual(Array.from(policy.prepareSpatialPanelBundle(empty(), legacy, 'b').mediaAssets, (row) => row.id), ['legacy-media-b']);
const normal = { ...empty(), mediaPolicy: { propertyId: 'a', allowInteriorPhotos: true } };
assert.equal(policy.getSpatialPanelPolicy(normal, 'a').allowInteriorPhotos, true);
assert.equal(policy.getSpatialPanelPolicy(normal, 'b'), undefined);
const locked = { ...empty(), mediaPolicy: { propertyId: 'sample-bangbae-815-11', allowInteriorPhotos: true, allowExteriorPhotos: false } };
assert.equal(policy.getSpatialPanelPolicy(locked, 'sample-bangbae-815-11').allowInteriorPhotos, false);
assert.equal(policy.getSpatialPanelPolicy(locked, 'sample-bangbae-815-11').allowExteriorPhotos, false);
assert.equal(policy.getSpatialPanelPolicy(empty(), 'arbitrary', '방배동 815-11').allowInteriorPhotos, false);
assert.equal(policy.getSpatialPanelPolicy(empty(), 'arbitrary', '동광로18길 7').allowInteriorPhotos, false);
const weakened = load(path, imports, source.replace('allowInteriorPhotos: false', 'allowInteriorPhotos: true'));
assert.equal(weakened.getSpatialPanelPolicy(locked, 'sample-bangbae-815-11').allowInteriorPhotos, true,
  'negative control must reproduce forbidden override');
const ui = readFileSync('src/components/propertyDataRoom/SpatialDataRoomPanel.tsx', 'utf8');
for (const marker of [
  'const version = ++requestVersion.current;',
  'if (version !== requestVersion.current) return;',
  'requestVersion.current += 1;',
  'loadedPropertyId !== propertyId',
  'prepareSpatialPanelBundle(typed, legacyBundle, propertyId)',
  'prepareSpatialPanelBundle(emptySpatialBundle, legacyBundle, propertyId)',
  'spatialMediaViewService.summarize(bundle, allowInteriorPhotos)',
]) assert.ok(ui.includes(marker), `missing spatial panel isolation contract: ${marker}`);
assert.ok(!ui.includes('spatialMediaCompatibilityService.mergePreferTyped(typed, legacyBundle)'));
console.log('PASS spatial panel Property isolation, hard-deny, route race guards, negative control');
