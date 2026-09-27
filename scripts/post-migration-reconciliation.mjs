const projectUrl = (process.env.SUPABASE_PROJECT_URL || '').trim().replace(/\/+$/, '');
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const propertyId = (process.env.DAON_RECONCILE_PROPERTY_ID || 'daon-bangbae-815-11').trim();

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

const [objects, assets, candidates, verifications, snapshots] = await Promise.all([
  rows('property_objects', 'object_type,id,property_id'),
  rows('property_assets', 'resource_type,id,property_id,storage_path,original_file_name,mime_type,file_size'),
  rows('property_verification_candidates', 'id,property_id,decision_status'),
  rows('property_verifications', 'id,property_id'),
  rows('report_snapshots', 'id,property_id,status'),
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
  },
  storageChecks,
  passed: propertyRows.length === 1 && storageChecks.length === assets.length,
};

console.log(JSON.stringify(summary, null, 2));
if (!summary.passed) process.exitCode = 1;
