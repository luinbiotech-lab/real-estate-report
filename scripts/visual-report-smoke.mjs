import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const OUT_DIR = process.env.REPORT_QA_OUT_DIR || 'artifacts/report-qa';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function qaSvg(kind) {
  if (kind === 'map') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><rect width="1200" height="900" fill="#f6f1e7"/><path d="M0 210H1200M0 560H1200M260 0V900M820 0V900" stroke="#d6c59e" stroke-width="38"/><path d="M0 410H1200M520 0V900" stroke="#9fb5c8" stroke-width="24"/><circle cx="670" cy="430" r="42" fill="#c69237" stroke="#073a69" stroke-width="14"/><text x="730" y="445" font-family="Arial,sans-serif" font-size="44" font-weight="700" fill="#073a69">PROPERTY</text><text x="60" y="830" font-family="Arial,sans-serif" font-size="34" fill="#5a6a78">LOCATION QA MAP</text></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1100" viewBox="0 0 1600 1100"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8d0df"/><stop offset="1" stop-color="#eef1ed"/></linearGradient></defs><rect width="1600" height="1100" fill="url(#sky)"/><rect x="340" y="190" width="900" height="700" fill="#ddd8cf" stroke="#073a69" stroke-width="18"/><rect x="430" y="300" width="180" height="170" fill="#6b859c"/><rect x="720" y="300" width="180" height="170" fill="#6b859c"/><rect x="1010" y="300" width="140" height="170" fill="#6b859c"/><rect x="430" y="570" width="180" height="170" fill="#6b859c"/><rect x="720" y="570" width="180" height="170" fill="#6b859c"/><rect x="1010" y="570" width="140" height="170" fill="#6b859c"/><rect x="690" y="700" width="230" height="190" fill="#8e765c"/><path d="M0 940H1600" stroke="#9b8d78" stroke-width="120"/><text x="70" y="1030" font-family="Arial,sans-serif" font-size="42" font-weight="700" fill="#073a69">EXTERIOR QA IMAGE</text></svg>`;
}

await mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1 });

await page.route('**/daon-master/bangbae-815-11-main.jpg', (route) => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: qaSvg('hero') }));
await page.route('**/daon-master/bangbae-815-11-map.jpg', (route) => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: qaSvg('map') }));

try {
  await page.goto(`${BASE_URL}/document/proposal/daon-bangbae-815-11`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.d1-sheet', { timeout: 30_000 });
  const onePage = await page.evaluate(() => {
    const sheet = document.querySelector('.d1-sheet');
    if (!(sheet instanceof HTMLElement)) throw new Error('1P sheet missing');
    const root = document.querySelector('.daon-one-page-master');
    const facts = [...document.querySelectorAll('.d1-fact')].map((item) => item.textContent?.trim() || '');
    const images = [...sheet.querySelectorAll('img')].map((image) => ({ src: image.getAttribute('src') || '', width: image.naturalWidth, height: image.naturalHeight }));
    const rect = sheet.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      scrollWidth: sheet.scrollWidth,
      scrollHeight: sheet.scrollHeight,
      clientWidth: sheet.clientWidth,
      clientHeight: sheet.clientHeight,
      facts,
      images,
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
  assert(onePage.images.length >= 2 && onePage.images.every((image) => image.width > 0 && image.height > 0), '1P hero/map images failed to render in QA');
  assert(onePage.scrollHeight <= onePage.clientHeight + 2, `1P vertical overflow: ${onePage.scrollHeight}/${onePage.clientHeight}`);
  assert(onePage.scrollWidth <= onePage.clientWidth + 2, `1P horizontal overflow: ${onePage.scrollWidth}/${onePage.clientWidth}`);
  await page.screenshot({ path: `${OUT_DIR}/daon-1p.png`, fullPage: true });

  await page.goto(`${BASE_URL}/document/report/daon-bangbae-815-11`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.daon-detail-master', { timeout: 30_000 });
  const sevenPage = await page.evaluate(() => {
    const master = document.querySelector('.daon-detail-master');
    const images = [...document.querySelectorAll('.daon-detail-master img')].map((image) => ({ src: image.getAttribute('src') || '', width: image.naturalWidth, height: image.naturalHeight }));
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
      images,
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
  assert(sevenPage.images.length > 0 && sevenPage.images.every((image) => image.width > 0 && image.height > 0), '7P rendered image slots contain broken images');
  assert(sevenPage.text.includes('공부상 주차'), '7P 공부상 주차 semantics missing');
  assert(sevenPage.text.includes('현장 주차'), '7P 현장 주차 semantics missing');
  assert(!sevenPage.text.includes('BANGBAE-DONG PREMIUM ASSET'), '7P forbidden Bangbae-only legacy copy visible');
  await page.screenshot({ path: `${OUT_DIR}/daon-7p.png`, fullPage: true });

  console.log('Rendered DA:ON report smoke QA: PASS');
} finally {
  await browser.close();
}
