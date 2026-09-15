import { readFileSync } from 'node:fs';

const excel = readFileSync('src/utils/excel.ts', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));

for (const marker of [
  'MAX_EXCEL_IMPORT_BYTES = 10 * 1024 * 1024',
  'function readImportWorkbook(buffer: ArrayBuffer)',
  "cellFormula: false",
  "cellHTML: false",
  "bookVBA: false",
  "bookDeps: false",
  "bookFiles: false",
]) {
  if (!excel.includes(marker)) throw new Error(`Excel parser hardening 누락: ${marker}`);
}

const readCalls = excel.match(/readImportWorkbook\(buffer\)/g)?.length ?? 0;
if (readCalls < 2) throw new Error('parseWorkbook / parseImportJob 모두 hardened reader를 사용해야 합니다.');

const xlsxSpec = String(pkg.dependencies?.xlsx ?? '');
const lockedVersion = String(lock.packages?.['node_modules/xlsx']?.version ?? '');
if (!xlsxSpec || !lockedVersion) throw new Error('xlsx dependency/lock 정보를 확인할 수 없습니다.');

const dependencyStatus = lockedVersion === '0.18.5'
  ? 'REQUIRED_BEFORE_PRODUCTION'
  : 'REVIEW_REQUIRED';

console.log('Excel import parser hardening: PASS');
console.log(JSON.stringify({
  maxImportBytes: 10 * 1024 * 1024,
  xlsxSpec,
  lockedVersion,
  dependencyUpgrade: dependencyStatus,
  note: dependencyStatus === 'REQUIRED_BEFORE_PRODUCTION'
    ? 'Parser mitigation is active, but the spreadsheet dependency still requires an official supported-version upgrade before Production READY.'
    : 'Review the installed spreadsheet dependency before declaring Production READY.',
}, null, 2));
