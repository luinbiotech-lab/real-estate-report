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
  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'domcontentloaded' });
  for (const text of [
    '회사 설정',
    'BRAND IDENTITY',
    'DEFAULT CONTACT',
    'REPORT POLICY',
    '보고서 연락처 미리보기',
    '휴대폰과 이메일만 사용합니다',
    '기존 물건 담당자 자동 덮어쓰기 없음',
    'PROPERTY DATA & AGENT PLATFORM',
    '김은미 대표 / 공인중개사',
  ]) await waitForText(page, text);
  await page.screenshot({ path: `${ARTIFACT_DIR}/company-settings.png`, fullPage: true });
  console.log('Rendered company settings QA: PASS');
} catch (error) {
  await page.screenshot({ path: `${ARTIFACT_DIR}/company-settings-failure.png`, fullPage: true });
  console.error('Rendered company settings QA: FAIL');
  console.error(error);
  throw error;
} finally {
  await browser.close();
}
