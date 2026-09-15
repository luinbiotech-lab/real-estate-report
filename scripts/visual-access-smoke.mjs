import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const ARTIFACT_DIR = 'artifacts/agent-qa';

async function waitForText(page, text, timeout = 30_000) {
  await page.waitForFunction((expected) => document.body?.innerText.toLowerCase().includes(String(expected).toLowerCase()), text, { timeout });
}

await mkdir(ARTIFACT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

try {
  await page.goto(`${BASE_URL}/access`, { waitUntil: 'domcontentloaded' });
  for (const text of [
    '사용자 · 권한 관리',
    'LOCAL POLICY READY',
    'AUTH NOT CONNECTED',
    'ROLE MATRIX',
    'OWNER',
    'ADMIN',
    'EDITOR',
    'VIEWER',
    'ACCESS PROFILES',
    '로컬 소유자',
    '실제 보안 경계는 부동산 전용 Auth + 서버 RLS 연결 후 강제됩니다',
  ]) await waitForText(page, text);
  await page.screenshot({ path: `${ARTIFACT_DIR}/access-management.png`, fullPage: true });

  await page.goto(`${BASE_URL}/external-shares`, { waitUntil: 'domcontentloaded' });
  for (const text of [
    '외부 공유 센터',
    'LOCAL / OFFLINE',
    'READY',
    'REMOTE / PUBLIC',
    'NOT CONFIGURED',
    'PUBLIC URL',
    'REMOTE REVOKE',
    'SERVER EXPIRY',
    'AUTH ACCESS',
    'SYNCED REVIEW',
    '현재 실제 remote revoke는 사용할 수 없습니다.',
  ]) await waitForText(page, text);
  await page.screenshot({ path: `${ARTIFACT_DIR}/external-share-provider-boundary.png`, fullPage: true });

  console.log('Rendered access policy + external share provider boundary QA: PASS');
} catch (error) {
  await page.screenshot({ path: `${ARTIFACT_DIR}/access-share-failure.png`, fullPage: true });
  console.error('Rendered access/share boundary QA: FAIL');
  console.error(error);
  throw error;
} finally {
  await browser.close();
}
