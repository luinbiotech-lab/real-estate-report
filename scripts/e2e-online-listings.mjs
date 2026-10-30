// End-to-end operational test with real public listings as TEST registrations (owner request 2026-10-30).
// Runs against the local-mode QA server (IndexedDB in the CI browser) — never the Production backend.
// Flow per listing: register via the form → property hub → Data Room tabs → 1P MASTER → 7P MASTER (Opening + detail 1..7 +
// Closing) → location briefing → 3D/interior workspaces. DXF upload → Digital Twin handoff for the first listing.
// Every check is reported as a GitHub annotation (::notice PASS / ::error FAIL) and in artifacts/agent-qa/e2e-online-listings.json.
import { mkdir, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { chromium } from 'playwright';
import { classifyPropertyType, marketSummary as summarizeMarket, normalizeTrade } from '../api/property-discovery.mjs';
import { normalizeResidentialDeal, residentialSummary } from '../api/_lib/residentialTrades.mjs';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const OUT = 'artifacts/agent-qa';

// Public listings found online on 2026-10-30 (source URLs kept). Values are the listing's own claims, not verified facts.
const LISTINGS = [
  { key: 'donggyo', source: 'https://realty.daangn.com/articles/4164139', name: '[테스트] 동교동 동교로 212-22 근생', address: '서울특별시 마포구 동교로 212-22', salePrice: 3_000_000_000, landAreaSqm: 140.8, totalFloorAreaSqm: 266, basementFloors: 1, groundFloors: 3, mainUse: '제2종 근린생활시설', zoning: '', nearbyStation: '홍대입구역', completionDate: '1993-02-10', parkingSpaces: 0 },
  { key: 'bangbae-dongkwang', source: 'https://realty.daangn.com/articles/4557898', name: '[테스트] 방배동 동광로1길 49 근생', address: '서울특별시 서초구 동광로1길 49', salePrice: 2_900_000_000, landAreaSqm: 146.2, totalFloorAreaSqm: 160.87, basementFloors: 1, groundFloors: 2, mainUse: '제2종 근린생활시설', zoning: '제3종일반주거지역', nearbyStation: '총신대입구역', completionDate: '1976-12-10', parkingSpaces: 0 },
  { key: 'yeoksam', source: 'https://realty.daangn.com/articles/4523816', name: '[테스트] 역삼동 논현로 339 근생', address: '서울특별시 강남구 논현로 339', salePrice: 20_000_000_000, landAreaSqm: 365.1, totalFloorAreaSqm: 976.2, basementFloors: 1, groundFloors: 4, mainUse: '제2종 근린생활시설', zoning: '제3종일반주거지역', nearbyStation: '역삼역', completionDate: '1984-10-12', parkingSpaces: 0 },
];


// Real raster test files (generated pixels, not placeholders): an "interior" photo, an "exterior" photo and a scanned floor plan.
function crc32(buf) { let c, crc = 0xffffffff; for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function png(width, height, pixel) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) { raw[y * (width * 3 + 1)] = 0; for (let x = 0; x < width; x++) { const [r, g, b] = pixel(x, y); const o = y * (width * 3 + 1) + 1 + x * 3; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; } }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const IMAGES = {
  // Room (400x300, so it is distinguishable from the 480x320 exterior in the report hero): warm floor, light walls, a window and a door.
  interior: png(400, 300, (x, y) => (y > 215 ? [150 + (x % 40), 110, 70] : x > 60 && x < 180 && y > 50 && y < 150 ? [170, 210, 240] : x > 360 && x < 420 && y > 90 ? [120, 80, 50] : [235 - y / 8, 230 - y / 8, 220 - y / 8])),
  // Facade: sky, building with window grid, road.
  exterior: png(480, 320, (x, y) => (y < 80 ? [135, 190, 235] : y > 280 ? [90, 90, 95] : x > 100 && x < 380 ? ((x - 100) % 50 < 30 && (y - 80) % 50 < 30 ? [60, 90, 120] : [200, 190, 175]) : [150, 170, 150])),
  // Floor plan: white sheet with black walls and an inner partition.
  plan: png(600, 420, (x, y) => ((x > 40 && x < 560 && (Math.abs(y - 40) < 4 || Math.abs(y - 380) < 4)) || (y > 40 && y < 380 && (Math.abs(x - 40) < 4 || Math.abs(x - 560) < 4 || (Math.abs(x - 300) < 3 && (y < 180 || y > 240)))) ? [20, 20, 20] : [252, 252, 250])),
};


// PDF page count from the raw bytes: Chromium writes one '/Type /Page' object per page and the page tree '/Count'.
function pdfPageCount(buffer) {
  const text = buffer.toString('latin1');
  const pages = (text.match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
  const counts = [...text.matchAll(/\/Type\s*\/Pages[\s\S]{0,200}?\/Count\s+(\d+)/g)].map((m) => Number(m[1]));
  return { pages, treeCount: counts.length ? Math.max(...counts) : null };
}

const results = [];
const esc = (text) => String(text).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
function record(listing, step, status, detail = '') {
  results.push({ listing, step, status, detail });
  const line = `[${status}] ${listing} · ${step}${detail ? ` — ${detail}` : ''}`;
  console.log(line);
  // GitHub keeps ~10 annotations per level per step: annotate only WARN/FAIL; PASS lines go to the log and the summary.
  if (status !== 'PASS') console.log(`::${status === 'WARN' ? 'warning' : 'error'} title=E2E ${esc(listing)} ${esc(step)}::${esc(`${status}${detail ? ` ${detail}` : ''}`)}`);
}
async function check(listing, step, fn) {
  try { const detail = await fn(); record(listing, step, 'PASS', detail || ''); return true; }
  catch (error) {
    // Artifacts cannot be downloaded from every review environment, so the failure line itself carries the context:
    // where the page was, its headings and any alert text.
    const where = await page.evaluate(() => ({
      path: location.pathname + location.search,
      headings: [...document.querySelectorAll('h1, h2')].map((el) => (el.textContent || '').trim()).filter(Boolean).slice(0, 6).join(' | '),
      alerts: [...document.querySelectorAll('.MuiAlert-message')].map((el) => (el.textContent || '').trim().slice(0, 100)).slice(0, 3).join(' | '),
    })).catch(() => null);
    const message = error instanceof Error ? error.message.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 3).join(' ').slice(0, 300) : String(error);
    record(listing, step, 'FAIL', `${message}${where ? ` @ ${where.path} [h: ${where.headings}]${where.alerts ? ` [alert: ${where.alerts}]` : ''}` : ''}`);
    return false;
  }
}
function assert(condition, message) { if (!condition) throw new Error(message); }

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, locale: 'ko-KR' });
const page = await context.newPage();
let pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message.slice(0, 200)));
page.on('dialog', (dialog) => { void dialog.accept(); });
const takeErrors = () => { const list = pageErrors; pageErrors = []; return list; };
const shot = (name) => page.screenshot({ path: `${OUT}/e2e-${name}.png`, fullPage: true }).catch(() => undefined);
async function visibleText(text, timeout = 20_000) { await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout }); }
async function fill(label, value) {
  if (value === '' || value === undefined) return;
  const field = page.getByLabel(label, { exact: true });
  await field.fill(String(value));
}

const registered = [];
try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await visibleText('물건 관리', 30_000);

  for (const listing of LISTINGS) {
    const tag = listing.key;
    let propertyId = '';
    // 1. Registration through the real form.
    const ok = await check(tag, '물건 등록(폼 저장 → 상세 이동)', async () => {
      await page.goto(`${BASE_URL}/property/new`, { waitUntil: 'domcontentloaded' });
      await page.getByLabel('물건명 *', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 });
      // A fresh registration form must not greet the user with an error banner (2026-10-30: the map panel showed a red
      // 'npm run dev' error before its status check). Wait for the provider status check to settle first.
      await page.getByText('지도·주소 자동화 연결 상태를 확인하는 중입니다.').waitFor({ state: 'detached', timeout: 15_000 }).catch(() => undefined);
      const formErrors = await page.locator('.MuiAlert-standardError, .MuiAlert-filledError').allInnerTexts();
      assert(!formErrors.length, `등록 화면 오류 배너: ${formErrors.map((text) => text.slice(0, 80)).join(' / ')}`);
      await fill('물건번호', `TEST-${tag.toUpperCase()}`);
      await fill('물건명 *', listing.name);
      await fill('주소 *', listing.address);
      await fill('매매가 (원)', listing.salePrice);
      await fill('대지면적 ㎡', listing.landAreaSqm);
      await fill('연면적 ㎡', listing.totalFloorAreaSqm);
      await fill('지하층', listing.basementFloors);
      await fill('지상층', listing.groundFloors);
      await fill('주용도', listing.mainUse);
      await fill('용도지역', listing.zoning);
      await fill('인근역', listing.nearbyStation);
      await fill('특징', `테스트 등록: 공개 매물 ${listing.source} 의 게시 정보(미검증)`);
      await page.getByRole('button', { name: /저장/ }).first().click();
      await page.waitForURL(/\/property\/[^/]+$/, { timeout: 20_000 });
      propertyId = decodeURIComponent(new URL(page.url()).pathname.split('/').pop());
      assert(propertyId && propertyId !== 'new', `저장 후 URL에서 물건 ID를 찾지 못했습니다: ${page.url()}`);
      await visibleText(listing.name);
      const errors = takeErrors(); assert(!errors.length, `페이지 오류: ${errors.join(' | ')}`);
      return `id=${propertyId}`;
    });
    await shot(`${tag}-hub`);
    if (!ok) continue;
    registered.push({ ...listing, propertyId });

    // 2. Hub shows the registered values (area conversion is done by the form).
    await check(tag, '상세 허브 핵심 정보', async () => {
      const text = await page.locator('body').innerText();
      assert(text.includes(listing.address), '주소가 허브에 표시되지 않습니다.');
      assert(/억|원/.test(text), '매매가 표시가 없습니다.');
      assert(text.includes(`지상 ${listing.groundFloors}층`), `층수 표시 불일치(지상 ${listing.groundFloors}층 기대)`);
      return '주소·매매가·층수 표시';
    });

    // 3. Data Room tabs open without errors.
    for (const tab of ['overview', 'media', 'spatial', 'documents', 'official', 'market', 'verification', 'reports', 'digitalTwin']) {
      await check(tag, `Data Room 탭 ${tab}`, async () => {
        await page.goto(`${BASE_URL}/property/${encodeURIComponent(propertyId)}/data-room?tab=${tab}`, { waitUntil: 'domcontentloaded' });
        await page.locator('.data-room-page').waitFor({ state: 'visible', timeout: 20_000 });
        const errorAlerts = await page.locator('.MuiAlert-standardError, .MuiAlert-filledError').count();
        const errors = takeErrors();
        assert(!errors.length, `페이지 오류: ${errors.join(' | ')}`);
        assert(errorAlerts === 0, `오류 배너 ${errorAlerts}건`);
      });
    }
    await shot(`${tag}-dataroom`);

    // 4. 1P MASTER (owner standard: DAON_1P_MASTER, single sheet, no overflow, no '확인 필요' placeholder facts).
    await check(tag, '1P 요약제안서 MASTER 기준', async () => {
      await page.goto(`${BASE_URL}/document/proposal/${encodeURIComponent(propertyId)}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.d1-sheet', { timeout: 30_000 });
      const one = await page.evaluate(() => {
        const sheet = document.querySelector('.d1-sheet');
        const root = document.querySelector('.daon-one-page-master');
        const facts = [...document.querySelectorAll('.d1-fact')].map((item) => item.textContent?.trim() || '');
        return { templateId: root?.getAttribute('data-template-id'), facts, sw: sheet.scrollWidth, cw: sheet.clientWidth, sh: sheet.scrollHeight, ch: sheet.clientHeight, text: sheet.textContent || '' };
      });
      await shot(`${tag}-1p`);
      assert(one.templateId === 'DAON_1P_MASTER', `템플릿 ${one.templateId}`);
      assert(one.text.includes(listing.name.replace('[테스트] ', '')) || one.text.includes(listing.name), '1P에 물건명이 없습니다.');
      assert(one.facts.length > 0 && one.facts.length <= 12, `표시 항목 수 ${one.facts.length}`);
      const onePlaceholder = one.text.match(/.{0,30}(확인 필요|검토 필요|분석 필요|미등록).{0,20}/);
      assert(!onePlaceholder, `1P에 공란 placeholder 표시: ${onePlaceholder?.[0]}`);
      assert(one.sh <= one.ch + 2 && one.sw <= one.cw + 2, `1P 넘침 ${one.sw}x${one.sh}/${one.cw}x${one.ch}`);
      const errors = takeErrors(); assert(!errors.length, `페이지 오류: ${errors.join(' | ')}`);
      return `항목 ${one.facts.length}개`;
    });

    // 4b. Owner decision 2026-10-30: blank fields are confirmed with the user before publishing, then hidden.
    await check(tag, '1P 발행 전 공란 확인 안내', async () => {
      const notice = page.getByTestId('report-blank-fields-notice');
      if (!(await notice.count())) return '공란 없음 — 확인 없이 발행';
      assert((await notice.innerText()).includes('숨김 처리되어 발행'), '숨김 발행 안내가 없습니다.');
      await page.getByRole('button', { name: '인쇄 / PDF 저장' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor({ state: 'visible', timeout: 10_000 });
      const dialogText = await dialog.innerText();
      assert(dialogText.includes('값 입력하러 가기') && dialogText.includes('숨김 처리하고'), `대화상자 선택지 누락: ${dialogText.slice(0, 120)}`);
      const chips = await dialog.getByTestId('report-blank-fields-list').locator('.MuiChip-root').count();
      assert(chips > 0, '공란 항목 목록이 비어 있습니다.');
      await shot(`${tag}-1p-blank-dialog`);
      await dialog.getByRole('button', { name: '취소' }).click();
      await dialog.waitFor({ state: 'hidden', timeout: 10_000 });
      return `공란 ${chips}개 확인 요청`;
    });

    // 5. 7P professional MASTER (owner standard: Opening → detail-1..7 → Closing, no overflow).
    await check(tag, '7P 상세보고서 MASTER 구조(Opening→7P→Closing)', async () => {
      await page.goto(`${BASE_URL}/document/report/${encodeURIComponent(propertyId)}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.daon-professional-report-master', { timeout: 45_000 });
      const report = await page.evaluate(() => {
        const master = document.querySelector('.daon-professional-report-master');
        const pages = [...master.querySelectorAll('.daon-frame-page, .daon-detail-page')].map((el) => ({
          name: el.getAttribute('data-master-page') || [...el.classList].find((n) => /^daon-detail-page-[1-7]$/.test(n))?.replace('daon-detail-page-', 'detail-') || '',
          sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight, text: el.textContent || '',
        }));
        return { templateId: master.getAttribute('data-template-id'), visual: master.getAttribute('data-visual-master'), pages, url: location.pathname };
      });
      await shot(`${tag}-7p`);
      const names = report.pages.map((item) => item.name);
      assert(report.templateId === 'DAON_DETAIL_7P_MASTER', `템플릿 ${report.templateId}`);
      assert(names.length === 9 && names[0] === 'opening' && names.at(-1) === 'closing' && [1, 2, 3, 4, 5, 6, 7].every((n) => names[n] === `detail-${n}`), `페이지 구성 ${names.join(',')}`);
      const overflow = report.pages.filter((item) => item.sh > item.ch + 2 || item.sw > item.cw + 2).map((item) => item.name);
      assert(!overflow.length, `넘침 페이지: ${overflow.join(',')}`);
      // Owner decision 2026-10-30 ("빈칸 숨김"): placeholders are a hard failure, no longer a policy WARN.
      const placeholders = report.pages
        .map((item) => ({ name: item.name, hit: item.text.match(/.{0,30}(확인 필요|검토 필요|분석 필요|미등록).{0,20}/)?.[0] }))
        .filter((item) => item.hit);
      const errors = takeErrors(); assert(!errors.length, `페이지 오류: ${errors.join(' | ')}`);
      assert(!placeholders.length, `공란 placeholder 표시: ${placeholders.map((item) => `${item.name}「${item.hit}」`).join(' / ')}`);
      const notice = page.getByTestId('report-blank-fields-notice');
      let blankInfo = '공란 없음';
      if (await notice.count()) {
        assert((await notice.innerText()).includes('숨김 처리되어 발행'), '7P 숨김 발행 안내가 없습니다.');
        await page.getByRole('button', { name: '인쇄 / PDF 저장' }).click();
        const dialog = page.getByRole('dialog');
        await dialog.waitFor({ state: 'visible', timeout: 10_000 });
        assert((await dialog.innerText()).includes('값 입력하러 가기'), '7P 발행 전 공란 확인 대화상자가 없습니다.');
        await dialog.getByRole('button', { name: '취소' }).click();
        await dialog.waitFor({ state: 'hidden', timeout: 10_000 });
        blankInfo = '발행 전 공란 확인 동작';
      }
      return `9페이지, 넘침 0, placeholder 0, ${blankInfo}, visual=${report.visual}`;
    });


    // 5b. Owner/루인 gate (Issue #12): the published artifacts themselves — print to PDF the way a user saves them, check
    //     the page count (1P = 1 page, professional report = Opening + 7 + Closing = 9 pages), and reopen the same
    //     Snapshot URL to confirm it renders the same stored version. First listing only (runtime).
    if (listing === LISTINGS[0]) {
      await check(tag, 'PDF 출력(1P=1쪽, 리포트=9쪽) · Snapshot 재열람', async () => {
        await page.goto(`${BASE_URL}/document/proposal/${encodeURIComponent(propertyId)}`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.d1-sheet', { timeout: 30_000 });
        await page.emulateMedia({ media: 'print' });
        const onePdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
        await page.emulateMedia({ media: 'screen' });
        await writeFile(`${OUT}/e2e-${tag}-1p.pdf`, onePdf);
        const one = pdfPageCount(onePdf);
        assert(one.pages === 1, `1P PDF 페이지 수 ${one.pages} (트리 ${one.treeCount}) — 기대 1`);

        await page.goto(`${BASE_URL}/document/report/${encodeURIComponent(propertyId)}`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.daon-professional-report-master', { timeout: 45_000 });
        await page.waitForURL(/\/professional-report\/snapshot\//, { timeout: 30_000 });
        const snapshotUrl = page.url();
        const fingerprint = () => page.evaluate(() => {
          const master = document.querySelector('.daon-professional-report-master');
          const text = master?.textContent || '';
          let hash = 0; for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
          return { pages: master ? master.querySelectorAll('.daon-frame-page, .daon-detail-page').length : 0, hash, length: text.length };
        });
        const before = await fingerprint();
        await page.emulateMedia({ media: 'print' });
        const reportPdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
        await page.emulateMedia({ media: 'screen' });
        await writeFile(`${OUT}/e2e-${tag}-report.pdf`, reportPdf);
        const report = pdfPageCount(reportPdf);
        assert(report.pages === 9, `리포트 PDF 페이지 수 ${report.pages} (트리 ${report.treeCount}, 화면 ${before.pages}쪽) — 기대 9`);

        // Reopen: leave, come back to the same Snapshot URL; stored content must render identically.
        await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
        await page.goto(snapshotUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.daon-professional-report-master', { timeout: 45_000 });
        const after = await fingerprint();
        assert(after.pages === before.pages && after.hash === before.hash, `Snapshot 재열람 내용 불일치 (${before.pages}/${before.hash} → ${after.pages}/${after.hash})`);
        const errors = takeErrors(); assert(!errors.length, `페이지 오류: ${errors.join(' | ')}`);
        return `1P ${one.pages}쪽 ${Math.round(onePdf.length / 1024)}KB · 리포트 ${report.pages}쪽 ${Math.round(reportPdf.length / 1024)}KB · 재열람 동일`;
      });
    }

    // 6. Location briefing renders this property.
    await check(tag, '입지 브리핑', async () => {
      await page.goto(`${BASE_URL}/properties/${encodeURIComponent(propertyId)}/briefing`, { waitUntil: 'domcontentloaded' });
      await page.locator('.briefing-preview').waitFor({ state: 'visible', timeout: 20_000 });
      await shot(`${tag}-briefing`);
      const errors = takeErrors(); assert(!errors.length, `페이지 오류: ${errors.join(' | ')}`);
    });

    // 7. 3D / interior / spatial workspaces open with this property's context.
    for (const [route, heading] of [['interior', 'Interior Workspace'], ['room-ops', 'Room Twin Operations'], ['digital-twin-intake', '도면 · 3D · 측정자료 등록'], ['digital-twin', 'Digital Twin Workspace'], ['spatial', 'Spatial Workspace']]) {
      await check(tag, `${heading} 화면`, async () => {
        await page.goto(`${BASE_URL}/${route}?propertyId=${encodeURIComponent(propertyId)}`, { waitUntil: 'domcontentloaded' });
        await visibleText(heading, 25_000);
        await page.waitForTimeout(800);
        const errors = takeErrors(); assert(!errors.length, `페이지 오류: ${errors.join(' | ')}`);
      });
    }
  }

  // 8. Floor plan (DXF) intake → Digital Twin handoff for the first test listing.
  if (registered[0]) {
    const first = registered[0];
    await check(first.key, '도면(DXF) 등록 → Digital Twin 연결', async () => {
      await page.goto(`${BASE_URL}/digital-twin-intake?propertyId=${encodeURIComponent(first.propertyId)}`, { waitUntil: 'domcontentloaded' });
      await visibleText('도면 · 3D · 측정자료 등록', 25_000);
      const dxf = '0\nSECTION\n2\nENTITIES\n0\nLINE\n8\nWALL\n10\n0\n20\n0\n11\n6\n21\n0\n0\nLINE\n8\nWALL\n10\n6\n20\n0\n11\n6\n21\n4\n0\nENDSEC\n0\nEOF\n';
      await page.locator('input[type="file"]').first().setInputFiles({ name: 'e2e-test-floor.dxf', mimeType: 'application/dxf', buffer: Buffer.from(dxf, 'utf8') });
      await visibleText('e2e-test-floor.dxf 등록 완료', 25_000);
      await shot(`${first.key}-dxf-intake`);
      // Intake → Digital Twin Workspace must keep the same property (it used to open the first property in the list).
      await page.getByRole('button', { name: 'Digital Twin Workspace' }).first().click();
      await page.waitForURL(/\/digital-twin\?propertyId=/, { timeout: 20_000 });
      await visibleText('Digital Twin Workspace', 25_000);
      await visibleText('e2e-test-floor.dxf', 25_000);
      const selectedText = await page.locator('body').innerText();
      assert(selectedText.includes(first.name), 'Digital Twin Workspace가 업로드한 물건이 아닌 다른 물건을 표시합니다.');
      await shot(`${first.key}-dxf-workspace`);
      const errors = takeErrors(); assert(!errors.length, `페이지 오류: ${errors.join(' | ')}`);
      return '같은 물건의 Digital Twin Workspace에 도면 자산 표시';
    });
  }


  // 8b. Real photo / floor-plan files through the interior and spatial analysis path (second test listing).
  //     Spatial Workspace upload → Interior Vision / Floor Plan agent → Interior Workspace counts; Data Room exterior photo →
  //     property hub and 1P hero. An interior photo must never become the report hero.
  if (registered[1]) {
    const target = registered[1];
    const pid = encodeURIComponent(target.propertyId);
    const pickCategory = async (label) => {
      await page.getByLabel('자료 유형').click();
      await page.getByRole('option', { name: label, exact: true }).click();
    };
    await check(target.key, '실내 사진 → Interior Vision 분석', async () => {
      await page.goto(`${BASE_URL}/spatial?propertyId=${pid}`, { waitUntil: 'domcontentloaded' });
      await visibleText('Spatial Workspace', 25_000);
      await pickCategory('인테리어');
      await page.locator('input[type="file"]').first().setInputFiles({ name: 'e2e-interior-room.png', mimeType: 'image/png', buffer: IMAGES.interior });
      await visibleText('e2e-interior-room', 30_000);
      await page.getByText(/공간 자료 \d+건을 등록했습니다/).first().waitFor({ state: 'visible', timeout: 30_000 });
      const errors = takeErrors(); assert(!errors.length, `페이지 오류: ${errors.join(' | ')}`);
      await page.goto(`${BASE_URL}/interior?propertyId=${pid}`, { waitUntil: 'domcontentloaded' });
      await visibleText('Interior Workspace', 25_000);
      const counts = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-testid="interior-kpi"]')].map((el) => [el.getAttribute('data-label'), Number(el.getAttribute('data-value'))])));
      await shot(`${target.key}-interior-vision`);
      assert(counts['실내 사진'] === 1, `실내 사진 수 ${counts['실내 사진']} (기대 1)`);
      assert((counts['Vision 결과'] ?? 0) >= 1 || (counts['검토 대기'] ?? 0) >= 1, `Vision 결과/검토 대기 없음: ${JSON.stringify(counts)}`);
      const body = await page.locator('body').innerText();
      assert(body.includes(target.name), 'Interior Workspace가 다른 물건을 표시합니다.');
      return `Vision 결과 ${counts['Vision 결과']} · 검토 대기 ${counts['검토 대기']}`;
    });
    await check(target.key, '도면 이미지 → Floor Plan 자산', async () => {
      await page.goto(`${BASE_URL}/spatial?propertyId=${pid}`, { waitUntil: 'domcontentloaded' });
      await visibleText('Spatial Workspace', 25_000);
      await pickCategory('도면/CAD');
      await page.getByLabel('층(선택)').fill('1F');
      await page.locator('input[type="file"]').first().setInputFiles({ name: 'e2e-floor-plan-1f.png', mimeType: 'image/png', buffer: IMAGES.plan });
      await page.getByText(/공간 자료 \d+건을 등록했습니다/).first().waitFor({ state: 'visible', timeout: 30_000 });
      await visibleText('e2e-floor-plan-1f.png', 30_000);
      await shot(`${target.key}-floor-plan`);
      const errors = takeErrors(); assert(!errors.length, `페이지 오류: ${errors.join(' | ')}`);
      return '도면 원본 등록 · Digital Twin 준비 자산 표시';
    });
    await check(target.key, '외관 사진 → 상세 허브·1P 대표사진 (실내 사진 제외)', async () => {
      await page.goto(`${BASE_URL}/property/${pid}/data-room?tab=media`, { waitUntil: 'domcontentloaded' });
      await visibleText('보고서 미디어 연결', 25_000);
      await page.getByLabel('캡션').fill('E2E 정면 외관');
      await page.locator('input[type="file"][accept^="image/jpeg"]').first().setInputFiles({ name: 'e2e-exterior.png', mimeType: 'image/png', buffer: IMAGES.exterior });
      await visibleText('외관 미디어를 Data Room에 연결했습니다', 25_000);
      await page.getByRole('button', { name: '대표 지정', exact: true }).first().click();
      await visibleText('보고서 대표 외관 미디어로 지정했습니다', 25_000);
      await page.goto(`${BASE_URL}/property/${pid}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800);
      const heroAlt = await page.locator('img').evaluateAll((imgs) => imgs.map((img) => img.getAttribute('alt') || ''));
      await page.goto(`${BASE_URL}/document/proposal/${pid}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.d1-sheet', { timeout: 30_000 });
      const hero = await page.evaluate(() => { const img = document.querySelector('.d1-hero > img'); return img ? { src: img.getAttribute('src') || '', w: img.naturalWidth } : null; });
      await shot(`${target.key}-1p-with-photo`);
      assert(hero && hero.src.startsWith('data:image') && hero.w === 480, `1P 대표사진이 등록한 외관 사진이 아닙니다: ${JSON.stringify(hero && { w: hero.w, src: hero.src.slice(0, 30) })}`);
      // Regression: exterior photos must not be counted as interior photos.
      await page.goto(`${BASE_URL}/interior?propertyId=${pid}`, { waitUntil: 'domcontentloaded' });
      await visibleText('Interior Workspace', 25_000);
      const interiorCount = await page.locator('[data-testid="interior-kpi"][data-label="실내 사진"]').getAttribute('data-value');
      assert(interiorCount === '1', `외관 사진 등록 후 실내 사진 수 ${interiorCount} (기대 1)`);
      const errors = takeErrors(); assert(!errors.length, `페이지 오류: ${errors.join(' | ')}`);
      return `허브 이미지 ${heroAlt.length}개 · 1P 대표사진=외관(480px) · 실내 사진 수 유지`;
    });
  }

  // 9. Home: test registrations appear in the list and KPIs count them.
  await check('전체', '홈 목록·KPI 반영', async () => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    for (const item of registered) await visibleText(item.name, 20_000);
    await shot('home-after-registration');
    return `${registered.length}건 목록 표시`;
  });

  // 10. Mobile/tablet widths (390 / 768): operational screens must not scroll horizontally and must render without errors.
  // Same page (IndexedDB test data stays in this browser context); the viewport is restored afterwards.
  if (registered[0]) {
    const id = encodeURIComponent(registered[0].propertyId);
    const routes = [
      ['홈', '/'],
      ['물건 상세', `/property/${id}`],
      ['Data Room', `/property/${id}/data-room`],
      ['물건 수정', `/property/${id}/edit`],
      ['입지 브리핑', `/properties/${id}/briefing`],
      ['준비도 센터', '/readiness'],
      ['임대 수익', `/income?propertyId=${id}`],
      ['Interior Workspace', `/interior?propertyId=${id}`],
      ['Spatial Workspace', `/spatial?propertyId=${id}`],
    ];
    for (const width of [390, 768]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1024 });
      for (const [label, route] of routes) {
        await check(`모바일${width}`, `${label} 가로 넘침 없음`, async () => {
          await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
          await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
          await page.waitForTimeout(600);
          const layout = await page.evaluate(() => {
            const vw = document.documentElement.clientWidth;
            const scroll = document.documentElement.scrollWidth;
            // Widest offenders, for a diagnosis instead of a bare number (elements inside an own horizontal scroller are allowed).
            const scrollsX = (el) => { for (let n = el.parentElement; n; n = n.parentElement) { const o = getComputedStyle(n).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return true; } return false; };
            const offenders = [...document.body.querySelectorAll('*')]
              .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > vw + 1 && !scrollsX(el); })
              .slice(0, 4)
              .map((el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}(${Math.round(el.getBoundingClientRect().right)}px)`);
            const errorAlertTexts = [...document.querySelectorAll('.MuiAlert-standardError, .MuiAlert-filledError')].map((el) => (el.textContent || '').trim().slice(0, 140));
            return { vw, scroll, offenders, errorAlerts: errorAlertTexts.length, errorAlertTexts };
          });
          await shot(`mobile${width}-${route.split('?')[0].replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home'}`);
          const errors = takeErrors();
          assert(!errors.length, `페이지 오류: ${errors.join(' | ')}`);
          assert(layout.errorAlerts === 0, `오류 배너 ${layout.errorAlerts}건: ${layout.errorAlertTexts.join(' / ')}`);
          assert(layout.scroll <= layout.vw + 1, `가로 넘침 ${layout.scroll}px > ${layout.vw}px: ${layout.offenders.join(', ')}`);
          return `${layout.vw}px`;
        });
      }
    }
    await page.setViewportSize({ width: 1440, height: 1100 });
  }

  // 11. Issue #37: address lookup result on phones (320/375/390/430). The QA server has no API proxy, so the discovery
  //     response is a fixture shaped like a real Production answer (방배동 765-32 lot, two register titles, share deals);
  //     the type and market summary come from the real server functions, not hand-written values.
  {
    const titles = [
      { buildingName: ' ', lotAddress: '서울특별시 서초구 방배동 765-32번지', roadAddress: '서울특별시 서초구 동광로1길 49 (방배동)', landAreaSqm: 0, landAreaPyeong: 0, buildingAreaSqm: 85.03, totalFloorAreaSqm: 160.87, buildingCoverageRate: 0, floorAreaRatio: 0, structure: '벽돌구조', mainUse: '제1종근린생활시설', detailUse: '소매점', registerKind: '일반', dongName: '', groundFloors: 2, basementFloors: 1, completionDate: '1976-12-10', rawPk: 'A', unrecordedFields: ['landAreaSqm', 'buildingCoverageRate', 'floorAreaRatio'] },
      { buildingName: ' ', lotAddress: '서울특별시 서초구 방배동 765-32번지', roadAddress: '', landAreaSqm: 0, totalFloorAreaSqm: 21.5, buildingAreaSqm: 21.5, structure: '블록구조', mainUse: '창고시설', detailUse: '창고', registerKind: '일반', dongName: '부속동', groundFloors: 1, basementFloors: 0, completionDate: '', rawPk: 'B', unrecordedFields: ['landAreaSqm'] },
    ];
    const landProfile = { pnu: '1165010100107650032', standardYear: '2026', officialLandPricePerSqm: 9193000, estimatedOfficialLandValue: 1344016600, landAreaSqm: 146.2, landCategory: '대', landUseSituation: '상업용', terrainHeight: '평지', terrainShape: '세로장방', roadSide: '세로한면(가)', primaryUseZone: '제3종일반주거지역', useZones: ['제3종일반주거지역'] };
    const resolved = { bun: '0765', ji: '0032', region3: '방배동' };
    const share = (n) => ({ dealAmount: '2,600', dealArea: '3.3', shareDealingType: '지분', dealYear: '2026', dealMonth: '10', dealDay: '15', umdNm: '방배동', jibun: '7**', _n: n });
    const landRows = Array.from({ length: 6 }, (_, i) => normalizeTrade(share(i), 'land', resolved));
    const commercialRows = [
      normalizeTrade({ dealAmount: '529,400', buildingAr: '320.5', plottageAr: '230.1', buildingType: '일반', dealYear: '2026', dealMonth: '9', dealDay: '3', umdNm: '방배동', jibun: '8**', buildingUse: '제2종근린생활' }, 'commercial', resolved),
      normalizeTrade({ dealAmount: '12,365', buildingAr: '10.58', buildingType: '집합', dealYear: '2026', dealMonth: '10', dealDay: '21', umdNm: '방배동', jibun: '9**', buildingUse: '제2종근린생활' }, 'commercial', resolved),
    ];
    const fixture = {
      status: 'ok', publicDataConfigured: true, vworldConfigured: true,
      address: { query: '서울 서초구 동광로1길 49', officialAddress: '서울특별시 서초구 방배동 765-32', roadAddress: '서울특별시 서초구 동광로1길 49', lotAddress: '서울 서초구 방배동 765-32', latitude: 37.4874, longitude: 126.9937, region1: '서울', region2: '서초구', region3: '방배동', bCode: '1165010100', sigunguCd: '11650', bjdongCd: '10100', mountainYn: 'N', bun: '0765', ji: '0032' },
      building: titles[0], buildingCandidates: titles, floors: [], landUseZones: [{ type: '용도지역', code: 'UQA123', name: '제3종일반주거지역', representativeYn: 'Y' }],
      propertyType: classifyPropertyType({ titles, landProfile }), landProfile,
      market: { commercial: commercialRows, land: landRows, summary: summarizeMarket([...commercialRows, ...landRows]), exactLot: [] },
      usageEvidence: { state: 'no_public_record', interpretation: '공개 사용량 자료 없음', positiveMonths: 0, monthly: [] },
      operatingBusinessEvidence: { state: 'no_public_record', interpretation: '공개 상가업소 기록 없음', sameAddress: [], nearby: [] },
      kakaoPoiEvidence: { state: 'not_configured', interpretation: '', sameAddress: [], nearby: [] },
      providerStatus: { buildingTitle: { ok: true }, landTrades: { ok: true }, commercialTrades: { ok: true }, vworldLandProfile: { ok: true } },
    };
    await page.route('**/api/property-discovery**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture) }));
    for (const width of [320, 375, 390, 430]) {
      await check(`조회${width}`, '지번 조회 결과 — 유형·요약·탭·건물 선택(Issue #37)', async () => {
        await page.setViewportSize({ width, height: 860 });
        await page.goto(`${BASE_URL}/property/new`, { waitUntil: 'domcontentloaded' });
        await page.getByLabel('건물 조회 주소').fill('서울 서초구 동광로1길 49');
        await page.getByRole('button', { name: '건물 조회' }).click();
        const summary = page.getByTestId('discovery-summary');
        await summary.waitFor({ state: 'visible', timeout: 15_000 });
        const text = await summary.innerText();
        assert(text.includes(`유형: ${fixture.propertyType.label}`), `유형 표시 누락: ${text.slice(0, 80)}`);
        assert(text.includes('시세') && text.includes('아닙니다'), '공시지가 기준 토지가액이 시세가 아니라는 안내가 없습니다.');
        assert(text.includes('미기재'), '건축물대장 0값이 미기재로 안내되지 않습니다.');
        const choices = await page.getByTestId('discovery-building-choice').getByRole('button').count();
        assert(choices === 2, `대상 건물 선택지 ${choices}개 (기대 2)`);
        await page.getByRole('tab', { name: /실거래/ }).click();
        const marketText = await page.locator('section').filter({ hasText: '최근 실거래 후보' }).first().innerText();
        assert(/동일 거래 6건/.test(marketText), '동일 지분 거래 6행이 1건(동일 거래 6건)으로 묶이지 않았습니다.');
        assert(/비교 제외/.test(marketText), '지분·집합 거래의 비교 제외 표시가 없습니다.');
        await page.getByRole('tab', { name: '공적자료' }).click();
        await page.getByText('미기재').first().waitFor({ state: 'visible', timeout: 5_000 });
        const layout = await page.evaluate(() => ({ vw: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
        await shot(`discovery-${width}`);
        const errors = takeErrors(); assert(!errors.length, `페이지 오류: ${errors.join(' | ')}`);
        assert(layout.scroll <= layout.vw + 1, `가로 넘침 ${layout.scroll}px > ${layout.vw}px`);
        return `${width}px · 유형 ${fixture.propertyType.label}`;
      });
    }
    await page.unroute('**/api/property-discovery**');
    await page.setViewportSize({ width: 1440, height: 1100 });
  }

  // 12. Issue #37 phase 2: apartment complex comparison on phones. Rows are normalised by the real server functions from
  //     response-shaped samples (AptRent sample fields verified 2025-01); the rent API answered only 4 of 6 months, which
  //     the UI must show instead of presenting the counts as complete.
  {
    const resolved = { bun: '0237', ji: '0000', region3: '명륜2가', sigunguCd: '11110' };
    const target = { complexName: '명륜동주상복합아남아파트' };
    const meta = (dealKind) => ({ propertyType: 'apartment', dealKind, apiId: dealKind === 'sale' ? 'aptTrade' : 'aptRent' });
    const raw = (extra) => ({ aptNm: '명륜동주상복합아남아파트', jibun: '237', umdNm: '명륜2가', dealYear: '2026', buildYear: '1999', ...extra });
    const rows = [
      normalizeResidentialDeal(raw({ dealAmount: '87,000', dealMonth: '9', dealDay: '5', excluUseAr: '50.49', floor: '7' }), meta('sale'), resolved, target),
      normalizeResidentialDeal(raw({ dealAmount: '91,000', dealMonth: '10', dealDay: '2', excluUseAr: '50.12', floor: '11' }), meta('sale'), resolved, target),
      normalizeResidentialDeal(raw({ dealAmount: '12,000', dealMonth: '10', dealDay: '3', excluUseAr: '50.49', floor: '3', cdealType: 'O' }), meta('sale'), resolved, target),
      normalizeResidentialDeal(raw({ deposit: '43,500', monthlyRent: '0', dealMonth: '8', dealDay: '20', excluUseAr: '50.49', floor: '2' }), meta('rent'), resolved, target),
      normalizeResidentialDeal(raw({ deposit: '5,000', monthlyRent: '120', dealMonth: '9', dealDay: '11', excluUseAr: '50.49', floor: '5' }), meta('rent'), resolved, target),
      normalizeResidentialDeal(raw({ dealAmount: '135,000', dealMonth: '9', dealDay: '28', excluUseAr: '84.97', floor: '15' }), meta('sale'), resolved, target),
    ];
    const titles = [{ buildingName: '명륜동주상복합아남아파트', lotAddress: '서울특별시 종로구 명륜2가 237', roadAddress: '', totalFloorAreaSqm: 30210, structure: '철근콘크리트구조', mainUse: '공동주택', detailUse: '아파트', registerKind: '집합', householdCount: 180, groundFloors: 15, basementFloors: 2, completionDate: '1999-06-30', rawPk: 'APT' }];
    const residential = {
      propertyType: 'apartment', target: { complexName: target.complexName, lot: '237' },
      apiStatus: { aptTrade: { status: 'ok', label: '국토교통부 아파트 매매 실거래가', detail: '', okMonths: 6, totalMonths: 6 }, aptRent: { status: 'partial', label: '국토교통부 아파트 전월세 실거래가', detail: 'HTTP 500', okMonths: 4, totalMonths: 6 } },
      summary: residentialSummary(rows), complexDeals: rows, neighbourhoodDeals: [], months: ['202610', '202609', '202608', '202607', '202606', '202605'],
      interpretation: '모든 거래는 후보입니다. 동일 지번·단지명 일치도 호실 거래로 확정하지 않습니다. 전세가율은 같은 면적대 중앙값으로 계산한 값입니다.',
    };
    const aptFixture = {
      status: 'ok', publicDataConfigured: true, vworldConfigured: true,
      address: { query: '서울 종로구 명륜2가 237', officialAddress: '서울특별시 종로구 명륜2가 237', roadAddress: '', lotAddress: '서울 종로구 명륜2가 237', latitude: 37.5873, longitude: 126.9973, region1: '서울', region2: '종로구', region3: '명륜2가', bCode: '1111017400', sigunguCd: '11110', bjdongCd: '17400', mountainYn: 'N', bun: '0237', ji: '0000' },
      building: titles[0], buildingCandidates: titles, floors: [], landUseZones: [], landProfile: null,
      propertyType: classifyPropertyType({ titles }), residential,
      market: { commercial: [], land: [], summary: summarizeMarket([]), exactLot: [] },
      usageEvidence: { state: 'no_public_record', interpretation: '', positiveMonths: 0, monthly: [] },
      operatingBusinessEvidence: { state: 'no_public_record', interpretation: '', sameAddress: [], nearby: [] },
      kakaoPoiEvidence: { state: 'not_configured', interpretation: '', sameAddress: [], nearby: [] },
      providerStatus: { buildingTitle: { ok: true } }, collectedAt: '2026-10-31T00:00:00Z',
    };
    assert(aptFixture.propertyType.type === 'apartment', `아파트 유형 판정 실패: ${aptFixture.propertyType.type}`);
    await page.route('**/api/property-discovery**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(aptFixture) }));
    for (const width of [320, 375, 390, 430]) {
      await check(`단지${width}`, '아파트 단지 비교 — 면적대·매매/전세/월세·미승인 표시(Issue #37 2단계)', async () => {
        await page.setViewportSize({ width, height: 860 });
        await page.goto(`${BASE_URL}/property/new`, { waitUntil: 'domcontentloaded' });
        await page.getByLabel('건물 조회 주소').fill('서울 종로구 명륜2가 237');
        await page.getByRole('button', { name: '건물 조회' }).click();
        await page.getByTestId('discovery-summary').waitFor({ state: 'visible', timeout: 15_000 });
        await page.getByRole('tab', { name: '단지 비교' }).click();
        const panel = page.getByTestId('residential-complex');
        await panel.waitFor({ state: 'visible', timeout: 5_000 });
        const panelText = await panel.innerText();
        assert(panelText.includes('일부 조회(4/6개월)'), '일부 월만 조회된 API 상태가 표시되지 않습니다.');
        assert(await page.getByTestId('residential-unapproved').count() === 0, '미승인 API가 없는데 미승인 안내가 표시됩니다.');
        const bands = await page.getByTestId('residential-area-bands').getByRole('button').count();
        assert(bands === 2, `면적대 ${bands}개 (기대 2: 50㎡대·84㎡대)`);
        const stats = await page.getByTestId('residential-band-stats').innerText();
        assert(stats.includes('8.9억원'), `50㎡대 매매 중앙값(8.7억·9.1억 → 8.9억, 해제 제외) 오류: ${stats.slice(0, 120)}`);
        assert(stats.includes('해제 1건 제외'), '해제 거래 제외 표시 누락');
        assert(stats.includes('전세가율') && stats.includes('계산값'), '전세가율 계산값 표시 누락');
        await page.getByRole('button', { name: '월세' }).click();
        const deals = await page.getByTestId('residential-deals').innerText();
        assert(deals.includes('월 120만원') && !deals.includes('매매 ·'), `월세 필터 오류: ${deals.slice(0, 120)}`);
        const layout = await page.evaluate(() => ({ vw: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
        await shot(`complex-${width}`);
        const errors = takeErrors(); assert(!errors.length, `페이지 오류: ${errors.join(' | ')}`);
        assert(layout.scroll <= layout.vw + 1, `가로 넘침 ${layout.scroll}px > ${layout.vw}px`);
        return `${width}px · 면적대 ${bands}개`;
      });
    }
    await page.unroute('**/api/property-discovery**');
    await page.setViewportSize({ width: 1440, height: 1100 });
  }
} catch (error) {
  record('전체', '실행 중단', 'FAIL', error instanceof Error ? error.message.split('\n')[0] : String(error));
} finally {
  await browser.close();
}

const summary = {
  baseUrl: BASE_URL,
  listings: LISTINGS.map(({ key, source, name }) => ({ key, source, name })),
  pass: results.filter((r) => r.status === 'PASS').length,
  warn: results.filter((r) => r.status === 'WARN').length,
  fail: results.filter((r) => r.status === 'FAIL').length,
  results,
};
await writeFile(`${OUT}/e2e-online-listings.json`, JSON.stringify(summary, null, 2));
const compact = results.map((r) => `${r.status === 'PASS' ? 'P' : r.status === 'WARN' ? 'W' : 'F'}:${r.listing}:${r.step}${r.status === 'PASS' ? '' : `(${r.detail.slice(0, 120)})`}`).join(' ; ');
console.log(`::notice title=E2E summary::${esc(`PASS ${summary.pass} / WARN ${summary.warn} / FAIL ${summary.fail} || ${compact}`.slice(0, 7000))}`);
console.log(`E2E online listings: PASS ${summary.pass} / WARN ${summary.warn} / FAIL ${summary.fail}`);
if (summary.fail) process.exitCode = 1;
