import { existsSync, readFileSync } from 'node:fs';

const files = {
  app: 'src/App.tsx',
  layout: 'src/components/Layout.tsx',
  page: 'src/pages/RemoteMigrationReadinessPage.tsx',
  dryRun: 'src/services/remoteMigrationDryRunService.ts',
  planner: 'src/services/remoteMigrationPlanService.ts',
  handoff: 'src/services/remoteMigrationHandoffService.ts',
};
for (const file of Object.values(files)) {
  if (!existsSync(file)) throw new Error(`Migration readiness UI 필수 파일 누락: ${file}`);
}
const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readFileSync(file, 'utf8')]));

for (const marker of [
  "path=\"migration-readiness\"",
  '<RemoteMigrationReadinessPage settings={settings} />',
]) if (!text.app.includes(marker)) throw new Error(`Migration readiness route 누락: ${marker}`);

for (const marker of [
  'to="/migration-readiness"',
  'Remote Migration 준비',
]) if (!text.layout.includes(marker)) throw new Error(`Migration readiness navigation 누락: ${marker}`);

for (const marker of [
  'Migration Readiness Review',
  'REMOTE MIGRATION · CONTROLLED RELEASE',
  'DRY-RUN NETWORK WRITES = 0',
  'Dry-Run 실행',
  'Manifest JSON 다운로드',
  'Handoff Bundle 다운로드',
  'BLOCKER REVIEW',
  'STORAGE PLAN',
  'REHEARSAL CHECKLIST',
  'remoteMigrationDryRunService.run',
  'propertyIds: [targetPropertyId]',
  '이관 대상 물건',
  'remoteMigrationDryRunService.download',
  'remoteMigrationHandoffService.download',
  'CONTROLLED PRODUCTION RELEASE',
  'Production 이관 최종 확인',
  'Phase 1 패키지 연결 + Dry-Run',
  'importBangbaePhase1Package',
  "localBackupService.parse(await file.text())",
  "await localBackupService.restore(backup, 'merge')",
  "propertyIds: [BANGBAE_PHASE1_PROPERTY_ID]",
  "Phase 1 패키지의 공적자료 Blob이 불완전합니다.",
  'bytesFromBase64',
  'sha256Hex',
  'sha256FromNotes',
  'Phase 1 패키지 SHA-256 provenance가 없습니다.',
  'Phase 1 패키지 SHA-256 검증에 실패했습니다.',
  'Phase 1 패키지 fileSize가 실제 Blob 크기와 일치하지 않습니다.',
  'REMOTE_MIGRATION_CONFIRMATION',
  'confirmationText !== REMOTE_MIGRATION_CONFIRMATION',
  'remoteMigrationExecutionService.execute',
  'executionResult.reconciliation.passed',
]) if (!text.page.includes(marker)) throw new Error(`Migration readiness UI marker 누락: ${marker}`);

for (const forbidden of [
  '.insert(',
  '.update(',
  '.upsert(',
  '.delete(',
  '.upload(',
  'fetch(',
  'axios',
  'SUPABASE_SERVICE_ROLE_KEY',
  'sb_secret_',
  'service_role',
]) {
  if (text.page.includes(forbidden)) throw new Error(`Migration readiness page에서 direct backend/secret 사용 금지: ${forbidden}`);
}
if (/(?:supabase|client|gateway)\.from\s*\(/.test(text.page)) {
  throw new Error('Migration readiness page에서 direct backend .from() 사용 금지');
}

for (const marker of [
  'dryRun: true',
  'networkWrites: 0',
  'readyForRemoteWrite: blockers.length === 0',
  "'INLINE_BINARY'",
  'function structuredPayloadIsSafe(',
]) if (!text.planner.includes(marker)) throw new Error(`Dry-run planner safety marker 누락: ${marker}`);

for (const marker of [
  "REMOTE_MIGRATION_HANDOFF_VERSION = 'daon-remote-migration-handoff-v1'",
  'dryRunOnly: true',
  'networkWritesPerformed: 0',
  'remoteExecutionEnabled: false',
  'secretsIncluded: false',
  'binaryPayloadsIncluded: false',
  'productionReady: false',
  'Dedicated real-estate Supabase project provisioned; GPS/Sports projects are not reused.',
  'supabase/migrations/20260916_auth_profiles_rls.sql',
  'supabase/migrations/20260916_property_data_rls.sql',
  'supabase/migrations/20260916_property_asset_storage.sql',
  'docs/production-connection-runbook.md',
]) if (!text.handoff.includes(marker)) throw new Error(`Migration handoff bundle safety marker 누락: ${marker}`);

for (const forbidden of ['SUPABASE_SERVICE_ROLE_KEY', 'DAON_OWNER_BOOTSTRAP_KEY=', 'fetch(', '.from(', '.upload(']) {
  if (text.handoff.includes(forbidden)) throw new Error(`Handoff bundle service에 secret/remote execution 경로 금지: ${forbidden}`);
}

if (!text.dryRun.includes("await db.getAll('properties')")) throw new Error('Dry-run executor는 local properties를 IndexedDB에서 읽어야 합니다.');
if (text.dryRun.includes("db.get('settings'") || text.dryRun.includes("db.getAll('settings'")) throw new Error('settings store 전체를 remote migration collector가 자동 수집하면 안 됩니다.');


for (const marker of [
  'CONTENT READINESS · NON-BLOCKING',
  'Data Room 완성도',
  'STRUCTURAL MIGRATION READY ≠ DATA ROOM COMPLETE.',
  'CONTENT INCOMPLETE',
  'PHASE 1 · 후속 보충 승인',
  'BANGBAE_PHASE1_DEFERRED',
  'sourceInventoryConfirmed',
  'sourceInventoryUnconfirmed',
  'storageConnectedSources',
  'unconfirmedSourceNames',
  'propertyDataRoomRepository.getBundle(propertyId)',
]) {
  if (!text.page.includes(marker)) throw new Error(`Migration UI content-readiness boundary 누락: ${marker}`);
}


if (!text.page.includes('Supabase Auth Leaked Password Protection 활성화 여부를 Dashboard에서 수동 확인')) {
  throw new Error('Migration rehearsal에 Supabase Auth leaked-password protection 수동 게이트가 필요합니다.');
}

for (const marker of [
  'PRODUCTION ACCEPTANCE · EXTERNAL GATES',
  '실운영 승인 전 남은 항목',
  'NOT PRODUCTION READY',
  '실사용 OWNER 로그인 · profile/role acceptance',
  '물리 2nd-device browser E2E',
  'Production frontend host',
  'Protected map/POI proxy',
  'Production provider/domain allowlist',
  'Supabase Leaked Password Protection',
  '실사용 OWNER public-share issue/list/revoke browser acceptance',
  'Production browser bundle/source-map server-secret scan',
  'Spreadsheet parser release advisory review',
  'Spreadsheet import release regression',
]) {
  if (!text.page.includes(marker)) throw new Error(`Production external acceptance gate 누락: ${marker}`);
}


for (const marker of [
  'assessRequiredDocumentReadiness(bundle)',
  'requiredDocumentTotal',
  'requiredSourcePresent',
  'requiredBinaryConnected',
  'requiredOfficiallyVerified',
  '필수자료 원본',
  '필수자료 binary',
  '필수자료 공식검증',
  '필수자료 미확인',
  'DOCUMENT_TYPE_LABELS[type]',
]) {
  if (!text.page.includes(marker)) throw new Error(`필수 공적자료 migration preflight 누락: ${marker}`);
}

for (const marker of [
  'contentReadiness.requiredSourcePresent === contentReadiness.requiredDocumentTotal',
  'contentReadiness.requiredBinaryConnected === contentReadiness.requiredDocumentTotal',
  'contentReadiness.requiredOfficiallyVerified === contentReadiness.requiredDocumentTotal',
  'contentReadiness.mediaAssets > 0',
  'CONTENT REVIEW READY',
  'CONTENT INCOMPLETE',
]) {
  if (!text.page.includes(marker)) throw new Error(`Content review-ready gate 누락: ${marker}`);
}

console.log('Remote migration readiness review + handoff bundle UI boundary: PASS');
