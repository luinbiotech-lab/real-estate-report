import { readFileSync } from 'node:fs';

function read(path) {
  return readFileSync(path, 'utf8');
}

function requireContains(source, needle, message) {
  if (!source.includes(needle)) throw new Error(message);
}

const excel = read('src/utils/excel.ts');
const importTypes = read('src/services/importAutomation/types.ts');
const excelPage = read('src/pages/ExcelImport.tsx');
const bulkPage = read('src/pages/BulkIntakePage.tsx');
const valuePolicy = read('src/domain/professionalReport/valuePolicy.ts');
const propertyList = read('src/pages/PropertyList.tsx');
const propertyRepository = read('src/repositories/propertyRepository.ts');
const dataRoomRepository = read('src/repositories/propertyDataRoomRepository.ts');

requireContains(excel, 'MAX_EXCEL_IMPORT_ROWS = 5000', 'Excel 최대 행수 5,000 제한이 누락되었습니다.');
requireContains(excel, 'existingByAddress = new Map', 'Excel 기존주소 중복검사용 인덱스가 누락되었습니다.');
requireContains(excel, 'seenWorkbookAddresses = new Set', 'Excel 파일내 중복검사용 Set이 누락되었습니다.');
if (excel.includes('sourceRows.slice(0, index).some')) {
  throw new Error('Excel 중복검사에 O(n²) sourceRows.slice(...).some 패턴을 다시 사용하면 안 됩니다.');
}

requireContains(importTypes, "saveStatus?: 'unsaved' | 'saving' | 'saved' | 'save_failed'", 'Excel 행 저장 상태 모델이 누락되었습니다.');
requireContains(excelPage, "row.saveStatus !== 'saved'", '이미 저장된 Excel 행 재저장 방지가 누락되었습니다.');
requireContains(excelPage, "SAVE_FAILED", 'Excel 부분 저장 실패 상태가 누락되었습니다.');
requireContains(excelPage, "completedButUnsaved", 'completed-but-unsaved Excel 작업 복구가 누락되었습니다.');
requireContains(excelPage, "id: `excel-import:${job.id}:${row.rowId}`", 'Excel provenance 결정적 ID가 누락되었습니다.');
requireContains(excelPage, "resourceType: 'property_import'", 'Excel 신규 물건 provenance resourceType이 누락되었습니다.');
requireContains(excelPage, "explicitFields: explicitImportKeys(row).map(String)", 'Excel provenance explicitFields가 누락되었습니다.');
requireContains(excelPage, 'const batchSize = 250', 'Excel 신규 저장 250건 batch 경계가 누락되었습니다.');
requireContains(excelPage, 'propertyRepository.bulkCreate', 'Excel 신규 Property batch 저장 연결이 누락되었습니다.');
requireContains(excelPage, 'propertyDataRoomRepository.saveDataSourcesBulk', 'Excel provenance batch 저장 연결이 누락되었습니다.');
requireContains(excelPage, 'if (!propertiesSaved) await propertyRepository.create', 'Excel batch 실패 시 단건 fallback이 누락되었습니다.');
requireContains(propertyRepository, 'remoteDataGateway.bulkInsertProperties', 'Remote Property bulk insert 연결이 누락되었습니다.');
requireContains(dataRoomRepository, 'async saveDataSourcesBulk', 'PropertyDataSource bulk 저장 repository가 누락되었습니다.');

requireContains(valuePolicy, "item.sourceType !== 'excel_import'", 'Report value policy의 Excel provenance 연결이 누락되었습니다.');
requireContains(valuePolicy, "item.resourceType !== 'property_import'", 'Report value policy의 property_import 연결이 누락되었습니다.');
requireContains(valuePolicy, "explicitFields.some", 'Report field별 Excel sourceIds 연결이 누락되었습니다.');

requireContains(bulkPage, 'const CANDIDATE_PAGE_SIZE = 50', 'Bulk 검증 후보 50건 pagination 상수가 누락되었습니다.');
requireContains(bulkPage, 'pending.slice((candidatePage - 1) * CANDIDATE_PAGE_SIZE', 'Bulk 검증 후보 slice pagination이 누락되었습니다.');
requireContains(bulkPage, '<Pagination page={candidatePage}', 'Bulk 검증 후보 Pagination UI가 누락되었습니다.');

requireContains(propertyList, 'const PROPERTY_PAGE_SIZE = 50', 'Property 목록 50건 pagination 상수가 누락되었습니다.');
requireContains(propertyList, 'filtered.slice((page - 1) * PROPERTY_PAGE_SIZE', 'Property 목록 slice pagination이 누락되었습니다.');
requireContains(propertyList, 'aria-label="현재 페이지 물건 선택"', 'Property 목록 현재 페이지 선택 경계가 누락되었습니다.');
requireContains(propertyList, '<Pagination page={page}', 'Property 목록 Pagination UI가 누락되었습니다.');

console.log('Import regression validation PASS');
