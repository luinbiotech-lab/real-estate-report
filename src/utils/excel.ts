import * as XLSX from 'xlsx';
import { emptyProperty, type Property, type TradeType } from '../types';
import { parseNumber } from './format';
import { isSameProperty, normalizeDate, normalizeProperty, validateProperty } from './property';
import type { ImportJob, ImportRow as AutomationImportRow, ImportRowIssue } from '../services/importAutomation/types';

export const columns: Record<string, keyof Property> = {
  물건번호: 'propertyNumber', 물건명: 'name', 건물명: 'buildingName', 거래유형: 'tradeType', 매매가: 'salePrice', 보증금: 'deposit', 월세: 'monthlyRent', 협의여부: 'negotiable', 명도상태: 'occupancyStatus', 주소: 'address', 상세주소: 'detailAddress', 인근역: 'nearbyStation', 역거리: 'stationDistance', 도로조건: 'roadCondition', 대지면적평: 'landAreaPyeong', 대지면적제곱미터: 'landAreaSqm', 연면적평: 'totalFloorAreaPyeong', 연면적제곱미터: 'totalFloorAreaSqm', 건축면적평: 'buildingAreaPyeong', 용도지역: 'zoning', 주용도: 'mainUse', 구조: 'structure', 지하층: 'basementFloors', 지상층: 'groundFloors', 준공일: 'completionDate', 건폐율: 'buildingCoverageRate', 용적률: 'floorAreaRatio', 승강기: 'elevator', 주차대수: 'parkingSpaces', 특징: 'features', 투자포인트: 'investmentPoints', 입지분석: 'locationAnalysis', 개발계획: 'developmentPlan', 추천용도: 'recommendedUse', 리스크: 'risks', 종합의견: 'overallOpinion', 인근거래사례: 'nearbyTransactions', 담당자: 'managerName', 담당자연락처: 'managerPhone', 담당자이메일: 'managerEmail', 회사명: 'companyName',
};
Object.assign(columns, { 소재지: 'address', 물건주소: 'address', 도로명주소: 'address', 토지면적: 'landAreaPyeong', 대지면적: 'landAreaPyeong', 건물면적: 'buildingAreaPyeong', 연면적: 'totalFloorAreaPyeong', 건축물용도: 'mainUse', 층수: 'groundFloors', 도로: 'roadCondition', 역명: 'nearbyStation', 위험요인: 'risks' } satisfies Record<string, keyof Property>);
const numericFields = new Set<keyof Property>(['salePrice', 'deposit', 'monthlyRent', 'landAreaPyeong', 'landAreaSqm', 'totalFloorAreaPyeong', 'totalFloorAreaSqm', 'buildingAreaPyeong', 'basementFloors', 'groundFloors', 'buildingCoverageRate', 'floorAreaRatio', 'parkingSpaces']);
export interface ImportRow { row: number; data: Property; errors: string[]; duplicate: boolean }

export function parseWorkbook(buffer: ArrayBuffer, existing: Property[]): ImportRow[] {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('워크시트가 없습니다.');
  const sourceRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const parsed: ImportRow[] = [];
  for (const [index, raw] of sourceRows.entries()) {
    let property: Property = { ...emptyProperty, id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    for (const [header, rawValue] of Object.entries(raw)) {
      const key = columns[header.trim()];
      if (!key) continue;
      if (numericFields.has(key)) (property as unknown as Record<string, unknown>)[key] = parseNumber(rawValue);
      else if (key === 'negotiable') property.negotiable = /^(예|y|yes|가능|있음)$/i.test(String(rawValue).trim());
      else if (key === 'completionDate') property.completionDate = normalizeDate(rawValue);
      else (property as unknown as Record<string, unknown>)[key] = String(rawValue).trim();
    }
    property = normalizeProperty({ ...property, tradeType: property.tradeType as TradeType });
    const errors = validateProperty(property);
    const hasInvalidNumber = Object.entries(raw).some(([header, rawValue]) => {
      const key = columns[header.trim()];
      const text = String(rawValue).trim();
      return numericFields.has(key) && text !== '' && parseNumber(rawValue) === 0 && !/^0([,.]0*)?$/.test(text);
    });
    if (hasInvalidNumber) errors.push('숫자 형식 오류');
    const duplicate = [...existing, ...parsed.map((item) => item.data)].some((candidate) => isSameProperty(property, candidate));
    parsed.push({ row: index + 2, data: property, errors, duplicate });
  }
  return parsed;
}

export function parseImportJob(buffer: ArrayBuffer, fileName: string, existing: Property[]): ImportJob {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true }); const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('워크시트가 없습니다.'); const sourceRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' }); const now = new Date().toISOString();
  const rows: AutomationImportRow[] = sourceRows.map((raw, index) => {
    let property: Property = { ...emptyProperty, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    const issues: ImportRowIssue[] = [];
    for (const [header, rawValue] of Object.entries(raw)) { const key = columns[header.trim()]; if (!key) continue; const text = String(rawValue).trim();
      if (numericFields.has(key)) { const value = parseNumber(rawValue); (property as unknown as Record<string, unknown>)[key] = value; if (text && value === 0 && !/^0([,.]0*)?$/.test(text)) issues.push({ field: String(key), code: 'INVALID_NUMBER', message: `${header} 숫자 형식 오류` }); }
      else if (key === 'negotiable') property.negotiable = /^(예|y|yes|가능|있음)$/i.test(text); else if (key === 'completionDate') property.completionDate = normalizeDate(rawValue); else (property as unknown as Record<string, unknown>)[key] = text;
    }
    property = normalizeProperty({ ...property, tradeType: property.tradeType as TradeType });
    if (!property.address.trim()) issues.push({ field: 'address', code: 'INVALID_ADDRESS', message: '주소는 필수입니다.' });
    if (!property.name.trim()) issues.push({ field: 'name', code: 'MISSING_NAME', message: '물건명을 입력해 주세요.' });
    if (property.salePrice < 0 || property.landAreaPyeong < 0 || property.totalFloorAreaPyeong < 0) issues.push({ code: 'INVALID_RANGE', message: '금액과 면적은 음수일 수 없습니다.' });
    const sameExisting = existing.find((candidate) => isSameProperty(property, candidate) || (!!property.address && candidate.address.trim() === property.address.trim()));
    const earlier = sourceRows.slice(0, index).some((candidate) => { const address = Object.entries(candidate).find(([header]) => columns[header.trim()] === 'address')?.[1]; return String(address || '').trim() === property.address.trim() && !!property.address.trim(); });
    const duplicateKind = sameExisting ? 'existing' as const : earlier ? 'workbook' as const : undefined;
    if (duplicateKind) issues.push({ field: 'address', code: duplicateKind === 'existing' ? 'DUPLICATE_EXISTING' : 'DUPLICATE_WORKBOOK', message: duplicateKind === 'existing' ? '기존 물건 가능성' : 'Excel 내부 중복' });
    return { rowId: crypto.randomUUID(), excelRowNumber: index + 2, raw, normalizedProperty: property, status: issues.some((issue) => ['INVALID_ADDRESS', 'INVALID_NUMBER', 'INVALID_RANGE'].includes(issue.code)) ? 'invalid' : 'ready', issues, retryCount: 0, selected: !issues.some((issue) => ['INVALID_ADDRESS', 'INVALID_NUMBER', 'INVALID_RANGE'].includes(issue.code)), duplicateKind, duplicatePropertyId: sameExisting?.id, saveMode: duplicateKind ? 'skip' : 'new' };
  });
  return { id: crypto.randomUUID(), fileName, createdAt: now, updatedAt: now, totalRows: rows.length, processedRows: rows.filter((row) => row.status === 'invalid').length, running: false, paused: false, concurrency: 2, poiRadiusMeters: 1000, rows, logs: [] };
}

export function downloadTemplate() {
  const sample = { 물건번호: 'P-001', 물건명: '예시 물건', 건물명: '예시빌딩', 거래유형: '매매', 매매가: '53억원', 보증금: '', 월세: '', 협의여부: '예', 명도상태: '명도완료', 주소: '서울특별시 성동구', 상세주소: '', 인근역: '성수역', 역거리: '도보 7분', 도로조건: '4m 도로', ...Object.fromEntries(Object.keys(columns).slice(14).map((key) => [key, ''])) };
  const worksheet = XLSX.utils.json_to_sheet([sample], { header: Object.keys(columns) });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '물건등록양식');
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = '부동산_물건등록_표준양식.xlsx';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
