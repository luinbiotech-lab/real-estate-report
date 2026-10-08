const projectUrl = (process.env.SUPABASE_PROJECT_URL || '').trim().replace(/\/+$/, '');
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const propertyId = (process.env.DAON_RECONCILE_PROPERTY_ID || 'sample-bangbae-815-11').trim();

if (!projectUrl) throw new Error('SUPABASE_PROJECT_URL이 필요합니다.');
if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY가 필요합니다.');
if (!propertyId) throw new Error('DAON_RECONCILE_PROPERTY_ID가 필요합니다.');

const origin = new URL(projectUrl);
if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash) {
  throw new Error('SUPABASE_PROJECT_URL은 credential/query/hash 없는 HTTPS origin이어야 합니다.');
}

const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
};

async function fetchJson(path, init = {}) {
  const response = await fetch(`${origin.origin}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
    cache: 'no-store',
    redirect: 'error',
  });
  const text = await response.text();
  let payload = text;
  if (text) {
    try { payload = JSON.parse(text); } catch {}
  }
  if (!response.ok) throw new Error(`Request failed ${response.status} ${path}: ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`);
  return payload;
}

function eq(value) {
  return encodeURIComponent(`eq.${value}`);
}

async function rows(table, select = '*') {
  const payload = await fetchJson(`/rest/v1/${table}?select=${encodeURIComponent(select)}&property_id=${eq(propertyId)}`);
  if (!Array.isArray(payload)) throw new Error(`${table}: array response expected`);
  return payload;
}

const propertyRows = await fetchJson(`/rest/v1/properties?select=id&id=${eq(propertyId)}`);
if (!Array.isArray(propertyRows) || propertyRows.length !== 1) {
  throw new Error(`Production property count must be exactly 1 for ${propertyId}; observed=${Array.isArray(propertyRows) ? propertyRows.length : 'invalid'}`);
}

const [
  objects,
  assets,
  candidates,
  verifications,
  snapshots,
  mediaPolicies,
  floorPlans,
  spatialSpaces,
  mediaAssets,
  mediaSpaceLinks,
  viewerScenes,
  viewerNodes,
  viewerEdges,
  walkthroughRoutes,
  walkthroughSteps,
  verificationEvents,
] = await Promise.all([
  rows('property_objects', 'object_type,id,property_id,payload'),
  rows('property_assets', 'resource_type,id,property_id,storage_path,original_file_name,mime_type,file_size'),
  rows('property_verification_candidates', 'id,property_id,decision_status'),
  rows('property_verifications', 'id,property_id'),
  rows('report_snapshots', 'id,property_id,status'),
  rows('property_media_policies', 'property_id,allow_interior_photos,allow_exterior_photos,allow_roadview,allow_public_map,allow_ai_visualization'),
  rows('floor_plans', 'id,property_id,extraction_status,verification_status,deleted_at'),
  rows('property_spaces_spatial', 'id,property_id,floor_id,space_name,verification_status,deleted_at'),
  rows('media_assets', 'id,property_id,media_type,origin,verification_status,deleted_at'),
  rows('media_space_links', 'id,property_id,match_status,verification_status,deleted_at'),
  rows('viewer_scenes', 'id,property_id,scene_type,generation_status,verification_status,deleted_at'),
  rows('viewer_nodes', 'id,property_id,scene_id,space_id,node_type,verification_status,deleted_at'),
  rows('viewer_edges', 'id,property_id,scene_id,from_node_id,to_node_id'),
  rows('walkthrough_routes', 'id,property_id,route_type,deleted_at'),
  rows('walkthrough_steps', 'id,property_id,route_id,space_id,verification_status,deleted_at'),
  rows('verification_events', 'id,property_id,target_type,target_id,new_status,verification_level'),
]);

const storageChecks = [];
for (const asset of assets) {
  const path = String(asset.storage_path || '');
  if (!path) throw new Error(`Asset ${asset.resource_type}/${asset.id} has no storage_path`);
  const response = await fetch(`${origin.origin}/storage/v1/object/daon-property-assets/${path.split('/').map(encodeURIComponent).join('/')}`, {
    headers,
    cache: 'no-store',
    redirect: 'error',
  });
  if (!response.ok) throw new Error(`Storage round-trip failed ${response.status}: ${path}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const expectedSize = Number(asset.file_size ?? bytes.byteLength);
  if (Number.isFinite(expectedSize) && expectedSize >= 0 && bytes.byteLength !== expectedSize) {
    throw new Error(`Storage size mismatch: ${path} expected=${expectedSize} observed=${bytes.byteLength}`);
  }
  storageChecks.push({
    resourceType: asset.resource_type,
    id: asset.id,
    storagePath: path,
    bytes: bytes.byteLength,
    mimeType: response.headers.get('content-type') || asset.mime_type || null,
  });
}

const active = (rows) => rows.filter((item) => !item.deleted_at);
const comparableSource = objects.find((item) =>
  item.object_type === 'propertyDataSources' &&
  item.payload?.resourceType === 'comparable_transaction_set' &&
  item.payload?.fieldKey === 'nearbyTransactions'
);
const exteriorEvidence = objects.find((item) =>
  item.object_type === 'propertyDataSources' &&
  item.payload?.resourceType === 'exterior_photo_embedded_report_evidence'
);
const comparableRows = Array.isArray(comparableSource?.payload?.metadata?.rows)
  ? comparableSource.payload.metadata.rows
  : [];
const comparableProvenance = comparableSource?.payload?.metadata?.provenance;

const bangbaeContract = propertyId === 'sample-bangbae-815-11'
  ? {
      mediaPolicyPresent: mediaPolicies.length === 1,
      interiorPhotosProhibited: mediaPolicies.length === 1 && mediaPolicies[0].allow_interior_photos === false,
      typedSpaces: active(spatialSpaces).length,
      viewerScenes: active(viewerScenes).length,
      viewerNodes: active(viewerNodes).length,
      viewerEdges: viewerEdges.length,
      walkthroughRoutes: active(walkthroughRoutes).length,
      walkthroughSteps: active(walkthroughSteps).length,
      verificationEvents: verificationEvents.length,
      comparableRows: comparableRows.length,
      comparableProvenanceComplete: comparableProvenance?.status === 'complete' &&
        Number(comparableProvenance?.completeCount) === 6 &&
        Number(comparableProvenance?.missingCount) === 0,
      exteriorEvidencePresent: Boolean(exteriorEvidence),
      exteriorOnlyEvidence: exteriorEvidence?.payload?.metadata?.interiorMediaExcluded === true &&
        exteriorEvidence?.payload?.metadata?.directMediaAssetConnected === false,
      actualFloorPlans: active(floorPlans).length,
      actualMediaAssets: active(mediaAssets).length,
      reportSnapshots: snapshots.length,
    }
  : undefined;

const bangbaePassed = !bangbaeContract || (
  bangbaeContract.mediaPolicyPresent &&
  bangbaeContract.interiorPhotosProhibited &&
  bangbaeContract.typedSpaces === 5 &&
  bangbaeContract.viewerScenes >= 1 &&
  bangbaeContract.viewerNodes === 5 &&
  bangbaeContract.viewerEdges === 4 &&
  bangbaeContract.walkthroughRoutes >= 1 &&
  bangbaeContract.walkthroughSteps === 5 &&
  bangbaeContract.verificationEvents >= 11 &&
  bangbaeContract.comparableRows === 6 &&
  bangbaeContract.comparableProvenanceComplete &&
  bangbaeContract.exteriorEvidencePresent &&
  bangbaeContract.exteriorOnlyEvidence &&
  bangbaeContract.reportSnapshots >= 1
);

const summary = {
  propertyId,
  writesPerformed: 0,
  counts: {
    properties: propertyRows.length,
    objects: objects.length,
    assets: assets.length,
    verificationCandidates: candidates.length,
    verifications: verifications.length,
    reportSnapshots: snapshots.length,
    storageObjectsVerified: storageChecks.length,
    mediaPolicies: mediaPolicies.length,
    floorPlans: active(floorPlans).length,
    spatialSpaces: active(spatialSpaces).length,
    mediaAssets: active(mediaAssets).length,
    mediaSpaceLinks: active(mediaSpaceLinks).length,
    viewerScenes: active(viewerScenes).length,
    viewerNodes: active(viewerNodes).length,
    viewerEdges: viewerEdges.length,
    walkthroughRoutes: active(walkthroughRoutes).length,
    walkthroughSteps: active(walkthroughSteps).length,
    verificationEvents: verificationEvents.length,
  },
  bangbaeContract,
  storageChecks,
  passed: propertyRows.length === 1 && storageChecks.length === assets.length && bangbaePassed,
};

console.log(JSON.stringify(summary, null, 2));
if (!summary.passed) process.exitCode = 1;
