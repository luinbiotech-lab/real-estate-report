import { readFileSync } from 'node:fs';

const excel = readFileSync('src/utils/excel.ts', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const decision = readFileSync('docs/security-spreadsheet-parser.md', 'utf8');

for (const marker of [
  'MAX_EXCEL_IMPORT_BYTES = 10 * 1024 * 1024',
  'function hasExcelFileSignature(buffer: ArrayBuffer)',
  'if (!hasExcelFileSignature(buffer))',
  'function readImportWorkbook(buffer: ArrayBuffer)',
  "cellFormula: false",
  "cellHTML: false",
  "bookVBA: false",
  "bookDeps: false",
  "bookFiles: false",
]) {
  if (!excel.includes(marker)) throw new Error(`Excel parser hardening 누락: ${marker}`);
}

for (const signatureMarker of [
  'bytes[0] === 0x50 && bytes[1] === 0x4b',
  'bytes[0] === 0xd0 && bytes[1] === 0xcf',
  'bytes[4] === 0xa1 && bytes[5] === 0xb1 && bytes[6] === 0x1a && bytes[7] === 0xe1',
]) {
  if (!excel.includes(signatureMarker)) throw new Error(`Excel file signature 검증 누락: ${signatureMarker}`);
}

const readCalls = excel.match(/readImportWorkbook\(buffer\)/g)?.length ?? 0;
if (readCalls < 2) throw new Error('parseWorkbook / parseImportJob 모두 hardened reader를 사용해야 합니다.');

const xlsxSpec = String(pkg.dependencies?.xlsx ?? '');
const lockedVersion = String(lock.packages?.['node_modules/xlsx']?.version ?? '');
if (!xlsxSpec || !lockedVersion) throw new Error('xlsx dependency/lock 정보를 확인할 수 없습니다.');

function compareVersion(a, b) {
  const av = a.split('.').map((value) => Number.parseInt(value, 10) || 0);
  const bv = b.split('.').map((value) => Number.parseInt(value, 10) || 0);
  for (let i = 0; i < Math.max(av.length, bv.length); i += 1) {
    const diff = (av[i] ?? 0) - (bv[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

if (compareVersion(lockedVersion, '0.20.2') < 0) {
  throw new Error(`xlsx ${lockedVersion}는 현재 보안 기준 0.20.2 미만입니다. Production 전 업그레이드가 필요합니다.`);
}

const reviewedSpec = 'https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz';
if (lockedVersion === '0.20.3' && xlsxSpec !== reviewedSpec) {
  throw new Error('xlsx 0.20.3은 검토된 공식 SheetJS CDN spec과 일치해야 합니다.');
}

for (const marker of [
  'CVE-2023-30533',
  'CVE-2024-22363',
  '0.20.3',
  'RELEASE ADVISORY REVIEW REQUIRED',
  'Browser `<input accept>` is not a security boundary',
]) {
  if (!decision.includes(marker)) throw new Error(`Spreadsheet parser 보안 결정 기록 누락: ${marker}`);
}

console.log('Excel import parser hardening: PASS');
console.log(JSON.stringify({
  maxImportBytes: 10 * 1024 * 1024,
  fileSignatureValidation: 'ENFORCED',
  xlsxSpec,
  lockedVersion,
  knownAdvisoryFloor: '>=0.20.2',
  dependencyStatus: 'PATCHED_PINNED_REVIEW_AT_RELEASE',
  note: 'Known 2023/2024 SheetJS advisories are below the locked version. Re-check vendor/GitHub advisories at each production release because CDN tarball dependencies are not fully represented by npm audit.',
}, null, 2));
