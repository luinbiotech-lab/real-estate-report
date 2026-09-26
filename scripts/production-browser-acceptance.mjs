import { chromium } from 'playwright';

const rawBase = process.env.DAON_PRODUCTION_BASE_URL?.trim() || '';
const email = process.env.DAON_PRODUCTION_OWNER_EMAIL?.trim() || '';
const password = process.env.DAON_PRODUCTION_OWNER_PASSWORD || '';

if (!rawBase) throw new Error('DAON_PRODUCTION_BASE_URL이 필요합니다.');
if (!email || !password) throw new Error('DAON_PRODUCTION_OWNER_EMAIL / DAON_PRODUCTION_OWNER_PASSWORD가 필요합니다.');

const base = new URL(rawBase);
if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
  throw new Error('DAON_PRODUCTION_BASE_URL은 credential/query/hash/path 없는 HTTPS origin이어야 합니다.');
}

async function signInAndVerify(context, label) {
  const page = await context.newPage();
  await page.goto(base.origin, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('이메일').fill(email);
  await page.getByLabel('비밀번호').fill(password);
  await page.getByRole('button', { name: 'Production 로그인', exact: true }).click();
  await page.waitForFunction(() => !document.body?.innerText.includes('운영자 로그인'), undefined, { timeout: 30_000 });

  const body = await page.locator('body').innerText();
  if (!body || body.includes('Production 로그인에 실패했습니다.')) throw new Error(`${label}: Production 로그인 실패`);

  for (const path of ['/', '/migration-readiness', '/backup', '/external-shares']) {
    await page.goto(new URL(path, base), { waitUntil: 'domcontentloaded' });
    const text = await page.locator('body').innerText();
    if (text.includes('운영자 로그인')) throw new Error(`${label}: ${path} 이동 후 session이 유지되지 않았습니다.`);
  }

  return page;
}

const browser = await chromium.launch({ headless: true });
try {
  const deviceA = await browser.newContext();
  const deviceB = await browser.newContext();

  const pageA = await signInAndVerify(deviceA, 'device-A');
  const pageB = await signInAndVerify(deviceB, 'device-B');

  await pageA.goto(new URL('/migration-readiness', base), { waitUntil: 'domcontentloaded' });
  await pageB.goto(new URL('/migration-readiness', base), { waitUntil: 'domcontentloaded' });

  for (const [label, page] of [['device-A', pageA], ['device-B', pageB]]) {
    const text = await page.locator('body').innerText();
    if (!text.includes('Migration Readiness Review')) throw new Error(`${label}: Migration Readiness 접근 실패`);
    if (!text.includes('DRY-RUN NETWORK WRITES = 0')) throw new Error(`${label}: migration safety boundary 표시 누락`);
  }

  console.log(JSON.stringify({
    productionBaseUrl: base.origin,
    ownerEmail: email.replace(/(^.).*(@.*$)/, '$1***$2'),
    deviceA: 'PASS',
    deviceB: 'PASS',
    independentBrowserContexts: 'PASS',
    migrationReadinessAccess: 'PASS',
  }, null, 2));
  console.log('Production browser two-context acceptance: PASS');
} finally {
  await browser.close();
}
