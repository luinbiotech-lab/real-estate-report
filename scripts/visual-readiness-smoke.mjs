import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const ARTIFACT_DIR = 'artifacts/agent-qa';

async function waitForText(page, text, timeout = 30_000) {
  await page.waitForFunction((expected) => document.body?.innerText.toLowerCase().includes(String(expected).toLowerCase()), text, { timeout });
}

await mkdir(ARTIFACT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 1450 } });

try {
  await page.goto(`${BASE_URL}/readiness`, { waitUntil: 'domcontentloaded' });
  for (const text of [
    'Property Readiness Center',
    '기본정보 → 문서 → 구조화/출처 → 검증 → 미디어 → 보고서 → 3D',
    '전체 물건', '보완 필요', '80% 이상', '평균 준비도',
    'NEXT ACTION QUEUE', '준비도 기반 다음 작업', 'MISSING', 'PARTIAL', 'OPENED', '보완 화면',
    'RECENT PROGRESS', '실제 데이터 변화로 확인된 진행', '재검사 / 새로고침',
    '방배동 815-11 코너빌딩', '기본정보', '문서', '구조화 / 출처', '검증', '미디어', '보고서', '3D / Digital Twin',
    '원본확인 3/4 · 파일연결 0/4 · 미확인 토지대장',
    'Verification이 없는 imported 자료는 검증 완료로 승격하지 않습니다.',
    '작업 완료도 실제 readiness 변화가 확인될 때만 기록됩니다.',
  ]) await waitForText(page, text);
  await page.screenshot({ path: `${ARTIFACT_DIR}/property-readiness-center.png`, fullPage: true });
  console.log('Rendered property readiness + closed-loop action QA: PASS');
} catch (error) {
  await page.screenshot({ path: `${ARTIFACT_DIR}/readiness-failure.png`, fullPage: true });
  console.error('Rendered property readiness closed-loop QA: FAIL');
  console.error(error);
  throw error;
} finally {
  await browser.close();
}
