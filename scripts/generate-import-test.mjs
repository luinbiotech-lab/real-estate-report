import * as XLSX from 'xlsx';
import { mkdirSync } from 'node:fs';

const rows = [
  ['테스트 성수 1', '서울특별시 성동구 뚝섬로 411-10', '53억원'],
  ['테스트 성수 2', '서울특별시 성동구 아차산로 100', '42억원'],
  ['테스트 강남', '서울특별시 강남구 테헤란로 152', '80억원'],
  ['테스트 종로', '서울특별시 종로구 세종대로 175', '120억원'],
  ['테스트 송파', '서울특별시 송파구 올림픽로 300', '95억원'],
  ['후보 검토 주소', '서울특별시 중구 중앙로', '30억원'],
  ['잘못된 주소', '존재하지않는주소 999-999', '10억원'],
  ['빈 주소', '', '20억원'],
  ['Excel 내부 중복', '서울특별시 성동구 아차산로 100', '41억원'],
  ['기존 Property 중복', '서울특별시 성동구 뚝섬로 411-10', '53억원'],
].map(([물건명, 주소, 매매가], index) => ({ 물건번호: `BULK-QA-${String(index + 1).padStart(2, '0')}`, 물건명, 주소, 매매가, 거래유형: '매매', 대지면적평: 36, 용도지역: '준공업지역', 담당자: 'QA 담당자' }));
const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), '7차_10행검증'); mkdirSync('test-fixtures', { recursive: true }); XLSX.writeFile(workbook, 'test-fixtures/7차_자동화_검증_10행.xlsx');
