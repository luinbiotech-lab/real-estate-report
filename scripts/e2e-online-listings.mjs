// End-to-end operational test with real public listings as TEST registrations (owner request 2026-10-30).
// Runs against the local-mode QA server (IndexedDB in the CI browser) — never the Production backend.
// Flow per listing: register via the form → property hub → Data Room tabs → 1P MASTER → 7P MASTER (Opening + detail 1..7 +
// Closing) → location briefing → 3D/interior workspaces. DXF upload → Digital Twin handoff for the first listing.
// Every check is reported as a GitHub annotation (::notice PASS / ::error FAIL) and in artifacts/agent-qa/e2e-online-listings.json.
import { mkdir, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { chromium } from 'playwright';

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
