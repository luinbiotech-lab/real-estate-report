// Fixed-engine report PDF contract (2026-11-16, owner: the report keeps one format on every device).
// Static + unit checks; the rendered proof is scripts/visual-report-regression.mjs (CI e2e job).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reportPdfFileName, validateReportPdfPayload } from '../api/_lib/reportPdf.mjs';

const read = (file) => readFileSync(file, 'utf8');
const pass = (message) => console.log(`PASS ${message}`);

// 1. Payload boundary: only inline PNG/JPEG/WebP images, known kinds, required identity.
const png = 'data:image/png;base64,iVBORw0KGgo=';
assert.equal(validateReportPdfPayload({ version: 1, kind: 'proposal', property: { id: 'p1', name: 'x' }, images: { '/a.png': png } }), '');
assert.equal(validateReportPdfPayload({ version: 1, kind: 'detail', snapshot: { id: 's1', propertyId: 'p1', snapshotData: {} }, images: {} }), '');
assert.ok(validateReportPdfPayload({ version: 1, kind: 'proposal', property: { id: 'p1' }, images: { a: 'https://evil.example/x.png' } }), 'external image URL must be rejected');
assert.ok(validateReportPdfPayload({ version: 1, kind: 'proposal', property: { id: 'p1' }, images: { a: 'data:image/svg+xml;base64,PHN2Zz4=' } }), 'SVG data URL must be rejected');
assert.ok(validateReportPdfPayload({ version: 2, kind: 'proposal', property: { id: 'p1' } }), 'unknown version must be rejected');
assert.ok(validateReportPdfPayload({ version: 1, kind: 'briefing', property: { id: 'p1' } }), 'unknown kind must be rejected');
assert.ok(validateReportPdfPayload({ version: 1, kind: 'detail', snapshot: { id: 's1' } }), 'detail without snapshotData must be rejected');
assert.ok(validateReportPdfPayload({ version: 1, kind: 'proposal', property: { id: 'p' }, images: Object.fromEntries(Array.from({ length: 41 }, (_, i) => [String(i), png])) }), 'more than 40 images must be rejected');
assert.match(reportPdfFileName({ kind: 'proposal', property: { id: 'daon-bangbae-815-11' } }), /^DAON_1P_MASTER_daon-bangbae-815-11\.pdf$/);
assert.match(reportPdfFileName({ kind: 'detail', snapshot: { reportVersion: 3, propertyId: '방배 815/11"' } }), /^[A-Za-z0-9._-]+\.pdf$/, 'download name must be header-safe ASCII');
pass('payload boundary: inline PNG/JPEG/WebP only, kinds, identity, image count, safe file name');

// 2. Renderer is hermetic: private origin, everything else blocked, files only from dist.
const renderer = read('api/_lib/reportPdf.mjs');
for (const marker of ["route.abort('blockedbyclient')", "RENDER_ORIGIN = 'http://daon-render.local'", 'preferCSSPageSize: true', 'printBackground: true', "if (!file.startsWith(`${root}${path.sep}`))"]) assert.ok(renderer.includes(marker), `renderer missing: ${marker}`);
pass('renderer: private origin, network blocked, dist-only files, CSS page size');

// 3. Deployment wiring: render.html is built, the function ships dist/ and pinned engine versions.
assert.ok(read('vite.config.ts').includes("render: 'render.html'"), 'vite must build render.html');
const vercel = JSON.parse(read('vercel.json'));
assert.equal(vercel.functions?.['api/report-pdf.mjs']?.includeFiles, 'dist/**', 'report-pdf function must include dist/**');
assert.ok(!vercel.rewrites.some((row) => String(row.source).startsWith('/api/report-pdf')), 'no rewrite may shadow /api/report-pdf');
const pkg = JSON.parse(read('package.json'));
assert.match(pkg.dependencies['playwright-core'] || '', /^\d+\.\d+\.\d+$/, 'playwright-core must be pinned exactly');
assert.match(pkg.dependencies['@sparticuz/chromium'] || '', /^\d+\.\d+\.\d+$/, '@sparticuz/chromium must be pinned exactly');
pass('deployment: render.html built, dist bundled into the function, engine versions pinned');

// 4. Report pages: same fonts/guards in app and render page; "PDF 저장" uses the fixed engine.
for (const file of ['src/pages/DocumentPreview.tsx', 'src/pages/ProfessionalReportSnapshotPage.tsx', 'src/render/main.tsx']) {
  const source = read(file);
  for (const css of ['report-font-lock/index.css', 'report-layout-guard.css']) assert.ok(source.includes(css), `${file} must import ${css}`);
}
for (const file of ['src/pages/DocumentPreview.tsx', 'src/pages/ProfessionalReportSnapshotPage.tsx']) {
  const source = read(file);
  assert.ok(source.includes('useFixedReportPdf') && source.includes("'PDF 저장'"), `${file}: PDF 저장 must use the fixed engine`);
  assert.ok(source.includes('브라우저 인쇄'), `${file}: browser print must be labelled as the fallback`);
}
const lock = read('src/assets/fonts/report-font-lock/index.css');
for (const family of ['Pretendard', 'Noto Sans KR', 'Montserrat', 'Georgia', 'Times New Roman', 'NanumMyeongjo']) assert.ok(lock.includes(`font-family:'${family}'`), `font lock missing ${family}`);
pass('report pages: font lock + layout guard on app and render page, PDF 저장 = fixed engine, browser print labelled fallback');
