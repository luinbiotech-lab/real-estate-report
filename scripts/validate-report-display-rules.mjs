// Unit tests for the DA:ON 1P/7P display rules (루인 request on PR #46, 2026-11-05):
//  - short display labels win, otherwise the stored first line is printed verbatim (no rewriting/truncation);
//  - register coverage 0 is "unrecorded"; a calculated coverage is shown only with both areas and is always labelled.
import { readFileSync } from 'node:fs';

import { importTs } from './lib/ts-module-loader.mjs';

const fail = (message) => { throw new Error(message); };
const eq = (actual, expected, message) => { if (actual !== expected) fail(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); };
const rules = await importTs('src/domain/professionalReport/reportDisplayRules.ts');
const { shortOrFirstLine, coverageDisplay } = rules;

// 1. shortOrFirstLine
eq(shortOrFirstLine('국회 앞 업무용 빌딩', '첫 줄\n둘째 줄'), '국회 앞 업무용 빌딩', 'short label wins');
eq(shortOrFirstLine('  짧은 문구  ', '원문'), '짧은 문구', 'short label is trimmed');
eq(shortOrFirstLine('', '현재 소유자 직접 사용 중이며 잔금일 기준 전체 명도 협의가 가능합니다.\n둘째 줄'), '현재 소유자 직접 사용 중이며 잔금일 기준 전체 명도 협의가 가능합니다.', 'blank short label → original first line verbatim (no rewrite to 명도 가능)');
eq(shortOrFirstLine('   ', '82.5㎡ 코너 대지'), '82.5㎡ 코너 대지', 'whitespace short label → original; numbers not truncated');
eq(shortOrFirstLine(undefined, undefined, '기본 문구'), '기본 문구', 'both missing → fallback');
eq(shortOrFirstLine(null, '', ''), '', 'both empty → empty (row omitted by caller)');
eq(shortOrFirstLine(undefined, '\n\n둘째 줄만 있음'), '둘째 줄만 있음', 'leading blank lines skipped');

// 2. coverageDisplay
const reg = coverageDisplay(57.0, '57%', 61.8, 360);
eq(reg?.label, '건폐율', 'register value keeps register label'); eq(reg?.value, '57%', 'register display printed as given'); eq(reg?.calculated, false, 'register value is not calculated');
const calc = coverageDisplay(0, '0%', 24.8, 50.85);
eq(calc?.label, '단순 건폐율', 'register 0 + both areas → calculated label'); eq(calc?.value, '약 48.8%', 'calculated value = building ÷ land, 1 decimal, 약 prefix'); eq(calc?.calculated, true, 'flagged calculated');
eq(coverageDisplay(0, '0%', 0, 50.85), null, 'register 0 + no building area → omitted (never 0%)');
eq(coverageDisplay(0, '0%', 24.8, 0), null, 'register 0 + no land area → omitted');
eq(coverageDisplay(null, '', 24.8, undefined), null, 'missing values → omitted');
// 2b. Calculated FAR (owner sample review 2026-11-11): Bangbae 815-11 floors B1 103.14 + 1F 40.99×2 + 2F 81.98 + 3F 81.98
// = 349.08 (register total) → above ground 245.94 / 168.1 = 146.3%.
const bbFloors = [{ floor: 'B1', areaSqm: 103.14 }, { floor: '1F', areaSqm: 40.99 }, { floor: '1F', areaSqm: 40.99 }, { floor: '2F', areaSqm: 81.98 }, { floor: '3F', areaSqm: 81.98 }];
eq(JSON.stringify(rules.floorAreaRatioDisplay(0, '', bbFloors, 349.08, 168.1)), JSON.stringify({ label: '단순 용적률', value: '약 146.3%', calculated: true }), 'FAR calculated from complete floors');
eq(rules.floorAreaRatioDisplay(0, '', bbFloors.slice(1), 349.08, 168.1), null, 'partial floor list → no FAR');
eq(rules.floorAreaRatioDisplay(0, '', [...bbFloors.slice(0, 4), { floor: '3F', areaSqm: null }], 349.08, 168.1), null, 'floor without area → no FAR');
eq(rules.floorAreaRatioDisplay(180, '180%', bbFloors, 349.08, 168.1).calculated, false, 'register FAR wins');
eq(rules.buildingAgeDisplay('1978-07-31', '2026-11-11T00:00:00Z'), '약 48년 (1978년 사용승인)', 'building age');
eq(rules.buildingAgeDisplay('1978-12-31', '2026-11-11T00:00:00Z'), '약 47년 (1978년 사용승인)', 'building age before anniversary');
eq(rules.buildingAgeDisplay('', '2026-11-11T00:00:00Z'), '', 'no date → empty');
// KST reference date, same result in every viewer time zone (루인 review on #56): 2026-11-11T00:00Z is 11-11 09:00 KST,
// 2026-11-10T15:00Z is 11-11 00:00 KST (anniversary reached), 2026-11-10T14:59Z is 11-10 23:59 KST (not yet).
eq(rules.buildingAgeDisplay('1978-11-11', '2026-11-11T00:00:00Z'), '약 48년 (1978년 사용승인)', 'anniversary day (KST)');
eq(rules.buildingAgeDisplay('1978-11-11', '2026-11-10T15:00:00Z'), '약 48년 (1978년 사용승인)', 'KST midnight boundary reached');
eq(rules.buildingAgeDisplay('1978-11-11', '2026-11-10T14:59:59Z'), '약 47년 (1978년 사용승인)', 'one second before KST midnight');
eq(rules.buildingAgeDisplay('1978-11-11', '2026-11-11'), '약 48년 (1978년 사용승인)', 'date-only asOf used as written');
eq(rules.buildingAgeDisplay('1978-11-11', 'not a date'), '', 'invalid asOf → empty');
eq(rules.koreaDateLabel('2026-11-10T15:00:00Z'), '2026. 11. 11', 'KST issue date at midnight');
eq(rules.koreaDateLabel('2026-11-10T14:59:59Z'), '2026. 11. 10', 'KST issue date one second before midnight');
eq(rules.koreaDateLabel(''), '', 'invalid issue date → empty');
// Comparable unit price (2026-11-12 multi-review): seed 811-20 stores 7,905만 but 45억 ÷ 56.29평 = 7,994만 → bar uses the
// calculated value and flags the row; a consistent row (2112: 51억 ÷ 59.89평 = 8,516만) keeps the source value.
{
  const a = rules.comparableUnitDisplay({ salePrice: 4_500_000_000, landAreaPyeong: 56.29, landUnitPrice: 79_050_000 });
  if (!a.mismatch || a.value !== Math.round(4_500_000_000 / 56.29) || a.sourceValue !== 79_050_000) fail(`comparable mismatch not flagged: ${JSON.stringify(a)}`);
  const b = rules.comparableUnitDisplay({ salePrice: 5_100_000_000, landAreaPyeong: 59.89, landUnitPrice: 85_160_000 });
  if (b.mismatch || b.value !== 85_160_000) fail(`consistent comparable changed: ${JSON.stringify(b)}`);
  const seed = readFileSync('src/services/bangbae81511DataSeedService.ts', 'utf8');
  const flagged = [...seed.matchAll(/label: '([^']+)'.*?salePrice: ([\d_]+), landAreaPyeong: ([\d.]+), landUnitPrice: ([\d_]+)/g)].filter((m) => rules.comparableUnitDisplay({ salePrice: Number(m[2].replace(/_/g, '')), landAreaPyeong: Number(m[3]), landUnitPrice: Number(m[4].replace(/_/g, '')) }).mismatch).map((m) => m[1]);
  eq(flagged.join(','), '방배동 811-20,방배동 811-19,유한빌딩 882-25', 'seed rows needing source check');
  if (!readFileSync('src/components/professionalReport/DaonDetail7PageMaster.tsx', 'utf8').includes('comparableUnitDisplay(row)')) fail('page 4 bars must use comparableUnitDisplay');
}
{
  const { execFileSync } = await import('node:child_process');
  const probe = "import('./scripts/lib/ts-module-loader.mjs').then(async ({ importTs }) => { const r = await importTs('src/domain/professionalReport/reportDisplayRules.ts'); console.log(r.koreaDateLabel('2026-11-10T15:00:00Z')); })";
  const dates = ['Asia/Seoul', 'America/Los_Angeles', 'UTC'].map((tz) => execFileSync(process.execPath, ['-e', probe], { env: { ...process.env, TZ: tz }, encoding: 'utf8' }).trim());
  if (new Set(dates).size !== 1 || dates[0] !== '2026. 11. 11') fail(`issue date depends on viewer time zone: ${dates.join(' / ')}`);
  for (const [file, needle] of [['src/components/professionalReport/DaonDetail7PageMaster.tsx', 'koreaDateLabel(snapshot.generatedAt)'], ['src/components/professionalReport/DaonReportOpeningPage.tsx', 'koreaDateLabel(model.generated.generatedAt)']]) if (!readFileSync(file, 'utf8').includes(needle)) fail(`${file} must print the KST snapshot date`);
  if (/managerName\.value \|\| '김은미/.test(readFileSync('src/components/professionalReport/DaonDetail7PageMaster.tsx', 'utf8'))) fail('detail pages must not fill a missing manager with a personal name');
}
{
  const { execFileSync } = await import('node:child_process');
  const probe = "import('./scripts/lib/ts-module-loader.mjs').then(async ({ importTs }) => { const r = await importTs('src/domain/professionalReport/reportDisplayRules.ts'); console.log([r.buildingAgeDisplay('1978-11-11', '2026-11-11T00:00:00Z'), r.buildingAgeDisplay('1978-11-11', '2026-11-10T14:59:59Z')].join('|')); })";
  const results = ['Asia/Seoul', 'America/Los_Angeles', 'UTC', 'Pacific/Kiritimati'].map((tz) => execFileSync(process.execPath, ['-e', probe], { env: { ...process.env, TZ: tz }, encoding: 'utf8' }).trim());
  if (new Set(results).size !== 1 || results[0] !== '약 48년 (1978년 사용승인)|약 47년 (1978년 사용승인)') fail(`building age depends on viewer time zone: ${results.join(' / ')}`);
}
eq(coverageDisplay(Number.NaN, '', 24.8, 50.85)?.calculated, true, 'NaN register treated as unrecorded');
eq(coverageDisplay(-3, '-3%', 10, 20)?.value, '약 50%', 'negative register treated as unrecorded');

// 3. Masters use the shared rules (no inline re-implementation).
const one = readFileSync('src/components/professionalReport/DaonOnePageMaster.tsx', 'utf8');
const seven = readFileSync('src/components/professionalReport/DaonDetail7PageMaster.tsx', 'utf8');
// Page 4 basis note: the estimate uses comparableCount deals while the API stores only the 8 most recent; the printed count must be the estimate count.
if (!seven.includes("후보 {estimateBasisCount}건") || /후보 \{estimateBasis\.length\}건/.test(seven)) fail("page 4 basis note must print the estimate comparableCount, not the stored deal list length");
// iPhone width: report toolbar buttons stay on one line.
if (!readFileSync("src/report-device-fit.css", "utf8").includes(".professional-report-toolbar .MuiButton-root,.preview-toolbar .MuiButton-root{white-space:nowrap")) fail("report toolbar buttons must not wrap at phone width");
for (const key of ['shortHeadline', 'shortOccupancyLabel', 'shortRoadLabel', 'shortUseLabel', 'shortDevelopmentLabel']) {
  if (!new RegExp(`shortOrFirstLine\\(p\\.${key}\\b`).test(one)) fail(`1P must print ${key} through shortOrFirstLine`);
}
if (!/shortOrFirstLine\(model\.identity\.shortHeadline/.test(seven)) fail('7P hero statement must use shortOrFirstLine');
if (!/coverageDisplay\(model\.building\.buildingCoverageRate\.value/.test(seven)) fail('7P coverage must use coverageDisplay');
if (!seven.includes('공부상 수치가 아닙니다')) fail('7P calculated coverage note missing');

// 4. Device fit (owner iPhone test 2026-11-07): iOS detection, phone screen scale, CSS print overrides present.
const fit = await importTs('src/utils/reportDeviceFit.ts');
eq(fit.isIosLike({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_6 like Mac OS X)', platform: 'iPhone', maxTouchPoints: 5 }), true, 'iPhone detected');
eq(fit.isIosLike({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 5 }), true, 'iPadOS (desktop UA + touch) detected');
eq(fit.isIosLike({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 0 }), false, 'Mac desktop not iOS');
eq(fit.isIosLike({ userAgent: 'Mozilla/5.0 (Linux; Android 14)', platform: 'Linux armv8l', maxTouchPoints: 5 }), false, 'Android not iOS');
eq(fit.screenFit(390), (390 - 16) / 794, 'iPhone width scale');
eq(fit.screenFit(1440), 1, 'desktop not scaled');
const fitCss = readFileSync('src/report-device-fit.css', 'utf8');
for (const needle of ['html.ios-print-fit .professional-report-document', 'html.ios-print-fit .professional-report-shell .daon-professional-report-master', 'padding:0 7mm!important;box-sizing:content-box!important', '.professional-report-shell{overflow:visible!important}', 'zoom:var(--report-screen-fit,1)']) if (!fitCss.includes(needle)) fail(`report-device-fit.css missing: ${needle}`);
for (const page of ['src/pages/ProfessionalReportSnapshotPage.tsx', 'src/pages/DocumentPreview.tsx']) { const src = readFileSync(page, 'utf8'); if (!src.includes('useReportDeviceFit();') || !src.includes("import '../report-device-fit.css';")) fail(`${page} must use the device fit hook and CSS`); }

// 5. 1P blank handling (owner iPhone PDF 2026-11-07): no "- (36평)" placeholder, no empty 핵심 포인트 box.
// 2026-11-11 sample review: comparable rows must not overlap, notes merge into one line, no-photo scenarios stay readable.
const refineCss = readFileSync('src/daon-master-refinement.css', 'utf8');
for (const needle of ['.dd-comparables.has-bars>.dd-bars{grid-auto-rows:minmax(9.2mm,auto)}', '.dd-scenarios.no-photo article>p{min-height:22mm', '.dd-p1-facts{display:grid', '.dd-use-basis{margin-bottom:3.5mm}']) if (!refineCss.includes(needle)) fail(`daon-master-refinement.css missing: ${needle}`);
if ((seven.match(/className="dd-metric-note"/g) || []).length !== 1) fail('page 6 must render the calculated coverage/FAR note as one dd-metric-note');
for (const needle of ["{!hero && p1Facts.length > 1 && <div className=\"dd-p1-facts\">", "{!hasPhotos && useBasis.length > 1 &&", 'officialMultipleLine(model.pricing.salePrice.value']) if (!seven.includes(needle)) fail(`DaonDetail7PageMaster missing: ${needle}`);
// VWorld report map (2026-11-11): server-only key, centred on the property, image-only passthrough, 503 without a key.
{
  const proxy = await import('../api/_lib/providerProxy.mjs');
  const url = new URL(proxy.vworldStaticMapUrl(37.4913849, 126.9897284, 'TEST_KEY', 'example.test'));
  if (url.origin + url.pathname !== 'https://api.vworld.kr/req/image' || url.searchParams.get('center') !== '126.9897284,37.4913849' || url.searchParams.get('request') !== 'getmap' || url.searchParams.get('domain') !== 'example.test') fail(`VWorld static map URL shape: ${url}`);
  const saved = process.env.VWORLD_API_KEY; delete process.env.VWORLD_API_KEY;
  const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(body) { this.body = body; } };
  await proxy.staticMap(new URLSearchParams({ provider: 'vworld', latitude: '37.49', longitude: '126.98' }), res, undefined);
  if (res.statusCode !== 503) fail(`VWorld static map without key must be 503, got ${res.statusCode}`);
  if (saved !== undefined) process.env.VWORLD_API_KEY = saved;
  const client = readFileSync('src/services/maps/vworldMapProvider.ts', 'utf8');
  if (!client.includes("VWORLD_ATTRIBUTION = '© 국토교통부 브이월드(VWorld)'") || !client.includes('fillText(VWORLD_ATTRIBUTION')) fail('VWorld map must carry the attribution on the image');
  if (!readFileSync('src/services/maps/mapService.ts', 'utf8').includes('[vworldMapProvider, naverMapProvider, kakaoMapProvider]')) fail('report static map must prefer VWorld');
  // Aerial (2026-11-12, no field photo; roadview capture/redistribution not permitted by Kakao/NAVER): only GRAPHIC or PHOTO.
  const aerial = new URL(proxy.vworldStaticMapUrl(37.49, 126.98, 'K', 'example.test', 'aerial'));
  eq(aerial.searchParams.get('basemap'), 'PHOTO', 'aerial layer requests the PHOTO base map');
  eq(new URL(proxy.vworldStaticMapUrl(37.49, 126.98, 'K', 'example.test', 'satellite<script>')).searchParams.get('basemap'), 'GRAPHIC', 'unknown layer falls back to the street map');
  if (!client.includes("VWORLD_AERIAL_LABEL = '항공사진 · 현장사진 아님'") || !client.includes("stampVworldMap(await response.blob(), VWORLD_AERIAL_LABEL)")) fail('aerial image must carry the 항공사진 · 현장사진 아님 label on the image');
  const preview = readFileSync('src/pages/DocumentPreview.tsx', 'utf8');
  if (!preview.includes("item.category !== 'aerial' && reportMediaCategoryAllowed(item.category, allowInternal))?.url || bundle.media.find(") || !preview.includes("item.category === 'aerial' && reportMediaCategoryAllowed")) fail('1P hero must prefer field photos over the aerial image');
  if (!readFileSync('src/components/professionalReport/DaonDetail7PageMaster.tsx', 'utf8').includes("visibleMedia.find((item) => item.category === 'aerial')?.url || null")) fail('7P hero falls back to the aerial image only after field photos');
}
const oneSrc = readFileSync('src/components/professionalReport/DaonOnePageMaster.tsx', 'utf8');
if (oneSrc.includes("'-'} (${py")) fail('1P area must not print "- (n평)" when ㎡ is missing');
if (!oneSrc.includes('{points.length > 0 && <section className="d1-points">')) fail('1P must hide the empty 핵심 포인트 section');
if (oneSrc.includes('· 기존값')) fail('1P parking wording "기존값" replaced by "(입력값)"');

// 6. iOS Korean glyphs (owner iPhone PDF 2026-11-07): every Georgia brand stack in the report CSS must be listed in the
//    iOS-only rule that inserts the bundled 'Noto Sans KR Variable' (system Hangul fallback printed blank on iOS).
{
  const iosRule = /html\.ios-print-fit :is\(([^)]*)\)\{font-family:Georgia,'Noto Sans KR Variable',serif\}/.exec(fitCss);
  if (!iosRule) fail('report-device-fit.css missing the iOS Korean font rule');
  const listed = new Set(iosRule[1].split(',').map((s) => s.trim()));
  for (const f of ['src/daon-report-frame.css', 'src/daon-detail-master.css', 'src/daon-detail-quality.css', 'src/daon-master-refinement.css', 'src/daon-one-page-master.css', 'src/daon-one-page-quality.css']) {
    const css = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
      const ff = /font-family:\s*([^;}]*)/.exec(m[2]);
      if (!ff || !/^Georgia/.test(ff[1].trim())) continue;
      for (const sel of m[1].split(',').map((s) => s.trim().replace(/\s+/g, ' '))) if (!/:(:|before|after)/.test(sel) && !listed.has(sel)) fail(`iOS Korean font rule missing Georgia selector ${sel} (${f})`);
    }
  }
  const frame = readFileSync('src/daon-report-frame.css', 'utf8');
  if (!/\.daon-professional-report-master\{[^}]*font-family:Pretendard,'Noto Sans KR Variable'/.test(frame)) fail('frame base font stack must include the bundled Noto Sans KR Variable');
}

console.log('Report display rules (short labels, calculated coverage, device fit): PASS');

// 루인 BLOCKING on #56 (2026-11-12): the district query keeps rows whose legal dong is blank, and the estimate does not drop them.
// The API must count them and the page-4 wording must never call them "same dong".
{
  const pv = await importTs('src/domain/professionalReport/priceLayerView.ts');
  const { estimateAchievablePrice } = await import('../api/_lib/priceLayers.mjs');
  const deal = (i, legalDong) => ({ dealDate: `2026-0${(i % 9) + 1}-10`, legalDong, jibun: `${800 + i}`, type: 'commercial', dealAmount: 3_000_000_000 + i * 10_000_000, landAreaSqm: 170, landPricePerPyeong: Math.round((3_000_000_000 + i * 10_000_000) / (170 / 3.305785)) });
  const rows = [...Array.from({ length: 8 }, (_, i) => deal(i, '방배동')), deal(8, ''), deal(9, '  ')];
  // Ruin review 2026-11-12 (78796b3): the count is trusted only when measured with the exact-name rule against a known lookup dong.
  const est = estimateAchievablePrice({ landAreaSqm: 168.1, rows, computedAt: '2026-11-12T00:00:00Z', subjectDong: '방배동' });
  eq(est.comparableCount, 10, 'blank-dong rows are still used (selection unchanged)');
  eq(est.legalDongUnconfirmedCount, 2, 'subject dong: blank-dong deals unconfirmed');
  eq(est.subjectLegalDong, '방배동', 'estimate stores the lookup dong it was measured against');
  eq(est.dongScopeRule, pv.DONG_SCOPE_RULE, 'estimate stores the rule id (API and view agree)');
  eq(pv.estimateScopeLabel(est), '같은 동 8건·동 미확인 2건', 'mixed scope is spelled out');
  const allSame = estimateAchievablePrice({ landAreaSqm: 168.1, rows: Array.from({ length: 6 }, (_, i) => deal(i, '방배동')), subjectDong: '방배동' });
  eq(pv.estimateScopeLabel(allSame), '모두 같은 동 확인', 'all confirmed under the current rule');
  // Legacy call (no subject dong) over five different dongs: nothing is confirmed, never "모두 같은 동 확인".
  const fiveDongs = ['방배동', '서초동', '반포동', '잠원동', '양재동'].map((name, i) => deal(i, name));
  const legacyCall = estimateAchievablePrice({ landAreaSqm: 168.1, rows: fiveDongs });
  eq(legacyCall.legalDongUnconfirmedCount, 5, 'no subject dong confirms no deal');
  eq(pv.estimateScopeLabel(legacyCall), '모두 동 미확인 5건', 'no subject dong → all unconfirmed');
  // Stored estimates from before the rule id: a count of 0 or a full deal list is not proof of "same dong".
  eq(pv.estimateScopeLabel({ comparableCount: 5, legalDongUnconfirmedCount: 0 }), '같은 동 또는 동 미확인 거래', 'old stored count 0 is not trusted');
  eq(pv.estimateScopeLabel({ comparableCount: 5, legalDongUnconfirmedCount: 0, deals: fiveDongs }), '같은 동 또는 동 미확인 거래', 'old full list of named dongs is not trusted');
  eq(pv.estimateScopeLabel({ comparableCount: 5, legalDongUnconfirmedCount: 0, dongScopeRule: pv.DONG_SCOPE_RULE, subjectLegalDong: '' }), '모두 동 미확인 5건', 'rule id without a lookup dong confirms nothing');
  eq(pv.estimateScopeLabel({ comparableCount: 2, deals: [{ legalDong: '' }, { legalDong: ' ' }] }), '모두 동 미확인 2건', 'old full list of blank dongs is stated as unconfirmed');
  eq(pv.estimateScopeLabel({ comparableCount: 10, deals: Array.from({ length: 8 }, () => ({ legalDong: '방배동' })) }), '같은 동 또는 동 미확인 거래', 'legacy truncated list does not claim same dong');
  const sevenSrc = readFileSync('src/components/professionalReport/DaonDetail7PageMaster.tsx', 'utf8');
  if (!sevenSrc.includes('{estimateScopeLabel(priceEstimate)}·최근 6개월') || /건\(같은 동·최근 6개월\)/.test(sevenSrc)) fail('page 4 basis note must print the verified dong scope');
  if (/같은 동·최근 6개월/.test(pv.PRICE_ESTIMATE_METHOD_NOTE)) fail('method note must not call every deal same-dong');
  eq(estimateAchievablePrice({ landAreaSqm: 168.1, rows, subjectDong: '' }).legalDongUnconfirmedCount, 10, 'blank subject dong confirms no deal');
  eq(estimateAchievablePrice({ landAreaSqm: 168.1, rows: [...Array.from({ length: 5 }, (_, i) => deal(i, '신정동'))], subjectDong: '정동' }).legalDongUnconfirmedCount, 5, 'substring dong is not confirmed');
  const disc = readFileSync('api/property-discovery.mjs', 'utf8');
  if (!disc.includes("const matchLevel=!masked && jibun===targetJibun && sameDong") || !disc.includes('const sameDong=sameLegalDong(legalDong,subjectDong);')) fail('exact_lot/same_dong need an exact, non-empty dong');
  if (!disc.includes('const inDongOrUnknown=r=>!subjectDong || !r.legalDong || sameLegalDong(r.legalDong,subjectDong);') || !disc.includes('rows:marketRows,subjectDong') || /\.includes\(subjectDong\)/.test(disc)) fail('discovery must use the exact dong rule everywhere');
  console.log('PASS estimate dong scope: blank legal dong counted and never printed as same dong');
}

// Page 05 scenario evidence (owner review 2026-11-12: cards showed only a name). Only stored facts, missing data omitted.
{
  const { scenarioEvidence } = rules;
  const facts = { floors: [{ floor: '3F', name: '주택', areaSqm: 81.98 }, { floor: '2F', name: '주택', areaSqm: 81.98 }, { floor: '1F', name: '점포', areaSqm: 40.99 }, { floor: '1F', name: '제2종근린생활시설', areaSqm: 40.99 }], totalFloorAreaSqm: 349.08, zoning: '제2종일반주거지역(7층 이하)', road: '양면 도로 코너', occupancy: '잔금일 기준 전체 명도 협의 가능' };
  const office = scenarioEvidence('사옥', facts);
  eq(office[0], '연면적 349.08㎡ · 공부상 3F·2F·1F', 'office: total floor area and floors');
  eq(office[1], '명도: 잔금일 기준 전체 명도 협의 가능', 'office: occupancy as stored');
  if (!/공부상 주택 163.96㎡\(3F·2F\) 업무 사용 시 용도변경 확인 필요/.test(office[2] || '')) fail('office: residential floors need a use-change check line');
  const mixed = scenarioEvidence('주거·업무 복합공간', facts);
  eq(mixed[0], '공부상 주택 3F·2F 163.96㎡(층별 합계)', 'mixed: residential sum is labelled');
  eq(mixed[1], '근생·점포 1F 81.98㎡(층별 합계)', 'mixed: commercial sum is labelled');
  const fb = scenarioEvidence('F&B 플래그십', facts);
  eq(fb[0], '도로: 양면 도로 코너', 'F&B: stored road text');
  eq(fb[1], '1층 공부상 점포 40.99㎡ · 제2종근린생활시설 40.99㎡', 'F&B: first-floor register uses');
  if (!/업종별 허용 여부 확인 필요$/.test(fb[2] || '')) fail('F&B: zoning check line');
  eq(scenarioEvidence('F&B 플래그십', { floors: [] }).join('|'), '용도지역 미확인 · 업종별 허용 여부 확인 필요', 'no zoning still keeps the permitted-use check');
  if (scenarioEvidence('사옥', { ...facts, occupancy: '일부 임대 중' }).some((line) => /일괄 사용/.test(line))) fail('office scenario must not assert whole-building use (part may be leased)');
  eq(scenarioEvidence('사옥', { floors: [], totalFloorAreaSqm: null, occupancy: '' }).length, 0, 'office without data → nothing');
  if (!readFileSync('src/components/professionalReport/DaonDetail7PageMaster.tsx', 'utf8').includes('scenarioEvidence(text, scenarioFacts)')) fail('page 05 cards must print scenario evidence');
  console.log('PASS page 05 scenario evidence: stored facts only, sums labelled, use-change checks, nothing invented');
}

// 1P hero preference executed on the real expression: exterior beats aerial, aerial only when nothing else, never foreign.
{
  const line = readFileSync('src/pages/DocumentPreview.tsx', 'utf8').split('\n').find((row) => row.includes('const dataRoomHero = bundle.media.find('));
  const select = new Function('bundle', 'id', 'allowInternal', 'reportMediaCategoryAllowed', `return ${line.trim().slice('const dataRoomHero = '.length).replace(/;$/, '')};`);
  const allowed = (category) => ['exterior', 'aerial', 'road'].includes(category);
  const m = (id, propertyId, category) => ({ id, propertyId, mediaType: 'image', category, url: `${id}.jpg` });
  eq(select({ media: [m('air', 'p', 'aerial'), m('ext', 'p', 'exterior')] }, 'p', false, allowed), 'ext.jpg', 'exterior photo wins over aerial');
  eq(select({ media: [m('air', 'p', 'aerial')] }, 'p', false, allowed), 'air.jpg', 'aerial fills the hero when no field photo');
  eq(select({ media: [m('foreign', 'q', 'aerial')] }, 'p', false, allowed), '', 'foreign aerial never used');
  console.log('PASS 1P hero: field photo > VWorld aerial > none, Property-scoped');
}
