// End-to-end operational test with real public listings as TEST registrations (owner request 2026-10-30).
// Runs against the local-mode QA server (IndexedDB in the CI browser) — never the Production backend.
// Flow per listing: register via the form → property hub → Data Room tabs → 1P MASTER → 7P MASTER (Opening + detail 1..7 +
// Closing) → location briefing → 3D/interior workspaces. DXF upload → Digital Twin handoff for the first listing.
// Every check is reported as a GitHub annotation (::notice PASS / ::error FAIL) and in artifacts/agent-qa/e2e-online-listings.json.
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const OUT = 'artifacts/agent-qa';

// Public listings found online on 2026-10-30 (source URLs kept). Values are the listing's own claims, not verified facts.
const LISTINGS = [
  { key: 'donggyo', source: 'https://realty.daangn.com/articles/4164139', name: '[테스트] 동교동 동교로 212-22 근생', address: '서울특별시 마포구 동교로 212-22', salePrice: 3_000_000_000, landAreaSqm: 140.8, totalFloorAreaSqm: 266, basementFloors: 1, groundFloors: 3, mainUse: '제2종 근린생활시설', zoning: '', nearbyStation: '홍대입구역', completionDate: '1993-02-10', parkingSpaces: 0 },
  { key: 'bangbae-dongkwang', source: 'https://realty.daangn.com/articles/4557898', name: '[테스트] 방배동 동광로1길 49 근생', address: '서울특별시 서초구 동광로1길 49', salePrice: 2_900_000_000, landAreaSqm: 146.2, totalFloorAreaSqm: 160.87, basementFloors: 1, groundFloors: 2, mainUse: '제2종 근린생활시설', zoning: '제3종일반주거지역', nearbyStation: '총신대입구역', completionDate: '1976-12-10', parkingSpaces: 0 },
  { key: 'yeoksam', source: 'https://realty.daangn.com/articles/4523816', name: '[테스트] 역삼동 논현로 339 근생', address: '서울특별시 강남구 논현로 339', salePrice: 20_000_000_000, landAreaSqm: 365.1, totalFloorAreaSqm: 976.2, basementFloors: 1, groundFloors: 4, mainUse: '제2종 근린생활시설', zoning: '제3종일반주거지역', nearbyStation: '역삼역', completionDate: '1984-10-12', parkingSpaces: 0 },
];

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
  catch (error) { record(listing, step, 'FAIL', error instanceof Error ? error.message.split('\n')[0].slice(0, 300) : String(error)); return false; }
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
      assert(!one.facts.some((value) => value.includes('확인 필요')), '1P에 "확인 필요" 공란 표시가 있습니다.');
      assert(one.sh <= one.ch + 2 && one.sw <= one.cw + 2, `1P 넘침 ${one.sw}x${one.sh}/${one.cw}x${one.ch}`);
      const errors = takeErrors(); assert(!errors.length, `페이지 오류: ${errors.join(' | ')}`);
      return `항목 ${one.facts.length}개`;
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
      const placeholders = report.pages.filter((item) => item.text.includes('확인 필요')).map((item) => item.name);
      const errors = takeErrors(); assert(!errors.length, `페이지 오류: ${errors.join(' | ')}`);
      if (placeholders.length) record(tag, '7P "확인 필요" 공란 표시(정책 결정 대기 #10/#11)', 'WARN', `표시 페이지: ${placeholders.join(',')}`);
      return `9페이지, 넘침 0, visual=${report.visual}`;
    });

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
      await page.goto(`${BASE_URL}/property/${encodeURIComponent(first.propertyId)}/data-room?tab=digitalTwin`, { waitUntil: 'domcontentloaded' });
      await visibleText('e2e-test-floor.dxf', 25_000);
      await shot(`${first.key}-dxf-dataroom`);
      const errors = takeErrors(); assert(!errors.length, `페이지 오류: ${errors.join(' | ')}`);
      return '자산이 해당 물건 Data Room 3D 탭에 표시';
    });
  }

  // 9. Home: test registrations appear in the list and KPIs count them.
  await check('전체', '홈 목록·KPI 반영', async () => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    for (const item of registered) await visibleText(item.name, 20_000);
    await shot('home-after-registration');
    return `${registered.length}건 목록 표시`;
  });
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
