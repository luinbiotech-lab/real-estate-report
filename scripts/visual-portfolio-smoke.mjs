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
  // Korean-first operations hub (0afc7e4): headline, KPI labels, live connection chips, three primary actions.
  for (const text of [
    'DA:ON PROPERTY OPERATIONS',
    '물건을 확인하고, 검증하고, 보고합니다.',
    '등록 물건',
    '기본정보 입력',
    '7일 내 변경',
    '매매 물건',
    '인증 연결',
    '외부 공유 연결',
    '주소로 물건 조회',
    '새 물건 등록',
    '자료 검증',
    '물건 관리',
  ]) await waitForText(page, text);
  // Specialist workspaces are behind a collapsed <details>; open it, then every entry point must be visible.
  await page.getByText('전문 업무 전체 보기').click();
  for (const text of [
    'Intake · Verification',
    '임대 · 수익',
    '검토 이력',
    '외부 공유',
    '보고서 이력',
    '3D · 도면',
    '사용자 · 권한',
    '엑셀 대량 등록',
  ]) await waitForText(page, text);
  await page.screenshot({ path: `${ARTIFACT_DIR}/portfolio-operations-hub.png`, fullPage: true });
  console.log('Rendered portfolio operations hub QA: PASS');
} catch (error) {
  await page.screenshot({ path: `${ARTIFACT_DIR}/portfolio-hub-failure.png`, fullPage: true });
  console.error('Rendered portfolio operations hub QA: FAIL');
  console.error(error);
  throw error;
} finally {
  await browser.close();
}
