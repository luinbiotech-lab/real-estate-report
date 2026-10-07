import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE_URL = process.env.REPORT_REMOTE_QA_BASE_URL || 'http://127.0.0.1:4177';
const ARTIFACT_DIR = 'artifacts/agent-qa';

await mkdir(ARTIFACT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

async function assertGate() {
  await page.getByText('DA:ON PRODUCTION ACCESS').waitFor({ state: 'visible', timeout: 30_000 });
  await page.getByRole('heading', { name: '운영자 로그인' }).waitFor({ state: 'visible' });
  await page.getByLabel('이메일').waitFor({ state: 'visible' });
  await page.getByLabel('비밀번호').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Production 로그인', exact: true }).waitFor({ state: 'visible' });

  const body = await page.locator('body').innerText();
  for (const required of [
    'Supabase Auth의 active profile',
    'sessionStorage',
    '새로고침 후 세션을 복원',
  ]) {
    if (!body.includes(required)) throw new Error(`Remote auth gate marker missing: ${required}`);
  }
  for (const forbidden of [
    '플랫폼 초기화 실패',
    'REMOTE AUTH access token이 없습니다',
  ]) {
    if (body.includes(forbidden)) throw new Error(`Remote auth bootstrap regression: ${forbidden}`);
  }
}

try {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await assertGate();

  await page.reload({ waitUntil: 'networkidle' });
  await assertGate();

  if (pageErrors.length) throw new Error(`Browser page errors: ${pageErrors.join(' | ')}`);

  await page.screenshot({ path: `${ARTIFACT_DIR}/production-auth-gate.png`, fullPage: true });
  console.log('Rendered remote production auth gate QA: PASS');
} catch (error) {
  await page.screenshot({ path: `${ARTIFACT_DIR}/production-auth-gate-failure.png`, fullPage: true });
  console.error('Rendered remote production auth gate QA: FAIL');
  console.error(error);
  throw error;
} finally {
  await browser.close();
}
