import { existsSync, readFileSync } from 'node:fs';

const files = {
  app: 'src/App.tsx',
  layout: 'src/components/Layout.tsx',
  page: 'src/pages/RemoteMigrationReadinessPage.tsx',
  dryRun: 'src/services/remoteMigrationDryRunService.ts',
  planner: 'src/services/remoteMigrationPlanService.ts',
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
  'REMOTE MIGRATION · DRY-RUN ONLY',
  'NETWORK WRITES = 0',
  'Dry-Run 실행',
  'Manifest JSON 다운로드',
  'BLOCKER REVIEW',
  'STORAGE PLAN',
  'REHEARSAL CHECKLIST',
  'remoteMigrationDryRunService.run',
  'remoteMigrationDryRunService.download',
]) if (!text.page.includes(marker)) throw new Error(`Migration readiness UI marker 누락: ${marker}`);

for (const forbidden of [
  '.from(',
  '.insert(',
  '.update(',
  '.upsert(',
  '.delete(',
  '.upload(',
  'fetch(',
  'axios',
  'SUPABASE_SERVICE_ROLE_KEY',
]) {
  if (text.page.includes(forbidden)) throw new Error(`Migration readiness page에서 remote write/network 호출 금지: ${forbidden}`);
}

for (const marker of [
  'dryRun: true',
  'networkWrites: 0',
  'readyForRemoteWrite: blockers.length === 0',
]) if (!text.planner.includes(marker)) throw new Error(`Dry-run planner safety marker 누락: ${marker}`);

if (!text.dryRun.includes('await db.getAll(\'properties\')')) throw new Error('Dry-run executor는 local properties를 IndexedDB에서 읽어야 합니다.');
if (text.dryRun.includes("db.get('settings'" ) || text.dryRun.includes("db.getAll('settings'")) throw new Error('settings store 전체를 remote migration collector가 자동 수집하면 안 됩니다.');

console.log('Remote migration readiness review UI boundary: PASS');
