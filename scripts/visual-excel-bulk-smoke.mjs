import { mkdir } from 'node:fs/promises';
import * as XLSX from 'xlsx';
import { chromium } from 'playwright';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const ARTIFACT_DIR = 'artifacts/agent-qa';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function buildWorkbookBuffer() {
  const rows = Array.from({ length: 250 }, (_, index) => ({
    물건번호: `QA-BULK-${String(index + 1).padStart(4, '0')}`,
    물건명: `대량등록 QA 물건 ${index + 1}`,
    거래유형: '매매',
    매매가: 1000000000 + index * 1000000,
    주소: `서울특별시 테스트구 대량로 ${index + 1}`,
    대지면적평: 50 + (index % 20),
    담당자: 'QA 담당자',
  }));
  rows[1].주소 = rows[0].주소;
  rows[2].주소 = '';
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '대량등록QA');
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
}

await mkdir(ARTIFACT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

try {
  await page.goto(`${BASE_URL}/import`, { waitUntil: 'networkidle' });
  const input = page.locator('input[type="file"]');
  await input.setInputFiles({
    name: 'qa-bulk-250.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: buildWorkbookBuffer(),
  });

  await page.waitForFunction(() => document.body.innerText.includes('qa-bulk-250.xlsx'), undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.body.innerText.includes('대량 작업 250행입니다.'), undefined, { timeout: 30_000 });

  const result = await page.evaluate(() => {
    const kpis = [...document.querySelectorAll('.bulk-kpis > div')].map((item) => item.textContent?.replace(/\s+/g, '') || '');
    const bodyRows = document.querySelectorAll('.bulk-table tbody tr').length;
    const pagination = document.querySelector('.MuiPagination-root')?.textContent || '';
    const table = document.querySelector('.bulk-table');
    return {
      kpis,
      bodyRows,
      pagination,
      tableWidth: table?.scrollWidth || 0,
      viewportWidth: document.documentElement.clientWidth,
      text: document.body.innerText,
    };
  });

  assert(result.kpis.some((value) => value.includes('전체250')), `Bulk total KPI mismatch: ${result.kpis.join(',')}`);
  assert(result.kpis.some((value) => value.includes('검토필요1')), `Bulk duplicate review KPI mismatch: ${result.kpis.join(',')}`);
  assert(result.kpis.some((value) => value.includes('오류1')), `Bulk invalid KPI mismatch: ${result.kpis.join(',')}`);
  assert(result.bodyRows === 20, `Bulk page size expected 20, got ${result.bodyRows}`);
  assert(result.text.includes('Excel 내부 중복'), 'Workbook duplicate message missing');
  assert(result.text.includes('주소는 필수입니다.'), 'Invalid address message missing');
  assert(result.pagination.includes('13'), `Pagination should expose 13 pages for 250 rows: ${result.pagination}`);

  await page.screenshot({ path: `${ARTIFACT_DIR}/excel-bulk-250.png`, fullPage: true });
  console.log('Rendered Excel bulk 250-row QA: PASS');
} finally {
  await browser.close();
}
