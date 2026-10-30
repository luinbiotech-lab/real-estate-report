// Design review screenshots (owner request 2026-10-30: app design change). Local-mode QA server with bootstrap sample data.
// Writes PNGs to shots/ — the design-screenshots workflow publishes them to the orphan branch claude/design-shots so the
// review can read them without artifact downloads.
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const OUT = 'shots';
const id = 'daon-bangbae-815-11';
const pages = [
  ['home', '/'],
  ['hub', `/property/${id}`],
  ['dataroom', `/property/${id}/data-room`],
  ['discover', '/discover'],
  ['new', '/property/new'],
  ['readiness', '/readiness'],
  ['interior', `/interior?propertyId=${id}`],
  ['spatial', `/spatial?propertyId=${id}`],
  ['settings', '/settings'],
  ['access', '/access'],
  ['backup', '/backup'],
  ['shares', '/external-shares'],
  ['income', `/income?propertyId=${id}`],
];
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
for (const [width, height, tag] of [[390, 844, 'm'], [1440, 1000, 'd']]) {
  const context = await browser.newContext({ viewport: { width, height }, locale: 'ko-KR', deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  for (const [name, path] of pages) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${tag}-${name}.png`, fullPage: false });
    if (tag === 'm' && (name === 'home' || name === 'hub' || name === 'dataroom' || name === 'new')) await page.screenshot({ path: `${OUT}/m-${name}-full.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    console.log(`::notice title=shot ${tag}-${name}::overflow=${overflow}px`);
  }
  if (tag === 'm') {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: '메뉴 열기' }).click().catch(() => undefined);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/m-menu.png` });
  }
  await context.close();
}
await browser.close();
