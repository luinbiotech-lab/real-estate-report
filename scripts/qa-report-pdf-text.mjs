// PDF text and page-count check for the DA:ON 1P / detail report (owner approval 2026-11-07, 루인 proposal on PR #47).
// Runs against the local-mode QA server (IndexedDB in the CI browser) — never the Production backend. Test fixtures only:
// recordClass 'qa_fixture', generated pixel images (exterior only, no interior photos, no owner sample files).
//
// For each fixture the 1P and the detail report are printed to PDF the same way the E2E does, the text layer is extracted
// with poppler `pdftotext`, and expected strings built from the fixture INPUT are compared whitespace-insensitively:
//   - price cells: exact won digits, units (원 / 평당), and the broker confirmation date in KST;
//   - condition / negation phrases ('감정평가 아님', '총액 아님');
//   - full original text of long fields in the detail report (never shortened);
//   - 1P chips: a broker short label prints in full; without one the long-text notice is shown before publishing;
//   - page count: full data = Opening + 7 + Closing = 9 pages; sparse data = omitted pages removed and renumbered.
// Every check prints PASS / FAIL; any FAIL exits 1. Results also go to artifacts/agent-qa/qa-report-pdf-text.json.
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { BROKER, DEALS, LONG, SHORT, routeQaImages, seedReportFixture, waitForSeed } from './lib/report-qa-fixtures.mjs';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const OUT = process.env.REPORT_QA_OUT || 'artifacts/agent-qa';

const FIXTURES = [
  { key: 'full', title: '자료 충분(9쪽) + 1P 짧은 문구 + 중개사 가격', short: true, broker: true, sparse: false, managerName: '', expectReportPages: 9, expectOmitted: [] },
  { key: 'long', title: '자료 충분 + 짧은 문구 없음(1P 길이 경고)', short: false, broker: false, sparse: false, managerName: 'QA 담당자', expectReportPages: 9, expectOmitted: [] },
  { key: 'sparse', title: '자료 부족(선택 쪽 생략·번호 재부여)', short: false, broker: false, sparse: true, managerName: '', expectReportPages: 5, expectOmitted: [3, 4, 5, 6] },
];

// ---- formatting expectations derived from the inputs (independent re-implementation, not imported from src) ----
const comma = (n) => Math.trunc(n).toLocaleString('en-US');
const exactWon = (won) => { const eok = Math.floor(won / 1e8); const man = Math.floor((won % 1e8) / 1e4); const rest = won % 1e4; return `${eok ? `${eok}억` : ''}${man ? `${comma(man)}만` : ''}${rest ? `${comma(rest)}원` : '원'}`; };
const kstDate = (iso) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
const squash = (text) => String(text).replace(/\s+/g, '');

const results = [];
function record(fixture, step, status, detail = '') {
  results.push({ fixture, step, status, detail });
  console.log(`${fixture} · ${step}: ${status}${detail ? ` — ${detail}` : ''}`);
  if (status === 'FAIL') console.log(`::error title=PDF text ${fixture} ${step}::${String(detail).replace(/\n/g, ' ').slice(0, 400)}`);
}
async function check(fixture, step, fn) {
  try { record(fixture, step, 'PASS', (await fn()) || ''); } catch (error) { record(fixture, step, 'FAIL', error instanceof Error ? error.message.slice(0, 600) : String(error)); }
}
function assert(condition, message) { if (!condition) throw new Error(message); }
function pdfText(path) { return execFileSync('pdftotext', ['-enc', 'UTF-8', path, '-'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }); }
function pdfPages(path) { const info = execFileSync('pdfinfo', [path], { encoding: 'utf8' }); return Number(/Pages:\s+(\d+)/.exec(info)?.[1] ?? NaN); }
function pdfPageText(path, n) { return execFileSync('pdftotext', ['-enc', 'UTF-8', '-f', String(n), '-l', String(n), path, '-'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }); }
function missing(text, expected) { const hay = squash(text); return expected.filter((item) => !hay.includes(squash(item))); }

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message.slice(0, 200)));
await routeQaImages(page);

// Self-test hook: QA_MUTATE_CSS injects CSS before printing so a regression (e.g. clipped text) can be shown to FAIL.
const MUTATE_CSS = process.env.QA_MUTATE_CSS || '';
async function printPdf(path) {
  if (MUTATE_CSS) await page.addStyleTag({ content: MUTATE_CSS });
  await page.evaluate(() => document.fonts.ready);
  await page.setViewportSize({ width: 794, height: 1123 });
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path, printBackground: true, preferCSSPageSize: true });
  await page.emulateMedia({ media: null });
  await page.setViewportSize({ width: 1440, height: 1100 });
}

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  // The local bootstrap seeds the reference property; the fixtures reuse its complete record shape.
  await waitForSeed(page);

  for (const fx of FIXTURES) {
    const id = `qa-pdf-text-${fx.key}`;
    const name = `[테스트] PDF 대조 ${fx.key}`;
    await seedReportFixture(page, { id, name, fx });

    // ---- 1P ----
    const onePath = `${OUT}/qa-pdf-${fx.key}-1p.pdf`;
    let oneText = '';
    await check(fx.key, '1P PDF 1쪽', async () => {
      await page.goto(`${BASE_URL}/document/proposal/${id}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('.d1-sheet', { timeout: 30_000 });
      const notice = await page.locator('[data-testid="report-long-fields-notice"], [data-testid="report-blank-fields-notice"]').allInnerTexts();
      fx.notice = notice.join(' | ');
      // The pre-publish dialog (opened by the print button while any notice is unacknowledged) lists the long 1P texts.
      fx.dialogLong = '';
      if (notice.length) {
        await page.getByRole('button', { name: '브라우저 인쇄' }).first().click();
        await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 10_000 });
        fx.dialogLong = (await page.locator('[data-testid="report-long-fields"]').allInnerTexts()).join(' | ');
        await page.keyboard.press('Escape');
        await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 10_000 });
      }
      await page.evaluate(() => { for (const el of document.querySelectorAll('.preview-toolbar, .preview-blank-notice')) el.style.setProperty('display', 'none', 'important'); });
      await printPdf(onePath);
      oneText = pdfText(onePath);
      const pages = pdfPages(onePath);
      assert(pages === 1, `1P PDF ${pages}쪽 (1쪽 기대)`);
      return `${pages}쪽`;
    });
    await check(fx.key, '1P 가격·조건 문구(추출 텍스트)', async () => {
      const expected = ['41억 5,000만원'];
      if (fx.broker) expected.push(exactWon(BROKER.price), `중개사 확정 ${kstDate(BROKER.confirmedAt)}`, '감정평가 아님');
      const lost = missing(oneText, expected);
      assert(!lost.length, `1P PDF에 없음: ${lost.join(' / ')}`);
      return expected.join(' · ');
    });
    if (fx.short) {
      await check(fx.key, '1P 짧은 문구 전체 출력', async () => {
        const lost = missing(oneText, Object.values(SHORT));
        assert(!lost.length, `짧은 문구가 PDF에 전체 출력되지 않음: ${lost.join(' / ')}`);
        assert(!fx.dialogLong && !/잘림|잘리는/.test(fx.notice || ''), `짧은 문구가 있는데 길이 경고 표시: ${fx.notice} ${fx.dialogLong}`);
        return Object.values(SHORT).join(' · ');
      });
    } else if (!fx.sparse) {
      await check(fx.key, '1P 긴 문구 발행 전 경고', async () => {
        const warned = `${fx.notice} ${fx.dialogLong}`;
        for (const label of ['현재 이용·명도', '도로 조건', '활용 제안', '개발·인허가 계획']) assert(warned.includes(label), `발행 전 경고에 '${label}' 잘림 안내 없음 (안내: ${warned.trim() || '없음'})`);
        return (fx.dialogLong || fx.notice).slice(0, 160);
      });
    }

    // ---- detail report ----
    const reportPath = `${OUT}/qa-pdf-${fx.key}-report.pdf`;
    let reportText = '';
    await check(fx.key, `보고서 PDF ${fx.expectReportPages}쪽`, async () => {
      await page.goto(`${BASE_URL}/document/report/${id}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('.daon-professional-report-master', { timeout: 45_000 });
      await page.evaluate(() => { for (const el of document.querySelectorAll('.professional-report-toolbar, .professional-report-alert')) el.style.setProperty('display', 'none', 'important'); });
      await page.waitForTimeout(800);
      const plan = await page.evaluate(() => [...document.querySelectorAll('.daon-professional-report-master .daon-detail-page')].map((el) => ({ id: Number(el.getAttribute('data-detail-page')), number: Number(el.querySelector('.dd-head')?.getAttribute('data-page-number') || 0) })));
      fx.plan = plan;
      await printPdf(reportPath);
      reportText = pdfText(reportPath);
      const pages = pdfPages(reportPath);
      assert(pages === fx.expectReportPages, `보고서 PDF ${pages}쪽 (${fx.expectReportPages}쪽 기대: 표지 + 상세 ${fx.expectReportPages - 2} + 마지막)`);
      return `${pages}쪽 · 상세 ${plan.map((p) => `${p.id}→${p.number}`).join(' ')}`;
    });
    await check(fx.key, '생략 쪽·번호 재부여', async () => {
      const ids = (fx.plan || []).map((p) => p.id);
      const omitted = [1, 2, 3, 4, 5, 6, 7].filter((n) => !ids.includes(n));
      assert(JSON.stringify(omitted) === JSON.stringify(fx.expectOmitted), `생략 쪽 ${JSON.stringify(omitted)} (기대 ${JSON.stringify(fx.expectOmitted)})`);
      const numbers = (fx.plan || []).map((p) => p.number);
      assert(numbers.every((n, i) => n === i + 1), `쪽 번호가 1부터 연속이 아님: ${numbers.join(',')}`);
      return omitted.length ? `생략 ${omitted.join(',')} · 번호 ${numbers.join(',')}` : `생략 없음 · 번호 ${numbers.join(',')}`;
    });
    // 루인 review on #52 (2026-11-11): the DOM plan order must match the actual PDF page order, also when pages are omitted.
    // Each detail page's own header (page title + printed "| 0N") must be extracted from the PDF page it should be on,
    // so a reordered, duplicated or wrongly numbered page fails even when the total page count is right.
    await check(fx.key, '보고서 쪽 머리말(제목·인쇄 번호)이 PDF 쪽 순서와 일치', async () => {
      const HEADER = { 1: 'WHY THIS ASSET', 2: 'PROPERTY PROFILE', 3: 'LOCATION LEVERAGE', 4: 'MARKET POSITION', 5: 'VALUE CREATION SCENARIOS', 6: 'BUILDING & DEVELOPMENT REVIEW', 7: 'TRANSACTION READINESS' };
      const plan = fx.plan || [];
      const problems = [];
      plan.forEach((entry, index) => {
        const pdfPage = index + 2;
        const text = squash(pdfPageText(reportPath, pdfPage));
        if (!text.includes(squash(HEADER[entry.id] || '?'))) problems.push(`PDF ${pdfPage}쪽에 상세 ${entry.id} 제목(${HEADER[entry.id]}) 없음`);
        const printed = `|${String(index + 1).padStart(2, '0')}`;
        if (!text.includes(printed)) problems.push(`PDF ${pdfPage}쪽에 인쇄 번호 ${printed} 없음`);
        for (const [otherId, title] of Object.entries(HEADER)) {
          if (Number(otherId) !== entry.id && Number(otherId) !== 1 && text.includes(squash(title))) problems.push(`PDF ${pdfPage}쪽에 다른 상세 ${otherId} 제목 섞임`);
        }
      });
      assert(!problems.length, problems.join(' ; '));
      return plan.map((entry, index) => `PDF${index + 2}쪽=상세${entry.id}·${String(index + 1).padStart(2, '0')}`).join(' ');
    });
    await check(fx.key, '보고서 원문·가격·조건 문구(추출 텍스트)', async () => {
      const expected = ['41억 5,000만원', LONG.occupancyStatus, LONG.risks, '제2종일반주거지역(7층 이하)'];
      if (!fx.sparse) {
        expected.push(LONG.roadCondition, LONG.developmentPlan, LONG.overallOpinion, LONG.locationAnalysis, ...LONG.recommendedUse.split('\n'));
        expected.push('평당', '총액 아님', '감정평가 아님');
        for (const d of DEALS) expected.push(`${d.legalDong} ${d.jibun}`);
      }
      if (fx.broker) expected.push(exactWon(BROKER.price), `중개사 확정 ${kstDate(BROKER.confirmedAt)}`);
      const lost = missing(reportText, expected);
      assert(!lost.length, `보고서 PDF에 없음(${lost.length}/${expected.length}): ${lost.map((s) => s.slice(0, 40)).join(' / ')}`);
      return `${expected.length}개 문자열 일치`;
    });
    // 루인 review on #51: whole-document containment cannot catch a value printed on the wrong page or a whole card
    // dropped while the same words survive elsewhere. Key values are also required on their own detail page
    // (PDF page = Opening + position in the rendered plan).
    await check(fx.key, '보고서 쪽별 위치(핵심 값이 해당 쪽에 있음)', async () => {
      const byPage = {
        1: ['41억 5,000만원', LONG.overallOpinion],
        2: ['제2종일반주거지역(7층 이하)'],
        3: [LONG.locationAnalysis],
        4: ['감정평가 아님', '총액 아님', ...DEALS.map((d) => `${d.legalDong} ${d.jibun}`), ...(fx.broker ? [exactWon(BROKER.price), `중개사 확정 ${kstDate(BROKER.confirmedAt)}`] : [])],
        5: LONG.recommendedUse.split('\n'),
        6: [LONG.developmentPlan],
        7: [LONG.risks],
      };
      if (fx.sparse) { byPage[1] = ['41억 5,000만원']; }
      const plan = fx.plan || [];
      const problems = [];
      const opening = pdfPageText(reportPath, 1);
      if (!squash(opening).includes(squash(name))) problems.push(`표지(1쪽)에 물건명 없음`);
      plan.forEach((entry, index) => {
        const pdfPage = index + 2;
        const lost = missing(pdfPageText(reportPath, pdfPage), byPage[entry.id] || []);
        if (lost.length) problems.push(`상세 ${entry.id}(PDF ${pdfPage}쪽)에 없음: ${lost.map((x) => x.slice(0, 30)).join(' / ')}`);
      });
      const last = pdfPageText(reportPath, plan.length + 2);
      if (!/DA:?ON/i.test(last)) problems.push(`마지막 쪽(PDF ${plan.length + 2}쪽)에 DA:ON 없음`);
      assert(!problems.length, problems.join(' ; '));
      return plan.map((entry, index) => `상세${entry.id}→PDF${index + 2}쪽 ${(byPage[entry.id] || []).length}개`).join(' · ');
    });
    // 루인 cross-review on #56 (2026-11-12): when optional pages are omitted (e.g. 5-page output) the opening, the closing
    // introduction/contact and the per-page footer (broker contact, snapshot/source line) must survive, and the 1P and the
    // detail report must print the same price, land area and zoning.
    await check(fx.key, '생략 후에도 표지·마지막 소개·연락처·쪽별 출처 유지, 1P와 값 일치', async () => {
      const plan = fx.plan || [];
      const digits = (value) => value.replace(/\D/g, '');
      const phone = '01099531270';
      const problems = [];
      const opening = squash(pdfPageText(reportPath, 1));
      if (!opening.includes(squash('부동산 전속매각 보고서'))) problems.push('표지에 보고서 제목 없음');
      plan.forEach((entry, index) => {
        const raw = pdfPageText(reportPath, index + 2);
        if (!digits(raw).includes(phone)) problems.push(`PDF ${index + 2}쪽 바닥글에 중개사 연락처 없음`);
        if (!/Snapshot/i.test(raw)) problems.push(`PDF ${index + 2}쪽 바닥글에 Snapshot·출처 줄 없음`);
        // 루인 review (2026-11-12): no personal-name fallback; a name appears only when the fixture entered one.
        if (!fx.managerName && /김은미/.test(raw)) problems.push(`PDF ${index + 2}쪽에 입력되지 않은 담당자 이름 출력`);
        if (fx.managerName && !squash(raw).includes(squash(fx.managerName))) problems.push(`PDF ${index + 2}쪽 바닥글에 입력한 담당자 이름 없음`);
        if (entry.id === 7 && !squash(raw).includes(squash('M 010 9953 1270'))) problems.push(`상세 7(PDF ${index + 2}쪽)에 연락처 띠 없음`);
      });
      const closing = pdfPageText(reportPath, plan.length + 2);
      // 2026-11-16 font lock: "DAON" (Tinos) and "소개" (Noto Sans KR) are two fonts on one line, and pdftotext's layout
      // mode may emit them as separate blocks. Accept the joined phrase or both words on the closing page (raw order).
      const closingRaw = squash(execFileSync('pdftotext', ['-enc', 'UTF-8', '-raw', '-f', String(plan.length + 2), '-l', String(plan.length + 2), reportPath, '-'], { encoding: 'utf8' }));
      if (!squash(closing).includes(squash('DAON 소개')) && !closingRaw.includes(squash('DAON 소개'))) problems.push('마지막 쪽에 DAON 소개 없음');
      if (!/Contact/i.test(closing) || !digits(closing).includes(phone)) problems.push('마지막 쪽에 Contact·연락처 없음');
      if (oneText) {
        for (const value of ['41억 5,000만', '168.1', '제2종일반주거지역']) {
          if (!squash(oneText).includes(squash(value))) problems.push(`1P에 ${value} 없음`);
          if (!squash(reportText).includes(squash(value))) problems.push(`상세 보고서에 ${value} 없음`);
        }
      } else problems.push('1P 텍스트 없음(비교 불가)');
      assert(!problems.length, problems.join(' ; '));
      return `표지·마지막·연락처 ${plan.length}쪽 바닥글·1P 값 3개 일치`;
    });
    await check(fx.key, '보고서 말줄임(…) 없음', async () => {
      const n = (reportText.match(/…/g) || []).length;
      assert(n === 0, `보고서 PDF에 '…' ${n}개`);
      return '0개';
    });
    if (pageErrors.length) record(fx.key, '페이지 오류', 'FAIL', pageErrors.splice(0).join(' | '));
  }
} catch (error) {
  record('setup', '실행', 'FAIL', error instanceof Error ? error.message.slice(0, 600) : String(error));
} finally {
  await browser.close();
}

const fails = results.filter((r) => r.status === 'FAIL').length;
await writeFile(`${OUT}/qa-report-pdf-text.json`, JSON.stringify({ checkedAt: new Date().toISOString(), baseUrl: BASE_URL, results }, null, 2));
console.log(`PDF text check: PASS ${results.length - fails} / FAIL ${fails}`);
process.exit(fails ? 1 : 0);
