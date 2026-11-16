// Fixed-engine report PDF renderer (2026-11-16, owner: "어쩔 땐 잘 나오고 어쩔 땐 깨져서 나오고 이러면 안 되는 거야").
// One code path for every caller: the Vercel function (api/report-pdf.mjs, @sparticuz/chromium), local development and
// the CI visual regression (scripts/visual-report-regression.mjs, Playwright Chromium). The page is the built
// render.html from dist/, served from memory under a private origin; every other request is blocked, so the PDF depends
// only on the payload and the deployed bundle (same fonts, same CSS, no device print dialog, no network).
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const RENDER_ORIGIN = 'http://daon-render.local';
export const MAX_REPORT_PDF_BODY_BYTES = 4_200_000; // Vercel request body limit is 4.5 MB.
export const A4_PX = { width: 794, height: 1123 };
/**
 * Chromium flags every report renderer must use (2026-11-16). @sparticuz/chromium (Vercel) already passes
 * --font-render-hinting=none; without it Chromium takes text hinting from the machine's fontconfig, so glyph advances
 * (and line breaks) differ by machine: CI moved words up to 3 pt against the dev machine with the same fonts.
 */
export const RENDER_CHROMIUM_ARGS = ['--font-render-hinting=none'];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon',
};
const DATA_IMAGE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** Server-side mirror of src/render/reportRenderPayload.ts parseReportRenderPayload (the render page checks again). */
export function validateReportPdfPayload(value) {
  if (!isObject(value)) return '보고서 자료가 없습니다.';
  if (value.version !== 1) return '지원하지 않는 보고서 자료 버전입니다.';
  if (value.kind !== 'proposal' && value.kind !== 'detail') return '지원하지 않는 보고서 종류입니다.';
  const images = value.images ?? {};
  if (!isObject(images)) return '이미지 목록 형식이 올바르지 않습니다.';
  const entries = Object.entries(images);
  if (entries.length > 40) return '이미지가 너무 많습니다(최대 40개).';
  if (entries.some(([key, data]) => !key || typeof data !== 'string' || !DATA_IMAGE.test(data))) return '이미지는 PNG·JPEG·WebP data URL만 받을 수 있습니다.';
  if (value.kind === 'proposal' && (!isObject(value.property) || typeof value.property.id !== 'string' || !value.property.id)) return '1P 보고서의 물건 정보가 올바르지 않습니다.';
  if (value.kind === 'detail' && (!isObject(value.snapshot) || typeof value.snapshot.id !== 'string' || !isObject(value.snapshot.snapshotData))) return '상세 보고서 Snapshot 형식이 올바르지 않습니다.';
  return '';
}

/** ASCII-only download name (Content-Disposition), e.g. DAON_1P_MASTER_<id>.pdf. */
export function reportPdfFileName(payload) {
  const raw = payload.kind === 'proposal' ? `DAON_1P_MASTER_${payload.property.id}` : `DAON_DETAIL_7P_MASTER_v${payload.snapshot.reportVersion ?? ''}_${payload.snapshot.propertyId ?? ''}`;
  return `${raw.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 100)}.pdf`;
}

/**
 * Render one payload to PDF bytes.
 * @param {{ browser: import('playwright-core').Browser, distDir: string, payload: object, mutateCss?: string, timeoutMs?: number, inspect?: (page: import('playwright-core').Page) => Promise<unknown> }} options
 * inspect: test-only hook, called on the ready print-media page before printing (its result is returned as `inspection`).
 * @returns {Promise<{ pdf: Buffer, layout: { pages: number, pageBoxes: Array<{width:number,height:number}>, brokenImages: number } }>}
 */
export async function renderReportPdf({ browser, distDir, payload, mutateCss = '', timeoutMs = 30_000, inspect }) {
  const root = path.resolve(distDir);
  const context = await browser.newContext({ viewport: A4_PX, deviceScaleFactor: 1, locale: 'ko-KR', timezoneId: 'Asia/Seoul', serviceWorkers: 'block' });
  try {
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== RENDER_ORIGIN) return route.abort('blockedbyclient');
      let rel = decodeURIComponent(url.pathname);
      if (rel === '/' || rel === '/render') rel = '/render.html';
      const file = path.resolve(root, `.${path.posix.normalize(rel)}`);
      if (!file.startsWith(`${root}${path.sep}`)) return route.fulfill({ status: 403, body: '' });
      try {
        const body = await readFile(file);
        return route.fulfill({ status: 200, contentType: MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', body });
      } catch {
        return route.fulfill({ status: 404, body: '' });
      }
    });
    await context.addInitScript((data) => { window.__DAON_RENDER__ = data; }, payload);
    const page = await context.newPage();
    await page.goto(`${RENDER_ORIGIN}/render.html`, { waitUntil: 'load', timeout: timeoutMs });
    await page.waitForFunction(() => ['ready', 'error'].includes(document.documentElement.dataset.renderState || ''), null, { timeout: timeoutMs });
    const state = await page.evaluate(() => ({ state: document.documentElement.dataset.renderState, error: document.documentElement.dataset.renderError || '' }));
    if (state.state !== 'ready') throw Object.assign(new Error(state.error || '보고서를 그리지 못했습니다.'), { code: 'RENDER_FAILED' });
    if (mutateCss) await page.addStyleTag({ content: mutateCss });
    await page.emulateMedia({ media: 'print' });
    const layout = await page.evaluate(() => {
      const unique = [...document.querySelectorAll('.d1-sheet, .daon-frame-page, .daon-detail-page')];
      return {
        pages: unique.length,
        pageBoxes: unique.map((el) => { const box = el.getBoundingClientRect(); return { width: Math.round(box.width), height: Math.round(box.height) }; }),
        brokenImages: Number(document.documentElement.dataset.brokenImages || 0),
      };
    });
    const inspection = inspect ? await inspect(page) : undefined;
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true, timeout: timeoutMs });
    return { pdf, layout, inspection };
  } finally {
    await context.close();
  }
}
