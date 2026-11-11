// iOS print model 2 (DAON-040 reopened 2026-11-11): iOS ignored zoom on the device and scaled the widest box to the
// printable width. This reproduces the owner PDF (each page spills ~10mm). Approximation only, NOT device evidence.
// Usage: REPORT_QA_BASE_URL is fixed to 127.0.0.1:4175; node scripts/qa-local/ios-fit-width-sim.mjs <out.pdf> [extra-css] [report|proposal] [id]
// Model of iOS print: margins 14.1mm top/bottom, 6.55mm sides; content scaled so the widest box fills printable width.
import { chromium, devices } from 'playwright';
const [,, out, css = '', kind = 'report', id = 'daon-bangbae-815-11'] = process.argv;
const base = 'http://127.0.0.1:4175';
const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage();
await p.goto(base, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
await p.goto(`${base}/document/${kind}/${id}`, { waitUntil: 'networkidle' });
await p.waitForSelector(kind === 'report' ? '.daon-professional-report-master' : '.d1-sheet', { timeout: 45000 });
await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1000);
const cls = await p.evaluate(() => document.documentElement.className);
if (css) await p.addStyleTag({ content: css });
await p.addStyleTag({ content: '@page{margin:14.1mm 6.55mm !important}@page professional-report{margin:14.1mm 6.55mm !important}@page daon-professional-master{margin:14.1mm 6.55mm !important}@page daon-detail-master{margin:14.1mm 6.55mm !important}' });
await p.emulateMedia({ media: 'print' });
await p.setViewportSize({ width: 744, height: 1015 });
await p.waitForTimeout(500);
const W = await p.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, ...[...document.querySelectorAll('.daon-professional-report-master, .daon-frame-page, .daon-detail-page, .d1-sheet')].map(e => { const r = e.getBoundingClientRect(); return r.right + window.scrollX; })));
const printable = 196.9 / 25.4 * 96;
const scale = Math.min(2, Math.max(0.1, printable / W));
await p.pdf({ path: out, format: 'A4', printBackground: true, scale });
console.log(JSON.stringify({ cls, W, scale: +scale.toFixed(3) }));
await b.close();
