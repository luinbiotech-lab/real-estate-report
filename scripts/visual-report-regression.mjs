// Fixed-engine report PDF visual regression (2026-11-16, owner: "이럴 때는 이렇게 나오고 저럴 땐 저렇게 나오고 …
// 이러면 안 되는 거야. 일관성이 있어야 되거든").
//
// What it proves, for several test properties (lots of data / long texts / sparse data / very long name and address):
//   1. The real "PDF 저장" button sends the report to /api/report-pdf; the request is rendered by the SAME renderer the
//      server uses (api/_lib/reportPdf.mjs + dist/render.html, no network) and the PDF is returned to the page.
//   2. Every PDF page is exactly A4 (595 x 842 pt) and every report page box is exactly 794 x 1123 px; page counts match.
//   3. Only the bundled web fonts are used (CDP platform-font check): no device/system fallback font, so the result
//      cannot change with the machine that renders it.
//   4. Every page is rasterized by pinned pdf.js in the pinned Chromium and compared with its approved baseline image (50 dpi grayscale). More than 0.4 % changed pixels on any
//      page fails, and a diff image is written to artifacts.
// Time is frozen (2026-11-16 09:00 KST) so dates printed in the report do not change the pixels.
//
// Usage: npx vite build && (vite dev server on 4174) && node scripts/visual-report-regression.mjs
//   UPDATE_BASELINES=1  write the current pages as the new baselines (only after a person approved the new look)
//   QA_MUTATE_CSS='…'   inject CSS before printing to show the check FAILs on a layout change (self-test)
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';
import { chromium } from 'playwright';
import { RENDER_CHROMIUM_ARGS, renderReportPdf, validateReportPdfPayload } from '../api/_lib/reportPdf.mjs';
import { routeQaImages, seedReportFixture, waitForSeed } from './lib/report-qa-fixtures.mjs';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const OUT = process.env.REPORT_QA_OUT || 'artifacts/agent-qa/visual-report';
const DIST = process.env.REPORT_DIST_DIR || 'dist';
const BASELINES = 'tests/visual-baselines/report';
const UPDATE = process.env.UPDATE_BASELINES === '1';
const MUTATE_CSS = process.env.QA_MUTATE_CSS || '';
const DPI = 50;
const PIXEL_DELTA = 48; // gray levels; anti-aliasing noise stays below this
const MAX_CHANGED_RATIO = 0.004;
const FROZEN_NOW = new Date('2026-11-16T00:00:00Z'); // 09:00 KST

const LONG_NAME = '[테스트] 서울 서초구 방배동 서래마을 함지박사거리 코너 근린생활시설·주택 복합 건물 통매각';
const LONG_ADDRESS = '서울특별시 서초구 방배로42길 17-23 (방배동, 서래마을 함지박사거리 인근 코너 근린생활시설 및 주택 복합건물)';
const FIXTURES = [
  { key: 'full', title: '자료 많음 + 짧은 문구 + 중개사 가격', short: true, broker: true, sparse: false, managerName: '', reportPages: 9 },
  { key: 'long', title: '긴 문구(짧은 문구 없음) + 담당자 이름', short: false, broker: false, sparse: false, managerName: 'QA 담당자', reportPages: 9 },
  { key: 'sparse', title: '자료 적음(선택 쪽 생략)', short: false, broker: false, sparse: true, managerName: '', reportPages: 5 },
  { key: 'longaddr', title: '아주 긴 물건명·주소', short: false, broker: true, sparse: false, managerName: '', reportPages: 9, overrides: { name: LONG_NAME, address: LONG_ADDRESS, detailAddress: '' } },
];

// ---- tiny grayscale PNG / PGM helpers (no extra dependencies) ----
function crc32(buf) { let c, crc = 0xffffffff; for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function encodeGrayPng({ width, height, data }) {
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++) { raw[y * (width + 1)] = 0; data.copy(raw, y * (width + 1) + 1, y * width, (y + 1) * width); }
  const chunk = (type, body) => { const len = Buffer.alloc(4); len.writeUInt32BE(body.length); const td = Buffer.concat([Buffer.from(type), body]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
function decodeGrayPng(buf) {
  let offset = 8, width = 0, height = 0; const idat = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset); const type = buf.toString('ascii', offset + 4, offset + 8); const body = buf.subarray(offset + 8, offset + 8 + len);
    if (type === 'IHDR') { width = body.readUInt32BE(0); height = body.readUInt32BE(4); if (body[8] !== 8 || body[9] !== 0) throw new Error('baseline PNG must be 8-bit grayscale'); }
    if (type === 'IDAT') idat.push(body);
    offset += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)); const data = Buffer.alloc(width * height);
  for (let y = 0; y < height; y++) { if (raw[y * (width + 1)] !== 0) throw new Error('baseline PNG uses an unsupported filter'); raw.copy(data, y * width, y * (width + 1) + 1, (y + 1) * (width + 1)); }
  return { width, height, data };
}
// Pages are rasterized by pinned pdf.js inside the same pinned Chromium, never by the machine's pdftoppm: the CI runner
// (Ubuntu 26.04, newer poppler) anti-aliased text differently from the dev machine and moved 2-4 % of pixels on every
// page although the PDF itself was the same (2026-11-16, CI run 43780675455). Result = f(PDF, pdf.js 4.10.38, Chromium).
const PDFJS_DIR = 'node_modules/pdfjs-dist';
const PDFJS_ORIGIN = 'http://daon-pdfjs.local';
async function rasterize(pdfPath) {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
  try {
    await page.route(`${PDFJS_ORIGIN}/**`, async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><body></body>' });
      if (url.pathname === '/report.pdf') return route.fulfill({ contentType: 'application/pdf', body: await readFile(pdfPath) });
      const file = path.join(PDFJS_DIR, url.pathname.replace(/^\/pdfjs\//, ''));
      if (!url.pathname.startsWith('/pdfjs/') || !existsSync(file)) return route.abort();
      return route.fulfill({ contentType: file.endsWith('.mjs') ? 'text/javascript' : 'application/octet-stream', body: await readFile(file) });
    });
    await page.goto(`${PDFJS_ORIGIN}/`);
    const pages = await page.evaluate(async ({ origin, dpi }) => {
      const pdfjs = await import(`${origin}/pdfjs/build/pdf.min.mjs`);
      pdfjs.GlobalWorkerOptions.workerSrc = `${origin}/pdfjs/build/pdf.worker.min.mjs`;
      const doc = await pdfjs.getDocument({ url: `${origin}/report.pdf`, cMapUrl: `${origin}/pdfjs/cmaps/`, cMapPacked: true, standardFontDataUrl: `${origin}/pdfjs/standard_fonts/`, isEvalSupported: false }).promise;
      const out = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const pdfPage = await doc.getPage(n);
        const viewport = pdfPage.getViewport({ scale: dpi / 72 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
        await pdfPage.render({ canvasContext: context, viewport }).promise;
        const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const gray = new Array(canvas.width * canvas.height);
        for (let i = 0; i < gray.length; i++) gray[i] = Math.round(0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]);
        const text = await pdfPage.getTextContent();
        const words = text.items.filter((item) => item.str && item.str.trim()).map((item) => [item.str, ...[item.transform[4], item.transform[5], item.width, item.height].map((v) => Math.round(v * 10) / 10)]);
        out.push({ width: canvas.width, height: canvas.height, data: gray, words });
      }
      return out;
    }, { origin: PDFJS_ORIGIN, dpi: DPI });
    return pages.map((p) => ({ width: p.width, height: p.height, data: Buffer.from(p.data), words: p.words }));
  } finally { await page.close(); }
}
function compare(a, b) {
  if (a.width !== b.width || a.height !== b.height) return { changed: 1, size: `${a.width}x${a.height} vs ${b.width}x${b.height}` };
  const diff = Buffer.alloc(a.data.length, 255); let changed = 0;
  for (let i = 0; i < a.data.length; i++) { if (Math.abs(a.data[i] - b.data[i]) > PIXEL_DELTA) { changed++; diff[i] = 0; } else diff[i] = 200 + Math.round(a.data[i] / 5); }
  return { changed: changed / a.data.length, diff: { width: a.width, height: a.height, data: diff } };
}


const WORD_TOLERANCE_PT = 0.6;
/**
 * Text lines per page from pinned pdf.js: [y, xStart, xEnd, text without spaces] in PDF points (0.1 pt). pdf.js may
 * split or merge runs differently between calls, so runs are joined into lines (same baseline) before comparing.
 */
async function pdfWords(pdfPath) {
  return (await rasterize(pdfPath)).map((page) => {
    const lines = new Map();
    for (const [str, x, y, width] of page.words) {
      const key = Math.round(y * 2) / 2;
      const line = lines.get(key) || []; line.push([x, x + width, str]); lines.set(key, line);
    }
    return [...lines.entries()].sort((a, b) => b[0] - a[0]).map(([y, runs]) => {
      runs.sort((a, b) => a[0] - b[0]);
      return [runs.map((r) => r[2]).join('').replace(/\s+/g, ''), y, Math.round(runs[0][0] * 10) / 10, Math.round(Math.max(...runs.map((r) => r[1])) * 10) / 10];
    });
  });
}
function compareWords(current, base) {
  const diffs = [];
  if (current.length !== base.length) diffs.push(`쪽수 ${current.length} vs 기준 ${base.length}`);
  for (let p = 0; p < Math.min(current.length, base.length); p++) {
    const a = current[p]; const b = base[p];
    if (a.length !== b.length) diffs.push(`${p + 1}쪽 줄 수 ${a.length} vs 기준 ${b.length}`);
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const moved = [1, 2, 3].some((k) => Math.abs(a[i][k] - b[i][k]) > WORD_TOLERANCE_PT);
      if (a[i][0] !== b[i][0] || moved) { diffs.push(`${p + 1}쪽 "${a[i][0]}"(${a[i].slice(1).join(',')}) vs 기준 "${b[i][0]}"(${b[i].slice(1).join(',')})`); break; }
    }
  }
  return diffs;
}

// ---- reporting ----
const results = [];
function record(fixture, step, status, detail = '') {
  results.push({ fixture, step, status, detail });
  console.log(`${fixture} · ${step}: ${status}${detail ? ` — ${detail}` : ''}`);
  if (status === 'FAIL') console.log(`::error title=Report visual ${fixture} ${step}::${String(detail).replace(/\n/g, ' ').slice(0, 400)}`);
}
async function check(fixture, step, fn) {
  try { record(fixture, step, 'PASS', (await fn()) || ''); } catch (error) { record(fixture, step, 'FAIL', error instanceof Error ? error.message.slice(0, 600) : String(error)); }
}
function assert(condition, message) { if (!condition) throw new Error(message); }

// Fonts actually used to draw text, per element (Chrome DevTools Protocol). isCustomFont = a bundled @font-face font.
async function platformFonts(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '#root *' });
  const system = new Map();
  for (const nodeId of nodeIds) {
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId }).catch(() => ({ fonts: [] }));
    for (const font of fonts) {
      if (font.isCustomFont) continue;
      const entry = system.get(font.familyName) || { glyphs: 0, samples: [] };
      entry.glyphs += font.glyphCount;
      if (entry.samples.length < 3) {
        const { outerHTML } = await cdp.send('DOM.getOuterHTML', { nodeId }).catch(() => ({ outerHTML: '' }));
        entry.samples.push(outerHTML.replace(/\s+/g, ' ').slice(0, 120));
      }
      system.set(font.familyName, entry);
    }
  }
  await cdp.detach();
  return [...system.entries()].map(([family, info]) => ({ family, ...info }));
}

// Structural guards: a line-clamped text must hide its remainder, and nothing may stick out of its A4 page.
async function layoutIssues(page) {
  return page.evaluate(() => {
    const issues = [];
    const pages = [...document.querySelectorAll('.d1-sheet, .daon-frame-page, .daon-detail-page')];
    const describe = (el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}「${(el.textContent || '').trim().slice(0, 24)}」`;
    for (const sheet of pages) {
      const box = sheet.getBoundingClientRect();
      for (const el of sheet.querySelectorAll('*')) {
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        const clamp = style.getPropertyValue('-webkit-line-clamp');
        if (clamp && clamp !== 'none' && style.overflowY === 'visible' && el.scrollHeight > el.clientHeight + 1) issues.push(`줄 제한 넘침: ${describe(el)}`);
        const r = el.getBoundingClientRect();
        if (r.width && r.height && (r.left < box.left - 1 || r.right > box.right + 1 || r.top < box.top - 1 || r.bottom > box.bottom + 1)) issues.push(`쪽 밖으로 나감: ${describe(el)}`);
      }
    }
    return issues;
  });
}
async function inspectPage(page) { return { system: await platformFonts(page), layout: await layoutIssues(page) }; }

assert(existsSync(path.join(DIST, 'render.html')), `${DIST}/render.html 없음: 먼저 npx vite build`);
await mkdir(OUT, { recursive: true });
await mkdir(BASELINES, { recursive: true });
const browser = await chromium.launch({ headless: true, args: RENDER_CHROMIUM_ARGS }); // same flags as the server renderer
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', acceptDownloads: true });
await context.clock.setFixedTime(FROZEN_NOW);
await routeQaImages(context);
const rendered = new Map(); // request key -> { pdf, layout, inspection }
let sampleProposalPayload = null; // reused by the network-isolation check
let current = '';
await context.route('**/api/report-pdf', async (route) => {
  const key = current;
  try {
    const payload = JSON.parse(route.request().postData() || 'null');
    const invalid = validateReportPdfPayload(payload);
    if (invalid) { rendered.set(key, { error: invalid }); return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'INVALID_REQUEST', message: invalid }) }); }
    if (payload.kind === 'proposal' && !sampleProposalPayload) sampleProposalPayload = payload;
    const result = await renderReportPdf({ browser, distDir: DIST, payload, mutateCss: MUTATE_CSS, inspect: inspectPage });
    rendered.set(key, { ...result, payloadBytes: (route.request().postData() || '').length, imageCount: Object.keys(payload.images || {}).length });
    return route.fulfill({ status: 200, contentType: 'application/pdf', headers: { 'x-report-pages': String(result.layout.pages), 'x-report-broken-images': String(result.layout.brokenImages), 'content-disposition': 'attachment; filename="report.pdf"' }, body: result.pdf });
  } catch (error) {
    rendered.set(key, { error: error instanceof Error ? error.message : String(error) });
    return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'PDF_ENGINE_FAILED', message: String(error).slice(0, 200) }) });
  }
});
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message.slice(0, 200)));

async function savePdfFromApp(key) {
  current = key;
  await page.getByRole('button', { name: 'PDF 저장', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible({ timeout: 1500 }).catch(() => false)) await page.getByTestId('report-blank-fields-continue').click();
  const status = page.getByTestId('fixed-pdf-status');
  await status.filter({ hasText: /PDF를 저장했습니다|만들지 못|오류|연결하지/ }).waitFor({ timeout: 60_000 });
  const text = await status.innerText();
  const result = rendered.get(key);
  assert(result && !result.error, `렌더 실패: ${result?.error || '요청 없음'} / 화면: ${text}`);
  assert(/PDF를 저장했습니다/.test(text), `화면 안내가 저장 완료가 아님: ${text}`);
  return result;
}

async function verifyPdf(fx, kind, result, expectPages) {
  const label = `${kind === 'proposal' ? '1P' : '상세'}`;
  const pdfPath = path.join(OUT, `vr-${fx.key}-${kind}.pdf`);
  await writeFile(pdfPath, result.pdf);
  await check(fx.key, `${label} 쪽수·A4 크기`, async () => {
    const info = execFileSync('pdfinfo', ['-f', '1', '-l', '99', pdfPath], { encoding: 'utf8' });
    const pages = Number(/Pages:\s+(\d+)/.exec(info)?.[1]);
    assert(pages === expectPages, `${pages}쪽 (${expectPages}쪽 기대)`);
    const sizes = [...info.matchAll(/Page\s+\d+ size:\s+([\d.]+) x ([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    const bad = sizes.filter(([w, h]) => Math.abs(w - 595) > 1.5 || Math.abs(h - 842) > 1.5);
    assert(sizes.length === pages && !bad.length, `A4 아닌 쪽: ${JSON.stringify(bad)}`);
    const boxes = result.layout.pageBoxes.filter((b) => Math.abs(b.width - 794) > 1 || Math.abs(b.height - 1123) > 1);
    assert(!boxes.length, `화면 쪽 상자가 A4(794x1123px)가 아님: ${JSON.stringify(boxes)}`);
    assert(result.layout.brokenImages === 0, `깨진 사진 ${result.layout.brokenImages}개`);
    return `${pages}쪽 · 모두 A4 · 요청 ${(result.payloadBytes / 1024).toFixed(0)}KB(사진 ${result.imageCount}개)`;
  });
  await check(fx.key, `${label} 내장 폰트만 사용(기기 폰트 0)`, async () => {
    const system = result.inspection?.system || [];
    assert(!system.length, system.map((f) => `${f.family} ${f.glyphs}글자 예: ${f.samples[0]}`).join(' | '));
    return '시스템 폰트 0';
  });
  await check(fx.key, `${label} 칸 넘침·쪽 밖 요소 0`, async () => {
    const issues = result.inspection?.layout || [];
    assert(!issues.length, `${issues.length}건: ${issues.slice(0, 6).join(' | ')}`);
    return '0건';
  });
  // Raster-independent layout check: every text run and its position inside the PDF (pinned pdf.js, points).
  // Separates "the PDF layout moved" from "the machine draws the same PDF a little differently" (CI 2026-11-16).
  await check(fx.key, `${label} 글자 위치 기준 비교(허용 ${WORD_TOLERANCE_PT}pt)`, async () => {
    const current = await pdfWords(pdfPath);
    const file = path.join(BASELINES, `${fx.key}-${kind}.words.json`);
    if (UPDATE) { await writeFile(file, `${JSON.stringify(current)}\n`); return `${current.flat().length}줄 기준 저장`; }
    assert(existsSync(file), `글자 위치 기준 없음: ${file}`);
    const base = JSON.parse(await readFile(file, 'utf8'));
    const diffs = compareWords(current, base);
    assert(!diffs.length, `${diffs.length}곳 다름: ${diffs.slice(0, 6).join(' | ')}`);
    return `${current.length}쪽 ${current.flat().length}줄 일치`;
  });
  await check(fx.key, `${label} 기준 이미지 비교(${DPI}dpi, 허용 ${MAX_CHANGED_RATIO * 100}%)`, async () => {
    const pages = await rasterize(pdfPath);
    const lines = [];
    const failures = [];
    for (const [index, current] of pages.entries()) {
      const name = `${fx.key}-${kind}-p${index + 1}.png`;
      const file = path.join(BASELINES, name);
      if (UPDATE) { await writeFile(file, encodeGrayPng(current)); lines.push(`${index + 1}쪽 기준 저장`); continue; }
      assert(existsSync(file), `기준 이미지 없음: ${file} (사람 확인 후 UPDATE_BASELINES=1로 생성)`);
      const result = compare(current, decodeGrayPng(await readFile(file)));
      lines.push(`${index + 1}쪽 ${(result.changed * 100).toFixed(2)}%`);
      if (result.changed > MAX_CHANGED_RATIO) {
        failures.push(`${index + 1}쪽 ${result.size || `${(result.changed * 100).toFixed(2)}% 바뀜`}`);
        if (result.diff) await writeFile(path.join(OUT, `diff-${name}`), encodeGrayPng(result.diff));
        await writeFile(path.join(OUT, `current-${name}`), encodeGrayPng(current));
      }
    }
    if (!UPDATE) {
      const stale = (await readdir(BASELINES)).filter((f) => f.startsWith(`${fx.key}-${kind}-p`) && Number(/-p(\d+)\.png$/.exec(f)?.[1]) > pages.length);
      if (stale.length) failures.push(`기준보다 쪽이 적음: ${stale.join(', ')}`);
    }
    assert(!failures.length, failures.join(' ; '));
    return lines.join(' · ');
  });
}

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await waitForSeed(page);
  for (const fx of FIXTURES) {
    const id = `qa-visual-${fx.key}`;
    await seedReportFixture(page, { id, name: fx.overrides?.name || `[테스트] 시각 회귀 ${fx.key}`, fx, overrides: fx.overrides || {} });
    console.log(`\n== ${fx.key}: ${fx.title}`);

    let proposal;
    await check(fx.key, '1P PDF 저장 버튼 → 고정 엔진', async () => {
      await page.goto(`${BASE_URL}/document/proposal/${id}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('.d1-sheet', { timeout: 30_000 });
      proposal = await savePdfFromApp(`${fx.key}-proposal`);
      return `${proposal.layout.pages}쪽 렌더`;
    });
    if (proposal) await verifyPdf(fx, 'proposal', proposal, 1);

    let detail;
    await check(fx.key, '상세 PDF 저장 버튼 → 고정 엔진', async () => {
      await page.goto(`${BASE_URL}/document/report/${id}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('.daon-professional-report-master', { timeout: 45_000 });
      detail = await savePdfFromApp(`${fx.key}-detail`);
      return `${detail.layout.pages}쪽 렌더`;
    });
    if (detail) await verifyPdf(fx, 'detail', detail, fx.reportPages);
    if (pageErrors.length) record(fx.key, '페이지 오류', 'FAIL', pageErrors.splice(0).join(' | '));
  }
  await check('render', '잘못된 요청 거절(이미지 형식)', async () => {
    const error = validateReportPdfPayload({ version: 1, kind: 'proposal', property: { id: 'x', name: 'x' }, images: { a: 'https://evil.example/x.png' } });
    assert(error, '외부 주소 이미지를 받아들임');
    return error;
  });
  await check('render', '렌더 페이지는 외부 네트워크 차단', async () => {
    assert(sampleProposalPayload, '1P 요청을 받지 못해 확인 불가');
    const payload = { ...sampleProposalPayload, property: { ...sampleProposalPayload.property, mainImage: 'https://example.com/leak.png', mapImage: 'https://example.com/leak-map.png' }, images: {} };
    const leak = await renderReportPdf({ browser, distDir: DIST, payload });
    assert(leak.layout.brokenImages >= 1, `외부 사진이 로드됨(brokenImages=${leak.layout.brokenImages})`);
    return `외부 사진 ${leak.layout.brokenImages}개 차단(빈 칸)`;
  });
} catch (error) {
  record('setup', '실행', 'FAIL', error instanceof Error ? error.message.slice(0, 600) : String(error));
} finally {
  await browser.close();
}

const failed = results.filter((r) => r.status === 'FAIL').length;
await writeFile(path.join(OUT, 'visual-report-regression.json'), JSON.stringify({ frozenNow: FROZEN_NOW.toISOString(), dpi: DPI, maxChangedRatio: MAX_CHANGED_RATIO, updated: UPDATE, results }, null, 2));
console.log(`\nReport visual regression: PASS ${results.length - failed} / FAIL ${failed}${UPDATE ? ' (baselines updated)' : ''}`);
process.exit(failed ? 1 : 0);
