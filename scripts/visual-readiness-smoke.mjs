import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const ARTIFACT_DIR = 'artifacts/agent-qa';

async function waitForText(page, text, timeout = 30_000) {
  await page.waitForFunction((expected) => document.body?.innerText.toLowerCase().includes(String(expected).toLowerCase()), text, { timeout });
}

await mkdir(ARTIFACT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 1200 } });

try {
  await page.goto(`${BASE_URL}/readiness`, { waitUntil: 'domcontentloaded' });
  for (const text of [
    'Property Readiness Center',
    '기본정보 → 문서 → 구조화/출처 → 검증 → 미디어 → 보고서 → 3D',
    '전체 물건',
    '보완 필요',
    '80% 이상',
    '평균 준비도',
    '방배동 815-11 코너빌딩',
    '기본정보',
    '문서',
    '구조화 / 출처',
    '검증',
    '미디어',
    '보고서',
    '3D / Digital Twin',
    'Verification이 없는 imported 자료는 검증 완료로 승격하지 않습니다.',
  ]) await waitForText(page, text);
  await page.screenshot({ path: `${ARTIFACT_DIR}/property-readiness-center.png`, fullPage: true });
  console.log('Rendered property readiness center QA: PASS');
} catch (error) {
  await page.screenshot({ path: `${ARTIFACT_DIR}/readiness-failure.png`, fullPage: true });
  console.error('Rendered property readiness center QA: FAIL');
  console.error(error);
  throw error;
} finally {
  await browser.close();
}
