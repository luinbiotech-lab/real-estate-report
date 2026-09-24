import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const ARTIFACT_DIR = 'artifacts/agent-qa';

async function waitForText(page, text, timeout = 30_000) {
  await page.waitForFunction((expected) => document.body?.innerText.toLowerCase().includes(String(expected).toLowerCase()), text, { timeout });
}

await mkdir(ARTIFACT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1300 } });

try {
  await page.goto(`${BASE_URL}/access`, { waitUntil: 'domcontentloaded' });
  for (const text of [
    '사용자 · 권한 관리',
    'LOCAL POLICY READY',
    'REMOTE AUTH READY',
    'AUTH PROVIDER',
    'LOCAL POLICY',
    'REMOTE AUTH',
    'READY',
    '인증 세션',
    '사용자 초대',
    'RLS 강제',
    'OWNER 전용 관리',
    '멀티디바이스 동기화',
    'REMOTE AUTH SESSION',
    'SIGNED OUT',
    'ROLE MATRIX',
    'OWNER',
    'ADMIN',
    'EDITOR',
    'VIEWER',
    'ACCESS PROFILES',
    '로컬 소유자',
    'production Auth 세션과 서버 RLS가 강제합니다',
    'PRODUCTION SECURITY · MANUAL CHECK REQUIRED',
    'Leaked Password Protection',
    'REMOTE AUTH BACKEND CONNECTED',
    'REAL OPERATOR OWNER REQUIRED',
    'PRODUCTION OPERATOR ACCEPTANCE GATE',
    'MANUAL ACCEPTANCE REQUIRED',
    'PHYSICAL 2ND DEVICE',
    'E2E REQUIRED',
    'DASHBOARD CHECK',
  ]) await waitForText(page, text);
  await page.screenshot({ path: `${ARTIFACT_DIR}/access-management.png`, fullPage: true });

  await page.goto(`${BASE_URL}/external-shares`, { waitUntil: 'domcontentloaded' });
  for (const text of [
    '외부 공유 센터',
    'LOCAL / OFFLINE',
    'READY',
    'REMOTE / PUBLIC',
    'BACKEND CONNECTED',
    'REMOTE / PUBLIC backend는 CONNECTED입니다.',
    'PUBLIC URL',
    'REMOTE REVOKE',
    'SERVER EXPIRY',
    'AUTH ACCESS',
    'SYNCED REVIEW',
    'REMOTE / PUBLIC으로 발급한 URL은 서버에서 실제 revoke할 수 있습니다.',
  ]) await waitForText(page, text);
  await page.screenshot({ path: `${ARTIFACT_DIR}/external-share-provider-boundary.png`, fullPage: true });

  console.log('Rendered access policy + auth/share provider boundary QA: PASS');
} catch (error) {
  await page.screenshot({ path: `${ARTIFACT_DIR}/access-share-failure.png`, fullPage: true });
  console.error('Rendered access/share boundary QA: FAIL');
  console.error(error);
  throw error;
} finally {
  await browser.close();
}
