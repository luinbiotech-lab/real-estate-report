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

  // 루인 #65 (2026-11-16): unauthenticated deep links to the buyer preview and the workspace must show only the gate.
  // No listing text, no property data request (Supabase REST / storage / report PDF) before sign-in.
  const dataRequests = [];
  page.on('request', (request) => { if (/\/rest\/v1\/|\/storage\/v1\/|\/api\/report-pdf|\/api\/public-data/.test(request.url())) dataRequests.push(request.url()); });
  for (const path of ['/explore', '/listing/daon-bangbae-815-11', '/property/daon-bangbae-815-11', '/property/daon-bangbae-815-11/data-room', '/reports']) {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' });
    await assertGate();
    const body = await page.locator('body').innerText();
    for (const leaked of ['공개 화면 미리보기', '매수 전 확인표', '신뢰 등급 근거', '방배', '815-11', '동광로', '억 원']) {
      if (body.includes(leaked)) throw new Error(`Unauthenticated ${path} shows listing content: ${leaked}`);
    }
    const html = await page.content();
    if (/815-11|daon-bangbae|동광로/.test(html.replace(/<script[\s\S]*?<\/script>/g, '').replace(new RegExp(path.replace(/[/-]/g, '\\$&'), 'g'), ''))) throw new Error(`Unauthenticated ${path} HTML carries property data`);
    console.log(`PASS unauthenticated ${path}: login gate only`);
  }
  if (dataRequests.length) throw new Error(`Unauthenticated pages requested property data: ${dataRequests.join(' | ')}`);
  console.log('PASS unauthenticated deep links made no property data request');

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
