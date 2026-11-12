// iOS "PDF 저장" simulation (DAON-040): iPhone 13 viewport + print media + iOS page margins (~6.35mm sides, ~14mm top/bottom).
// It approximates layout only; it is NOT evidence for a real iPhone (iOS Quartz print path, system fonts). Local-mode build only.
// Usage: REPORT_QA_BASE_URL=http://127.0.0.1:4175 node scripts/qa-local/ios-print-sim.mjs <out-prefix> [fit|nofit] [propertyId]
import { chromium, devices } from 'playwright';
const [,, out = 'ios-sim', fit = 'fit', id = 'daon-bangbae-815-11'] = process.argv;
const base = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4175';
const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage();
await p.goto(base, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
const res = {};
for (const [kind, sel] of [['report', '.daon-professional-report-master'], ['proposal', '.d1-sheet']]) {
  await p.goto(`${base}/document/${kind}/${id}`, { waitUntil: 'networkidle' });
  await p.waitForSelector(sel, { timeout: 45000 }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1200);
  await p.evaluate((fit) => { if (fit === 'fit') document.documentElement.classList.add('ios-print-fit'); const s = document.createElement('style'); s.textContent = '@page{margin:14mm 6.35mm !important}@page professional-report{margin:14mm 6.35mm !important}@page daon-professional-master{margin:14mm 6.35mm !important}'; document.head.appendChild(s); }, fit);
  await p.emulateMedia({ media: 'print' });
  res[kind] = { domPages: await p.evaluate(() => document.querySelectorAll('.daon-frame-page, .daon-detail-page, .d1-sheet').length) };
  await p.pdf({ path: `${out}-${kind}.pdf`, format: 'A4', printBackground: true });
  await p.emulateMedia({ media: null });
}
console.log(JSON.stringify(res)); await b.close();
