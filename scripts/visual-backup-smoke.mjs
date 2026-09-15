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
  await page.goto(`${BASE_URL}/backup`, { waitUntil: 'domcontentloaded' });
  for (const text of [
    'Data Backup Center',
    '전체 백업 다운로드',
    'BACKUP SCOPE',
    'RESTORE PREVIEW',
    'RESTORE MODE',
    '병합 복원',
    '전체 교체 복원',
    '복원 전 현재 백업',
    'Blob/ArrayBuffer 원본도 Base64로 포함합니다.',
    '현재 단계는 local-first입니다.',
  ]) await waitForText(page, text);
  await page.screenshot({ path: `${ARTIFACT_DIR}/data-backup-center.png`, fullPage: true });
  console.log('Rendered local data backup center QA: PASS');
} catch (error) {
  await page.screenshot({ path: `${ARTIFACT_DIR}/data-backup-center-failure.png`, fullPage: true });
  console.error('Rendered local data backup center QA: FAIL');
  console.error(error);
  throw error;
} finally {
  await browser.close();
}
