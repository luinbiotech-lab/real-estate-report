import { existsSync, readFileSync } from 'node:fs';

const files = {
  executor: 'src/services/remoteMigrationExecutionService.ts',
  gateway: 'src/services/remoteDataGateway.ts',
  adapter: 'src/services/supabaseRemoteDataGateway.ts',
};

for (const file of Object.values(files)) {
  if (!existsSync(file)) throw new Error(`Controlled remote migration 필수 파일 누락: ${file}`);
}

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readFileSync(file, 'utf8')]));

for (const marker of [
  "REMOTE_MIGRATION_EXECUTION_VERSION = 'daon-remote-migration-execution-v1'",
  "REMOTE_MIGRATION_CONFIRMATION = 'MIGRATE TO PRODUCTION'",
  'expectedPlanGeneratedAt',
  'plan.readyForRemoteWrite',
  'plan.blockers.length',
  "asset.binarySource !== 'blob'",
  'remoteDataGateway.upsertProperty',
  'remoteDataGateway.upsertObject',
  'remoteAssetStorageGateway.upload',
  'remoteDataGateway.upsertAssetMetadata',
  'existingCandidates.has',
  'existingVerifications.has',
  'existingSnapshots.has',
  'remoteVerificationCandidatesPresent',
  'remoteReportSnapshotsPresent',
  'reconciliation.passed',
]) {
  if (!text.executor.includes(marker)) throw new Error(`Controlled migration execution gate 누락: ${marker}`);
}

for (const marker of [
  'listVerificationCandidates(propertyId: string)',
  'listVerifications(propertyId: string)',
]) {
  if (!text.gateway.includes(marker)) throw new Error(`RemoteDataGateway reconciliation contract 누락: ${marker}`);
}

for (const marker of [
  'async listVerificationCandidates(propertyId: string)',
  "getRows('property_verification_candidates'",
  'async listVerifications(propertyId: string)',
  "getRows('property_verifications'",
]) {
  if (!text.adapter.includes(marker)) throw new Error(`Supabase reconciliation read 누락: ${marker}`);
}

if (text.executor.includes('service_role') || text.executor.includes('sb_secret_')) {
  throw new Error('Browser migration executor에 server secret을 포함하면 안 됩니다.');
}
if (/confirmationText\s*!==\s*REMOTE_MIGRATION_CONFIRMATION/.test(text.executor) === false) {
  throw new Error('실행기는 명시적 confirmation text gate를 강제해야 합니다.');
}

console.log('Controlled production migration executor boundary: PASS');
