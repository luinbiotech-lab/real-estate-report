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
import { deflateSync } from 'node:zlib';
import { chromium } from 'playwright';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const OUT = process.env.REPORT_QA_OUT || 'artifacts/agent-qa';
const SEED_ID = 'daon-bangbae-815-11';

// ---- generated test images (same approach as e2e-online-listings: real pixels, no external or owner files) ----
function crc32(buf) { let c, crc = 0xffffffff; for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function png(width, height, pixel) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) { raw[y * (width * 3 + 1)] = 0; for (let x = 0; x < width; x++) { const [r, g, b] = pixel(x, y); const o = y * (width * 3 + 1) + 1 + x * 3; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; } }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const IMAGES = {
  exterior: png(480, 320, (x, y) => (y < 80 ? [135, 190, 235] : y > 280 ? [90, 90, 95] : x > 100 && x < 380 ? ((x - 100) % 50 < 30 && (y - 80) % 50 < 30 ? [60, 90, 120] : [200, 190, 175]) : [150, 170, 150])),
  street: png(480, 320, (x, y) => (y < 120 ? [170, 200, 230] : y > 250 ? [80, 80, 85] : (x % 120) < 90 ? [185 - (x % 120), 175, 160] : [120, 130, 140])),
  map: png(600, 420, (x, y) => (Math.abs(y - 210) < 6 || Math.abs(x - 300) < 6 ? [250, 250, 250] : (x - 300) ** 2 + (y - 210) ** 2 < 120 ? [200, 40, 40] : [226, 232, 220])),
};

// ---- fixtures (QA inputs; values are test data, labelled as such in the property name) ----
const LONG = {
  occupancyStatus: '현재 소유자 직접 사용 중이며 잔금일 기준 전체 명도 협의가 가능합니다. 매입 후 장기간 공실 정리보다 실제 사용 계획을 빠르게 세우기 좋은 조건입니다.',
  roadCondition: '양면 도로 접면 코너. 파사드 노출, 출입구 분리, 방문객 동선 계획에서 실제 장점으로 작동합니다.',
  recommendedUse: '1층은 응대·브랜드 공간, 상층 업무/대표공간으로 소규모 사옥\n코너 파사드를 살린 목적형 외식·라이프스타일 플래그십\n지하 방음공간을 음악·콘텐츠 기능으로 살린 복합 문화공간',
  developmentPlan: '리노베이션 또는 신축을 통해 토지 활용가치 재평가. 제2종일반주거지역(7층 이하) 조건으로 도로·주차·일조·높이·건축선 사전검토가 필요합니다.',
  risks: '2026.09.02 등기 열람분상 과거 가처분 및 근저당권 설정은 말소 기록이 확인됩니다. 계약 체결 전 최신 등기사항전부증명서로 재확인합니다.',
  overallOpinion: '50.85평 코너 대지, 서래마을 생활권, 잔금일 기준 전체 명도 협의 가능성, 기존 건물의 즉시 활용성을 한 번에 확보하는 자산입니다.',
  locationAnalysis: '서래마을과 함지박사거리의 생활·외식 수요, 래미안 원페를라의 주거 배후가 맞닿는 생활권에서 목적형 공간으로 포지셔닝하기 좋습니다.',
};
const SHORT = { shortOccupancyLabel: '소유자 사용 · 명도 협의', shortRoadLabel: '양면 도로 코너', shortUseLabel: '소규모 사옥 · 플래그십', shortDevelopmentLabel: '리노베이션·신축 검토' };
const BROKER = { price: 3_950_123_456, confirmedAt: '2026-11-05T16:00:00Z' }; // UTC 16:00 = KST 2026-11-06 00:00 (date boundary)
const DEALS = [
  { dealDate: '2026-06-02', legalDong: '방배동', jibun: '882-25', type: 'commercial', buildingUse: '제2종근린생활', dealAmount: 4_200_000_000, landAreaSqm: 194.7, landPricePerPyeong: 71_311_556 },
  { dealDate: '2025-11-25', legalDong: '방배동', jibun: '811-20', type: 'commercial', buildingUse: '제2종근린생활', dealAmount: 4_500_000_000, landAreaSqm: 186.1, landPricePerPyeong: 79_936_056 },
  { dealDate: '2025-11-25', legalDong: '방배동', jibun: '811-19', type: 'commercial', buildingUse: '제2종근린생활', dealAmount: 4_100_000_000, landAreaSqm: 228.4, landPricePerPyeong: 59_342_294 },
  { dealDate: '2025-11-18', legalDong: '방배동', jibun: '456-30', type: 'commercial', buildingUse: '제2종근린생활', dealAmount: 3_500_000_000, landAreaSqm: 167.8, landPricePerPyeong: 68_952_920 },
  { dealDate: '2025-10-24', legalDong: '방배동', jibun: '2112', type: 'commercial', buildingUse: '제2종근린생활', dealAmount: 5_100_000_000, landAreaSqm: 198, landPricePerPyeong: 85_149_394 },
];
const ESTIMATE = {
  method: 'land_unit_price_iqr_v1', landAreaSqm: 168.1, comparableCount: 5, excluded: { upstream: 0 }, computedAt: '2026-11-05T15:35:22.455Z',
  areaRange: { minSqm: 84.1, maxSqm: 336.2 }, deals: DEALS, state: 'estimated',
  unitLow: 68_952_920, unitMid: 71_311_556, unitHigh: 79_936_056, low: 3_506_257_442, mid: 3_626_194_133, high: 4_064_750_140,
  note: '비교거래 5건 토지 평당가 하위25%·중앙값·상위25% × 본건 토지 50.85평 · DA:ON 추정, 감정평가 아님',
};
const FIXTURES = [
  { key: 'full', title: '자료 충분(9쪽) + 1P 짧은 문구 + 중개사 가격', short: true, broker: true, sparse: false, expectReportPages: 9, expectOmitted: [] },
  { key: 'long', title: '자료 충분 + 짧은 문구 없음(1P 길이 경고)', short: false, broker: false, sparse: false, expectReportPages: 9, expectOmitted: [] },
  { key: 'sparse', title: '자료 부족(선택 쪽 생략·번호 재부여)', short: false, broker: false, sparse: true, expectReportPages: 5, expectOmitted: [3, 4, 5, 6] },
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
for (const [name, body] of Object.entries(IMAGES)) await page.route(`**/__qa__/${name}.png`, (route) => route.fulfill({ status: 200, contentType: 'image/png', body }));

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
  await page.waitForFunction(async (seedId) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('real-estate-report'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    try { return await new Promise((res) => { try { const g = db.transaction('properties').objectStore('properties').get(seedId); g.onsuccess = () => res(Boolean(g.result)); g.onerror = () => res(false); } catch { res(false); } }); } finally { db.close(); }
  }, SEED_ID, { timeout: 45_000 });

  for (const fx of FIXTURES) {
    const id = `qa-pdf-text-${fx.key}`;
    const name = `[테스트] PDF 대조 ${fx.key}`;
    await page.evaluate(async ({ id, name, seedId, fx, long, short, broker, estimate, deals }) => {
      const db = await new Promise((res, rej) => { const r = indexedDB.open('real-estate-report'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      const get = (store, key) => new Promise((res, rej) => { const g = db.transaction(store).objectStore(store).get(key); g.onsuccess = () => res(g.result); g.onerror = () => rej(g.error); });
      try {
        const base = await get('properties', seedId);
        const now = new Date().toISOString();
        const blank = fx.sparse ? { locationAnalysis: '', roadCondition: '', overallOpinion: '', features: '', developmentPlan: '', recommendedUse: '', occupancyStatus: long.occupancyStatus, buildingCoverageRate: 0, floorAreaRatio: 0, completionDate: '', mapImage: '', nearbyTransactions: '', landUnitPrice: 0 } : {};
        const property = {
          ...base, id, name, propertyNumber: `QA-PDF-${fx.key.toUpperCase()}`, buildingName: '', recordClass: 'qa_fixture', recordClassSource: 'qa-report-pdf-text',
          internalPhotoAllowed: false, mainImage: '/__qa__/exterior.png', mapImage: '/__qa__/map.png', additionalImages: [],
          tradeType: '매매', salePrice: 4_150_000_000, negotiable: true,
          landAreaSqm: 168.1, landAreaPyeong: 50.85, totalFloorAreaSqm: 349.08, totalFloorAreaPyeong: 105.6, buildingAreaPyeong: 24.8,
          zoning: '제2종일반주거지역(7층 이하)', mainUse: '주택 및 근린생활시설', basementFloors: 1, groundFloors: 3, completionDate: '1978-07-31',
          buildingCoverageRate: 48.8, floorAreaRatio: 146.3, parkingSpaces: 2,
          ...long,
          features: '파사드·내부동선·지하공간을 브랜드 목적에 맞게 재구성',
          investmentPoints: '서래마을·함지박사거리 수요권 코너 입지\n기존 건물을 사옥·주거업무 복합공간으로 즉시 검토\n중장기 신축 가능성까지 검토 가능한 토지',
          shortHeadline: '', shortOccupancyLabel: '', shortRoadLabel: '', shortUseLabel: '', shortDevelopmentLabel: '',
          ...(fx.short ? short : {}),
          brokerAchievablePrice: fx.broker ? broker.price : 0, brokerAchievablePriceRationale: fx.broker ? 'QA: 인근 매수 문의 2건 기준' : '', brokerAchievablePriceConfirmedAt: fx.broker ? broker.confirmedAt : '',
          ...blank,
          createdAt: now, updatedAt: now,
        };
        const media = (n, url, caption) => ({ id: `${id}-m${n}`, propertyId: id, mediaType: 'image', category: 'exterior', storagePath: `qa/${id}/${n}`, url, fileName: `${n}.png`, mimeType: 'image/png', caption, aiTags: [], verificationStatus: 'confirmed', sortOrder: n, isPrimary: n === 0, createdAt: now, updatedAt: now });
        const space = (n, floor, spaceName, areaSqm, currentCondition) => ({ id: `${id}-space-${n}`, propertyId: id, floor, name: spaceName, spaceType: 'floor', areaSqm, currentCondition, verificationStatus: 'confirmed', createdAt: now, updatedAt: now });
        await new Promise((res, rej) => {
          const tx = db.transaction(['properties', 'propertyMedia', 'propertyDataSources', 'propertySpaces'], 'readwrite');
          tx.objectStore('properties').put(property);
          [media(0, '/__qa__/exterior.png', 'QA 외관(생성 이미지)'), media(1, '/__qa__/street.png', 'QA 가로(생성 이미지)')].forEach((m) => tx.objectStore('propertyMedia').put(m));
          [space(1, '3F', '주택', 81.98, '주거공간'), space(2, '2F', '주택', 81.98, '주거공간'), space(3, '1F', '근린생활시설 + 점포', 81.98, '전면 상가 및 출입부'), space(4, 'B1', '다가구용 단독주택(1가구)', 103.14, '방음시설 설치 · 음악/취미/모임공간')].forEach((s) => tx.objectStore('propertySpaces').put(s));
          if (!fx.sparse) {
            tx.objectStore('propertyDataSources').put({ id: `comparables:${id}`, propertyId: id, fieldKey: 'nearbyTransactions', resourceType: 'comparable_transaction_set', sourceType: 'public_api', sourceName: 'QA 비교거래(테스트 값)', sourceReference: 'qa', collectedAt: now, verificationStatus: 'confirmed', metadata: { rows: deals.map((d) => ({ label: `${d.legalDong} ${d.jibun}`, salePrice: d.dealAmount, landAreaPyeong: Math.round((d.landAreaSqm / 3.305785) * 100) / 100, landUnitPrice: d.landPricePerPyeong, tradeDate: d.dealDate })) }, createdAt: now });
            tx.objectStore('propertyDataSources').put({ id: `achievable-price:${id}`, propertyId: id, fieldKey: 'achievablePrice', resourceType: 'achievable_price_estimate', sourceType: 'calculated', sourceName: 'QA 추정(테스트 값)', sourceReference: 'qa', collectedAt: now, verificationStatus: 'estimated', metadata: { estimate }, createdAt: now });
          }
          tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
        });
      } finally { db.close(); }
    }, { id, name, seedId: SEED_ID, fx, long: LONG, short: SHORT, broker: BROKER, estimate: ESTIMATE, deals: DEALS });

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
        await page.getByRole('button', { name: '인쇄 / PDF 저장' }).first().click();
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
