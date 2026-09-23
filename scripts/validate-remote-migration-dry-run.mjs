import { existsSync, readFileSync } from 'node:fs';

const files = {
  dryRun: 'src/services/remoteMigrationDryRunService.ts',
  planner: 'src/services/remoteMigrationPlanService.ts',
  database: 'src/repositories/database.ts',
};

for (const file of Object.values(files)) {
  if (!existsSync(file)) throw new Error(`Remote migration dry-run executor 필수 파일 누락: ${file}`);
}

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readFileSync(file, 'utf8')]));

for (const marker of [
  'REMOTE_MIGRATION_LOCAL_STORES',
  'collectRemoteMigrationSnapshot',
  "db.getAll('properties')",
  'buildRemoteMigrationPlan(snapshot)',
  'serializeRemoteMigrationPlan',
  'downloadRemoteMigrationPlan',
  'daon-remote-migration-dry-run-',
  'options.propertyIds',
  'options.includeCompanySettings',
  'settings: options.includeCompanySettings ? options.companySettings : undefined',
  'requestedIds.size',
  'requestedIds.has(property.id)',
]) {
  if (!text.dryRun.includes(marker)) throw new Error(`Remote migration dry-run executor 계약 누락: ${marker}`);
}

if (/db\.getAll\(['"]settings['"]\)/.test(text.dryRun)) {
  throw new Error('settings object store 전체를 remote migration에 자동 수집하면 안 됩니다. signing identity 등 비회사 설정이 포함될 수 있습니다.');
}
if (/fetch\s*\(|remoteDataGateway\.|\.upload\s*\(|\.from\s*\(/.test(text.dryRun)) {
  throw new Error('Remote migration dry-run executor에서 네트워크/remote write를 수행하면 안 됩니다.');
}

for (const store of [
  'propertyDocuments', 'propertyMedia', 'propertyVerifications', 'propertyVerificationCandidates',
  'propertyDataSources', 'reportSnapshots', 'digitalTwinAssets', 'agentJobs', 'agentResults',
  'agentReviews', 'propertySpaces', 'spaceMediaLinks', 'spaceRoomLinks', 'propertyFacilities',
  'roomEvidencePositions', 'roomConditionHistory', 'renovationAssessments',
  'roomRenovationAssessments', 'roomRenovationHistory', 'riskAssessments',
  'buildingReleaseSnapshots', 'buildingReleaseSnapshotStates', 'buildingReleaseShares',
  'buildingReleaseReviewNotes',
]) {
  if (!text.dryRun.includes(`'${store}'`)) throw new Error(`Dry-run local store collection 누락: ${store}`);
  if (!text.database.includes(`'${store}'`)) throw new Error(`IndexedDB store 기준 누락: ${store}`);
}

if (!text.planner.includes('networkWrites: 0')) throw new Error('Migration plan은 networkWrites=0을 보장해야 합니다.');
if (!text.planner.includes('readyForRemoteWrite: blockers.length === 0')) throw new Error('Migration plan blocker gate가 필요합니다.');
for (const marker of [
  "'SOURCE_DOCUMENT_BINARY_NOT_CONNECTED'",
  "value.resourceType === 'source_document_inventory'",
  "originalSourcePresence === 'confirmed'",
  "binaryStorageStatus !== 'connected'",
]) {
  if (!text.planner.includes(marker)) throw new Error(`Source inventory binary 연결 gate 누락: ${marker}`);
}

console.log('Remote migration local dry-run executor: PASS');
