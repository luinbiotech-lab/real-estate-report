import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const OUT_DIR = process.env.REPORT_QA_OUT_DIR || 'artifacts/report-qa';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1 });

try {
  await page.goto(`${BASE_URL}/document/proposal/daon-bangbae-815-11`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.d1-sheet', { timeout: 30_000 });
  const onePage = await page.evaluate(() => {
    const sheet = document.querySelector('.d1-sheet');
    if (!(sheet instanceof HTMLElement)) throw new Error('1P sheet missing');
    const root = document.querySelector('.daon-one-page-master');
    const facts = [...document.querySelectorAll('.d1-fact')].map((item) => item.textContent?.trim() || '');
    const rect = sheet.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      scrollWidth: sheet.scrollWidth,
      scrollHeight: sheet.scrollHeight,
      clientWidth: sheet.clientWidth,
      clientHeight: sheet.clientHeight,
      facts,
      templateId: root?.getAttribute('data-template-id'),
      templateVersion: root?.getAttribute('data-template-version'),
      text: sheet.textContent || '',
    };
  });

  assert(onePage.templateId === 'DAON_1P_MASTER', `1P template id mismatch: ${onePage.templateId}`);
  assert(onePage.templateVersion === 'daon-1p-v2', `1P template version mismatch: ${onePage.templateVersion}`);
  assert(onePage.facts.length === 12, `1P facts expected 12, got ${onePage.facts.length}`);
  assert(onePage.facts.some((value) => value.includes('공부상 주차')), '1P 공부상 주차 fact missing');
  assert(onePage.facts.some((value) => value.includes('현장 주차')), '1P 현장 주차 fact missing');
  assert(!onePage.text.includes('용적률 참고 계산'), '1P deprecated FAR calculated fact is visible');
  assert(onePage.scrollHeight <= onePage.clientHeight + 2, `1P vertical overflow: ${onePage.scrollHeight}/${onePage.clientHeight}`);
  assert(onePage.scrollWidth <= onePage.clientWidth + 2, `1P horizontal overflow: ${onePage.scrollWidth}/${onePage.clientWidth}`);
  await page.screenshot({ path: `${OUT_DIR}/daon-1p.png`, fullPage: true });

  await page.goto(`${BASE_URL}/document/report/daon-bangbae-815-11`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.daon-detail-master', { timeout: 30_000 });
  const sevenPage = await page.evaluate(() => {
    const master = document.querySelector('.daon-detail-master');
    const pages = [...document.querySelectorAll('.daon-detail-page')].map((node) => {
      const el = node;
      return {
        className: el.className,
        scrollWidth: el.scrollWidth,
        scrollHeight: el.scrollHeight,
        clientWidth: el.clientWidth,
        clientHeight: el.clientHeight,
        text: el.textContent || '',
      };
    });
    return {
      templateId: master?.getAttribute('data-template-id'),
      templateVersion: master?.getAttribute('data-template-version'),
      pages,
      text: master?.textContent || '',
    };
  });

  assert(sevenPage.templateId === 'DAON_DETAIL_7P_MASTER', `7P template id mismatch: ${sevenPage.templateId}`);
  assert(sevenPage.templateVersion === 'daon-detail-7p-v2', `7P template version mismatch: ${sevenPage.templateVersion}`);
  assert(sevenPage.pages.length === 7, `7P expected 7 pages, got ${sevenPage.pages.length}`);
  for (const [index, item] of sevenPage.pages.entries()) {
    assert(item.scrollHeight <= item.clientHeight + 2, `7P page ${index + 1} vertical overflow: ${item.scrollHeight}/${item.clientHeight}`);
    assert(item.scrollWidth <= item.clientWidth + 2, `7P page ${index + 1} horizontal overflow: ${item.scrollWidth}/${item.clientWidth}`);
  }
  assert(sevenPage.text.includes('공부상 주차'), '7P 공부상 주차 semantics missing');
  assert(sevenPage.text.includes('현장 주차'), '7P 현장 주차 semantics missing');
  assert(!sevenPage.text.includes('BANGBAE-DONG PREMIUM ASSET'), '7P forbidden Bangbae-only legacy copy visible');
  await page.screenshot({ path: `${OUT_DIR}/daon-7p.png`, fullPage: true });

  console.log('Rendered DA:ON report smoke QA: PASS');
} finally {
  await browser.close();
}
