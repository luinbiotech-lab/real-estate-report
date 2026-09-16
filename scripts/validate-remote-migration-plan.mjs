import { existsSync, readFileSync } from 'node:fs';

const files = {
  planner: 'src/services/remoteMigrationPlanService.ts',
  gateway: 'src/services/remoteDataGateway.ts',
  database: 'src/repositories/database.ts',
  dataMigration: 'supabase/migrations/20260916_property_data_rls.sql',
  assetMigration: 'supabase/migrations/20260916_property_asset_storage.sql',
};

for (const file of Object.values(files)) {
  if (!existsSync(file)) throw new Error(`Remote migration dry-run 필수 파일 누락: ${file}`);
}

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readFileSync(file, 'utf8')]));

for (const marker of [
  "REMOTE_MIGRATION_PLAN_VERSION = 'daon-remote-migration-plan-v1'",
  'export interface LocalMigrationSnapshot',
  'export interface RemoteMigrationPlan',
  'dryRun: true',
  'networkWrites: 0',
  "'MISSING_PROPERTY_ID'",
  "'ORPHAN_PROPERTY_REFERENCE'",
  "'INLINE_DATA_URL'",
  "'INLINE_BINARY'",
  "'MISSING_ASSET_BINARY'",
  "'ASSET_TOO_LARGE'",
  "'UNSUPPORTED_STORE'",
  "const MAX_REMOTE_ASSET_BYTES = 50 * 1024 * 1024",
  "for (const store of ['propertyDocuments', 'propertyMedia', 'digitalTwinAssets'] as const)",
  'stripBinaryFields',
  'delete metadataPayload.url',
  'delete metadataPayload.fileUrl',
  'delete metadataPayload.storagePath',
  'function hasInlineBinary(',
  'value instanceof ArrayBuffer || ArrayBuffer.isView(value)',
  'function structuredPayloadIsSafe(',
  "structuredPayloadIsSafe('properties'",
  "structuredPayloadIsSafe('propertyVerificationCandidates'",
  "structuredPayloadIsSafe('propertyVerifications'",
  "structuredPayloadIsSafe('reportSnapshots'",
  "structuredPayloadIsSafe('companySettings'",
  "binarySource: hasLocalBinary ? 'blob'",
  'readyForRemoteWrite: blockers.length === 0',
]) {
  if (!text.planner.includes(marker)) throw new Error(`Remote migration planner 계약 누락: ${marker}`);
}

if (/fetch\s*\(|\.from\s*\(|\.upload\s*\(|remoteDataGateway\./.test(text.planner)) {
  throw new Error('Dry-run planner에서 네트워크/remote write를 수행하면 안 됩니다.');
}

for (const store of [
  'propertyDataSources', 'agentJobs', 'agentResults', 'agentReviews', 'propertySpaces',
  'spaceMediaLinks', 'spaceRoomLinks', 'propertyFacilities', 'roomEvidencePositions',
  'roomConditionHistory', 'renovationAssessments', 'roomRenovationAssessments',
  'roomRenovationHistory', 'riskAssessments', 'buildingReleaseSnapshots',
  'buildingReleaseSnapshotStates', 'buildingReleaseShares', 'buildingReleaseReviewNotes',
]) {
  if (!text.planner.includes(`'${store}'`)) throw new Error(`Remote object mapping 누락: ${store}`);
}

for (const binaryStore of ['propertyDocuments', 'propertyMedia', 'digitalTwinAssets']) {
  if (!text.database.includes(`'${binaryStore}'`)) throw new Error(`Local binary store 누락: ${binaryStore}`);
  if (!text.planner.includes(`'${binaryStore}'`)) throw new Error(`Binary upload planning 누락: ${binaryStore}`);
}

for (const marker of [
  'property_verification_candidates',
  'property_verifications',
  'report_snapshots',
  'company_settings',
]) {
  if (!text.dataMigration.includes(marker)) throw new Error(`Remote dedicated table 누락: ${marker}`);
}
if (!text.assetMigration.includes('property_assets_no_inline_binary')) throw new Error('Remote asset inline-binary 차단 constraint가 필요합니다.');
if (!text.assetMigration.includes("'daon-property-assets'")) throw new Error('Remote asset private bucket 계약이 필요합니다.');
if (!text.gateway.includes('export interface RemoteDataGateway')) throw new Error('Remote Data Gateway contract가 필요합니다.');

console.log('Remote migration dry-run planner boundary: PASS');
