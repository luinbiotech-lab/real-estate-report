import { existsSync, readFileSync } from 'node:fs';

const files = {
  app: 'src/App.tsx',
  layout: 'src/components/Layout.tsx',
  page: 'src/pages/DataBackupCenterPage.tsx',
  service: 'src/services/localBackupService.ts',
  database: 'src/repositories/database.ts',
};
for (const file of Object.values(files)) if (!existsSync(file)) throw new Error(`Backup 필수 파일 누락: ${file}`);
const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readFileSync(file, 'utf8')]));

if (!text.app.includes('path="backup"') || !text.app.includes('DataBackupCenterPage')) throw new Error('Data Backup Center route가 필요합니다.');
if (!text.layout.includes('to="/backup"') || !text.layout.includes('데이터 백업 · 복원')) throw new Error('Data Backup Center navigation이 필요합니다.');
if (!text.service.includes("BACKUP_SCHEMA_VERSION = 'daon-local-backup-v1'")) throw new Error('백업 스키마 버전을 고정해야 합니다.');
if (!text.service.includes('Array.from(db.objectStoreNames)')) throw new Error('백업은 현재 IndexedDB object store를 자동 순회해야 합니다.');
if (!text.service.includes('getAllKeys()') || !text.service.includes('getAll()')) throw new Error('백업은 out-of-line key와 value를 모두 보존해야 합니다.');
if (!text.service.includes("__daonBinary: 'blob'") || !text.service.includes("__daonBinary: 'arraybuffer'")) throw new Error('Blob/ArrayBuffer 백업 직렬화가 필요합니다.');
if (!text.service.includes("LOCAL_STORAGE_PREFIX = 'daon:'")) throw new Error('daon: 로컬 운영상태를 백업해야 합니다.');
if (!text.service.includes("mode: 'merge' | 'replace'")) throw new Error('복원은 merge/replace 모드를 명시적으로 구분해야 합니다.');
if (!text.service.includes("if (mode === 'replace') await tx.store.clear()")) throw new Error('REPLACE 복원은 store를 먼저 비워야 합니다.');
if (!text.service.includes('validateBackup(backup)')) throw new Error('복원 전에 백업 스키마를 검증해야 합니다.');

for (const label of ['Data Backup Center', '전체 백업 다운로드', 'BACKUP SCOPE', 'RESTORE PREVIEW', 'RESTORE MODE', '병합 복원', '전체 교체 복원', '복원 전 현재 백업']) {
  if (!text.page.includes(label)) throw new Error(`Backup UI 필수 항목 누락: ${label}`);
}
if (!text.page.includes("window.confirm('현재 로컬 데이터를 백업 파일 기준으로 교체합니다.")) throw new Error('REPLACE 복원은 사용자 확인을 받아야 합니다.');
if (!text.page.includes('Blob/ArrayBuffer 원본도 Base64로 포함합니다')) throw new Error('대용량 바이너리 백업 경계를 사용자에게 알려야 합니다.');
if (!text.database.includes("DATABASE_NAME = 'real-estate-report'")) throw new Error('백업 대상 DB 이름이 명시되어야 합니다.');

console.log('Local full backup + restore integrity: PASS');
