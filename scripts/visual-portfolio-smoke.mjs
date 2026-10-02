import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const ARTIFACT_DIR = 'artifacts/agent-qa';

async function waitForText(page, text, timeout = 30_000) {
  await page.waitForFunction((expected) => document.body?.innerText.toLowerCase().includes(String(expected).toLowerCase()), text, { timeout });
}

await mkdir(ARTIFACT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  for (const text of [
    '물건 · Data Room',
    '물건을 찾고 열어 자료·검증·보고 흐름을 이어갑니다.',
    '전체',
    '매매',
    '현재 필터',
    '최근 업데이트',
    '엑셀 대량 등록',
    '개별 물건 등록',
    '열기',
  ]) await waitForText(page, text);
  await page.getByPlaceholder('물건명, 주소, 물건번호 검색').waitFor({ state: 'visible', timeout: 30_000 });
  const rows = await page.locator('.property-focus-table tbody tr').count();
  if (rows < 1) throw new Error('Focused property list must render at least one seeded property row.');
  await page.screenshot({ path: `${ARTIFACT_DIR}/property-list-focused.png`, fullPage: true });

  await page.goto(`${BASE_URL}/digital-twin`, { waitUntil: 'domcontentloaded' });
  const brand = page.getByRole('link', { name: 'DA:ON 운영 홈으로 이동' });
  await brand.waitFor({ state: 'visible', timeout: 30_000 });
  await brand.click();
  await page.waitForURL(/\/control-center(?:$|\?)/, { timeout: 30_000 });
  await waitForText(page, '운영 홈');
  console.log('Brand logo home navigation QA: PASS');
  console.log('Rendered focused property list QA: PASS');
} catch (error) {
  await page.screenshot({ path: `${ARTIFACT_DIR}/property-list-focused-failure.png`, fullPage: true });
  console.error('Rendered focused property list QA: FAIL');
  console.error(error);
  throw error;
} finally {
  await browser.close();
}
