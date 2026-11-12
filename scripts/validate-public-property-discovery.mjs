import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const api = read('api/property-discovery.mjs');
const panel = read('src/components/PropertyPublicDiscoveryPanel.tsx');
const service = read('src/services/publicPropertyDiscoveryService.ts');
const form = read('src/pages/PropertyForm.tsx');
const valuePolicy = read('src/domain/professionalReport/valuePolicy.ts');
const discoveryPage = read('src/pages/PropertyDiscoveryPage.tsx');
const app = read('src/App.tsx');
const layout = read('src/components/Layout.tsx');
const marketPanel = read('src/components/MarketPresencePanel.tsx');
const marketService = read('src/services/marketPresenceService.ts');
const types = read('src/types.ts');
const settingsPage = read('src/pages/SettingsPage.tsx');
const proxyClient = read('src/services/maps/proxyClient.ts');
const vercel = read('vercel.json');
const reportDataBuilder = read('src/services/reportEngine/reportDataBuilder.ts');
const reportTypes = read('src/domain/professionalReport/types.ts');
const propertyHub = read('src/pages/PropertyHubPage.tsx');
const listingSupplyService = read('src/services/listingSupplyService.ts');

for (const marker of [
  "KAKAO_ADDRESS",
  "BldRgstHubService",
  "RTMSDataSvcNrgTrade",
  "RTMSDataSvcLandTrade",
  "DATA_GO_KR_SERVICE_KEY",
  "getBrTitleInfo",
  "getBrFlrOulnInfo",
  "BldEngyHubService",
  "getBeElctyUsgInfo",
  "getBeGasUsgInfo",
  "energy_usage_observed",
  "no_public_record",
  "storeListInRadius",
  "operating_business_observed",
  "nearby_business_observed",
  "publicDataConfigured",
  "sigunguCd",
  "bjdongCd",
  "getBrJijiguInfo",
  "exact_lot",
  "medianPricePerPyeong",
  "safeProvider",
  "providerStatus",
  "same_address_poi_observed",
  "kakaoPoiEvidence",
  "KAKAO_CATEGORY",
  "normalizedServiceKey",
  "Promise.all(categories.map",
  "Promise.all(months.map",
  "AbortSignal.timeout",
  "fetchWithTimeout",
  "vworldLandProfile",
  "parcelPnu",
  "getLandUseAttr",
  "getLandCharacteristics",
  "getIndvdLandPriceAttr",
  "VWORLD_BASE",
  "currency:'KRW'",
  "dealAmountSourceUnit:'만원'",
  "sourceDealAmountTenThousandWon",
]) if (!api.includes(marker)) throw new Error(`Property discovery API marker missing: ${marker}`);

for (const marker of [
  '주소 · 지번으로 건물 자동조회',
  '현재 매물 여부',
  '실제 사용 / 점유 상태',
  '에너지 사용 흔적 있음',
  '공개 사용량 자료 없음',
  '동일 주소 영업 업소 관측',
  '건물 전체 사용상태 확정값으로 사용하지 않습니다',
  '동일 지번',
  '평당가 중앙값',
  '일부 공급원 응답 또는 활용권한이 부족합니다',
  'Kakao Local 동일 주소 활동',
  '실제 점유율·임대차·영업 지속 여부를 확정하지 않습니다',
  '공적정보 적용',
  '토지 공적정보 적용',
  '개별공시지가',
  '감정가·시세가 아닙니다',
  '주소·좌표 적용',
  '건축물대장/국토부 실거래 자동조회',
]) if (!panel.includes(marker)) throw new Error(`Property discovery panel marker missing: ${marker}`);

for (const marker of [
  'public-address:',
  'building-register:',
  'public-market:',
  'building-energy:',
  'official-land-profile:',
  'official-land-value-calculation:',
  'official_land_value_calculation',
  'derived_value_not_appraisal_or_market_value',
  'official_land_profile',
  'building_energy_usage_evidence',
  'occupancy_supporting_evidence_only',
  'operating-businesses:',
  'operating_business_evidence',
  'kakao_poi_activity_evidence',
  'kakao-poi-activity:',
  'commercial_activity_supporting_evidence_only',
  "sourceType: 'public_api'",
  "sourceType: 'market_data'",
  'explicitFields',
]) if (!service.includes(marker)) throw new Error(`Property discovery provenance marker missing: ${marker}`);

if (!form.includes('<PropertyPublicDiscoveryPanel')) throw new Error('PropertyForm public discovery panel 연결 누락');
if (!form.includes('publicPropertyDiscoveryService.persist')) throw new Error('PropertyForm discovery provenance 저장 연결 누락');
if (!service.includes('async refreshExisting') || !service.includes('saveVerificationCandidate')) throw new Error('기존 물건 공공자료 비파괴 refresh/verification candidate 연결 누락');
if (!service.includes("fieldKey === 'name'") || !service.includes('equivalentAddresses.includes(currentAddress)')) throw new Error('공공자료 refresh 검증후보 노이즈 억제 규칙 누락');
if (!service.includes('const patch: Partial<Property>') || service.includes("buildingName: building?.buildingName || ''")) throw new Error('부분 공공조회가 기존 Property를 빈값/0으로 덮어쓰지 않도록 sparse patch를 유지해야 합니다.');
if (!service.includes("const calculatedField = fieldKey === 'estimatedOfficialLandValue'") || !service.includes("sourceType: addressField ? 'map_provider' as const : calculatedField ? 'calculated' as const")) throw new Error('공시지가 계산값 provenance는 public_api가 아니라 calculated여야 합니다.');
if (!discoveryPage.includes('공공자료 저장') || !discoveryPage.includes('refreshExisting(existing, result)')) throw new Error('기존 물건 공공자료 refresh UI 연결 누락');
if (!form.includes('location.state')) throw new Error('Discovery → PropertyForm state 전달 연결 누락');
if (!discoveryPage.includes('주소 · 지번으로 물건 조회') || !discoveryPage.includes('이 주소로 물건 등록') || !discoveryPage.includes('자세히 입력해서 등록')) throw new Error('Address-first discovery workspace contract 누락');
// Phase 3 (2026-11-12): one-step creation from a confirmed address, refused while duplicates are possible.
{
  const quick = await (await import('./lib/ts-module-loader.mjs')).importTs('src/domain/propertyDetail/quickCreateRules.ts');
  const ok = { address: { roadAddress: '서울 서초구 동광로18길 7' } };
  const cases = [
    [{ result: undefined, matchCount: 0, matchError: '', matchChecked: true }, true],
    [{ result: ok, matchCount: 0, matchError: '', matchChecked: false }, true],
    [{ result: ok, matchCount: 0, matchError: 'x', matchChecked: true }, true],
    [{ result: ok, matchCount: 1, matchError: '', matchChecked: true }, true],
    [{ result: ok, matchCount: 2, matchError: '', matchChecked: true }, true],
    [{ result: ok, matchCount: 0, matchError: '', matchChecked: true }, false],
  ];
  for (const [input, blocked] of cases) if (Boolean(quick.quickCreateBlockReason(input)) !== blocked) throw new Error(`바로 등록 차단 규칙 오류: ${JSON.stringify(input)}`);
  if (!discoveryPage.includes('createPropertyFromDiscovery(result)') || !discoveryPage.includes('disabled={Boolean(blockReason) || creating}')) throw new Error('조회 화면 바로 등록 연결 누락');
  const quickSrc = readFileSync('src/services/propertyQuickCreateService.ts', 'utf8');
  for (const marker of ["buildPropertyToSave(draft, undefined, 'new'", 'publicPropertyDiscoveryService.persist(data.id, result)', 'marketPresenceService.persist(data)', 'streetViewProvenanceService.ensure(data)']) if (!quickSrc.includes(marker)) throw new Error(`바로 등록은 등록 양식과 같은 저장 경로를 써야 합니다: ${marker}`);
}
if (!discoveryPage.includes('Kakao 동일주소 POI')) throw new Error('Discovery summary Kakao evidence 연결 누락');
if (!app.includes('path="discover"')) throw new Error('Discovery route 누락');
if (!layout.includes('to="/discover"')) throw new Error('Discovery primary navigation 누락');
if (!vercel.includes('"source": "/discover"') || !vercel.includes('"destination": "/index.html"')) throw new Error('Discovery Vercel SPA rewrite 누락');
if (!valuePolicy.includes('Array.isArray(explicitFields)')) throw new Error('Report public-source explicitFields provenance 연결 누락');
for (const marker of ['ListingStatus', 'daon_exclusive', 'external_observed', 'off_market_confirmed']) if (!types.includes(marker)) throw new Error(`Listing status model missing: ${marker}`);
if (!marketPanel.includes('현재 매물 상태') || !marketPanel.includes('외부 공급원이 연결되기 전에는 자동으로 매물이라고 판단하지 않습니다')) throw new Error('Market presence UI contract 누락');
for (const marker of ['listing-status:', 'market_listing_status', 'externalProviderConnected: false']) if (!marketService.includes(marker)) throw new Error(`Market presence provenance missing: ${marker}`);
if (!form.includes('marketPresenceService.persist')) throw new Error('PropertyForm market presence provenance 연결 누락');
if (!reportDataBuilder.includes("officialLandPricePerSqm: number('officialLandPricePerSqm'") || !reportDataBuilder.includes("context('estimatedOfficialLandValue', { calculated: true")) throw new Error('공시지가/계산토지가액 Report Snapshot 연결 누락');
if (!reportTypes.includes('officialLandPricePerSqm: ReportValue<number>') || !reportTypes.includes('estimatedOfficialLandValue: ReportValue<number>')) throw new Error('Report land public-data type 계약 누락');
// The hub's core-fact rows moved into propertyDetailModel.hubFactRows (PR #41); check the labels there and the wiring in the hub.
const hubModel = read('src/domain/propertyDetail/propertyDetailModel.ts');
if (!propertyHub.includes('hubFactRows(property)') || !hubModel.includes("'개별공시지가'") || !hubModel.includes("'공시지가 기준 토지가액'")) throw new Error('Property Hub 공시지가 노출 누락');
for (const marker of ['sourceDealAmountTenThousandWon?: number', "dealAmountSourceUnit?: '만원'", "currency?: 'KRW'"]) if (!service.includes(marker)) throw new Error(`실거래 원문 단위 TypeScript 계약 누락: ${marker}`);
for (const marker of ['market_listing_observation', 'listing_observation_not_property_status_confirmation', 'propertyStatusAutoUpdated: false', 'offMarketConfirmed: false', 'saveVerificationCandidate', "candidateValue: 'external_observed'"]) if (!listingSupplyService.includes(marker)) throw new Error(`실제 매물 공급원 정규화 계약 누락: ${marker}`);
for (const marker of ['통합 정보 판정', '공적정보', '시장정보', '사용상태', '매물상태', '동일지번도 동일건물 확정 거래로 승격하지 않음', '점유 확정값이 아니며 현장확인 필요']) if (!discoveryPage.includes(marker)) throw new Error(`Discovery 통합 정보계층 UI 누락: ${marker}`);
if (!reportTypes.includes('listingStatus: ReportValue<string>') || !reportDataBuilder.includes("context('listingStatus'")) throw new Error('매물상태 Report 데이터 자동 반영 계약 누락');

if (!settingsPage.includes('외부 데이터 공급원')) throw new Error('Settings data provider readiness UI 누락');
for (const marker of ['DATA_GO_KR_SERVICE_KEY가 없습니다', 'VWORLD_API_KEY가 없습니다', 'Vercel 서버 환경변수', '건축HUB 건축물대장정보', '상업업무용 부동산 매매 실거래가', '토지 매매 실거래가', '건축HUB 건물에너지정보', '소상공인시장진흥공단 상가(상권)정보 API', '공시지가·토지특성·토지이용계획']) {
  if (!settingsPage.includes(marker)) throw new Error(`Settings provider readiness marker missing: ${marker}`);
}
for (const marker of ['publicDataConfigured', 'vworldConfigured']) {
  if (!proxyClient.includes(marker)) throw new Error(`Proxy provider readiness contract missing: ${marker}`);
}

// Executable MOLIT transaction normalization regression (upstream dealAmount is 만원; normalized dealAmount is KRW).
const { normalizeTrade } = await import(new URL('../api/property-discovery.mjs', import.meta.url).href);
if (typeof normalizeTrade !== 'function') throw new Error('normalizeTrade export 누락');
const tradeResolved = { bun: '0815', ji: '0011', region3: '방배동' };
const tradeRow = (overrides = {}) => ({ dealYear: '2026', dealMonth: '3', dealDay: '7', umdNm: '방배동', jibun: '815-11', buildingArea: '100', ...overrides });

const one = normalizeTrade(tradeRow({ dealAmount: '1' }), 'commercial', tradeResolved);
assert.strictEqual(one.dealAmount, 10_000, '1 만원 → 10,000 KRW');
assert.strictEqual(one.sourceDealAmountTenThousandWon, 1);
assert.strictEqual(one.dealAmountSourceUnit, '만원');
assert.strictEqual(one.currency, 'KRW');

const large = normalizeTrade(tradeRow({ dealAmount: '123,456' }), 'commercial', tradeResolved);
assert.strictEqual(large.dealAmount, 1_234_560_000, '123,456 만원 → 1,234,560,000 KRW');
assert.strictEqual(large.sourceDealAmountTenThousandWon, 123_456);
assert.strictEqual(large.dealAmountSourceUnit, '만원');
assert.strictEqual(large.currency, 'KRW');
assert.strictEqual(large.dealDate, '2026-03-07', 'dealDate YYYY-MM-DD');
assert.match(large.dealDate, /^\d{4}-\d{2}-\d{2}$/);
assert.strictEqual(large.matchLevel, 'exact_lot');
// 루인 review 2026-11-12: same lot number without a confirmed dong is not the same lot; a blank lookup dong confirms nothing.
assert.strictEqual(normalizeTrade(tradeRow({ dealAmount: '1', umdNm: '' }), 'commercial', tradeResolved).matchLevel, 'regional_candidate', 'blank dong + same jibun is not exact_lot');
assert.strictEqual(normalizeTrade(tradeRow({ dealAmount: '1' }), 'commercial', { ...tradeResolved, region3: '' }).matchLevel, 'regional_candidate', 'blank lookup dong never confirms a lot or dong');
assert.strictEqual(normalizeTrade(tradeRow({ dealAmount: '1', jibun: '900' }), 'commercial', tradeResolved).matchLevel, 'same_dong_candidate');

const korean = normalizeTrade({ 거래금액: ' 123,456 ', 년: '2025', 월: '12', 일: '31', 법정동: '방배동', 지번: '8**' }, 'land', tradeResolved);
assert.strictEqual(korean.dealAmount, 1_234_560_000, 'Korean-key 거래금액 만원 → KRW');
assert.strictEqual(korean.sourceDealAmountTenThousandWon, 123_456);
assert.strictEqual(korean.dealDate, '2025-12-31');
assert.strictEqual(korean.matchLevel, 'masked_address_candidate');

for (const blank of ['', '   ', 'abc', '거래취소', undefined, null]) {
  const row = normalizeTrade(tradeRow({ dealAmount: blank }), 'commercial', tradeResolved);
  assert.strictEqual(row.dealAmount, undefined, `blank/non-numeric dealAmount (${JSON.stringify(blank)}) must stay missing, not 0 KRW`);
  assert.strictEqual(row.sourceDealAmountTenThousandWon, undefined);
  assert.notStrictEqual(row.dealAmount, 0);
  assert.strictEqual(row.pricePerSqm, undefined);
  assert.strictEqual(row.pricePerPyeong, undefined);
  assert.strictEqual(row.dealAmountSourceUnit, '만원');
  assert.strictEqual(row.currency, 'KRW');
}

// Comparable filtering (2026-10-30 live diagnosis): cancelled, share (지분) and collective-unit (집합) rows never feed medians.
const { marketSummary } = await import(new URL('../api/property-discovery.mjs', import.meta.url).href);
const whole = normalizeTrade(tradeRow({ dealAmount: '300,000', buildingType: '일반', plottageAr: '140.8' }), 'commercial', tradeResolved);
assert.strictEqual(whole.comparableExclusion, undefined);
assert.strictEqual(whole.landAreaSqm, 140.8, 'commercial plottageAr must map to landAreaSqm');
assert.strictEqual(whole.landPricePerPyeong, Math.round(3_000_000_000 / (140.8 / 3.3058)));
const unit = normalizeTrade(tradeRow({ dealAmount: '29,500', buildingType: '집합', buildingArea: '34.25' }), 'commercial', tradeResolved);
assert.strictEqual(unit.comparableExclusion, 'collective_unit');
const share = normalizeTrade({ dealAmount: '2,000', dealArea: '1', shareDealingType: '지분', dealYear: '2026', dealMonth: '9', dealDay: '1', umdNm: '방배동', jibun: '7**' }, 'land', tradeResolved);
assert.strictEqual(share.comparableExclusion, 'share_deal');
const cancelled = normalizeTrade(tradeRow({ dealAmount: '500,000', buildingType: '일반', cdealType: 'O', cdealDay: '26.10.01' }), 'commercial', tradeResolved);
assert.strictEqual(cancelled.comparableExclusion, 'cancelled');
const summary = marketSummary([whole, unit, share, cancelled]);
assert.strictEqual(summary.totalCandidates, 4);
assert.strictEqual(summary.comparableCount, 1);
assert.deepStrictEqual(summary.excluded, { cancelled: 1, share_deal: 1, collective_unit: 1 });
assert.strictEqual(summary.medianDealAmount, 3_000_000_000, 'median must ignore excluded rows');
assert.strictEqual(summary.medianLandPricePerPyeong, whole.landPricePerPyeong);
// Negative control: without the filter the median would be the 집합/지분 level.
const naive = [whole, unit, share, cancelled].map((row) => row.dealAmount).sort((a, b) => a - b)[1];
assert.notStrictEqual(naive, summary.medianDealAmount);

// Public transaction snapshot must never mark nearbyTransactions as confirmed (CLAUDE.md: a public transaction row is a
// candidate; automation alone never promotes imported evidence).
const marketBlock = service.slice(service.indexOf("id: `public-market:"), service.indexOf("id: `public-market:") + 900);
if (!marketBlock.includes("verificationStatus: 'imported'") || marketBlock.includes("verificationStatus: 'confirmed'")) throw new Error('공개 실거래 스냅샷은 imported(후보)로 저장해야 합니다.');
if (!marketBlock.includes('transaction_candidates_not_confirmed_comparables')) throw new Error('공개 실거래 스냅샷의 후보 의미(evidenceSemantics) 누락');

// Issue #37: property type classification from public records (executable), never guessing units.
const { classifyPropertyType } = await import(new URL('../api/property-discovery.mjs', import.meta.url).href);
const typeOf = (titles, landProfile = null) => classifyPropertyType({ titles, landProfile });
const cases37 = [
  [[{ mainUse: '제2종근린생활시설', registerKind: '일반' }], null, 'commercial_office'],
  [[{ mainUse: '공동주택', detailUse: '아파트', registerKind: '집합', householdCount: 300 }], null, 'apartment'],
  [[{ mainUse: '공동주택', detailUse: '다세대주택', registerKind: '집합' }], null, 'row_house'],
  [[{ mainUse: '업무시설', detailUse: '오피스텔' }], null, 'officetel'],
  [[{ mainUse: '단독주택', detailUse: '다가구주택' }], null, 'detached'],
  [[{ mainUse: '창고시설' }], null, 'factory_warehouse'],
  [[{ mainUse: '공동주택', detailUse: '아파트' }, { mainUse: '제1종근린생활시설' }], null, 'mixed'],
  [[], { landCategory: '대', landUseSituation: '주거기타' }, 'unconfirmed'],
  [[], { landCategory: '대', landUseSituation: '주거나지' }, 'land'],
  [[], { landCategory: '전', landUseSituation: '전' }, 'land'],
  [[], null, 'unconfirmed'],
];
for (const [titles, landProfile, expected] of cases37) {
  const result = typeOf(titles, landProfile);
  assert.strictEqual(result.type, expected, `유형 분류 오류: ${JSON.stringify(titles)} → ${result.type} (기대 ${expected})`);
  assert.ok(Array.isArray(result.basis) && result.basis.length > 0, '분류 근거(basis)가 필요합니다');
}
assert.strictEqual(typeOf([{ mainUse: '공동주택', detailUse: '아파트' }, { mainUse: '공동주택', detailUse: '아파트' }]).multipleBuildings, true, '여러 표제부는 선택 단계가 필요합니다');
assert.ok(typeOf([], null).basis.some((line) => line.includes('미확인')), '표제부 없음은 건물 부재가 아니라 미확인');
const discoverySource = readFileSync('api/property-discovery.mjs', 'utf8');
if (!discoverySource.includes('unrecordedFields')) throw new Error('건축물대장 0/공란을 미기재로 구분하는 unrecordedFields 누락');

// Owner request 2026-11-01: price layers — achievable-price estimate (executable, real rows observed 2026-11-01 동교동).
{
  const price = await import(new URL('../api/_lib/priceLayers.mjs', import.meta.url).href);
  const row = (type, dealDate, jibun, dealAmount, landAreaSqm, buildingUse = '', extra = {}) => ({ type, dealDate, legalDong: '동교동', jibun, dealAmount, landAreaSqm, buildingUse, landPricePerPyeong: Math.round(dealAmount / (landAreaSqm / 3.3058)), ...extra });
  const rows = [
    // One 6-parcel deal published as 6 rows (same date, dong, unit price) — must count once and, being block-size, be dropped.
    row('land', '2026-10-02', '1**', 267870000, 5.9), row('land', '2026-10-02', '1**', 99880000, 2.2), row('land', '2026-10-02', '1**', 3995390000, 88),
    row('land', '2026-10-02', '1**', 794540000, 17.5), row('land', '2026-10-02', '1**', 31186730000, 686.9), row('land', '2026-10-02', '1**', 12817020000, 282.3),
    row('commercial', '2026-10-02', '1**', 10000000000, 141.7, '제2종근린생활'), row('commercial', '2026-09-28', '1**', 22000000000, 375.2, '제2종근린생활'),
    row('commercial', '2026-07-23', '1**', 150000000000, 1693.8, '업무'), row('commercial', '2026-07-14', '1**', 6800000000, 167.1, '제2종근린생활'),
    row('commercial', '2026-07-13', '1**', 265000000000, 2739.7, '기타'), row('commercial', '2026-06-29', '1**', 3000000000, 139.8, '제2종근린생활'),
    row('land', '2026-06-26', '1**', 1400000000, 11.2), row('commercial', '2026-06-24', '2**', 3720000000, 190.7, '제1종근린생활'),
    row('land', '2026-06-20', '1**', 1800000000, 52.2), row('land', '2026-06-20', '1**', 390000000, 16.7),
    row('commercial', '2026-06-20', '1**', 3200000000, 112.1, '제1종근린생활'), row('commercial', '2026-06-20', '1**', 1000000000, 48.9, '제2종근린생활'),
    row('commercial', '2026-06-20', '1**', 1300000000, 46.3, '제1종근린생활'),
    row('commercial', '2026-06-18', '1**', 900000000, 150, '', { comparableExclusion: 'share_deal' }),
  ];
  const merged = price.mergeBulkDeals(rows.filter((r) => !r.comparableExclusion));
  assert.strictEqual(merged.filter((d) => d.parcelCount === 6).length, 1, '6필지 일괄 거래는 1건으로 병합');
  const est = price.estimateAchievablePrice({ landAreaSqm: 140.8, rows, computedAt: '2026-11-01T00:00:00Z' });
  assert.strictEqual(est.state, 'estimated');
  assert.strictEqual(est.comparableCount, 5, '대지 70.4~281.6㎡ 비교거래 5건');
  assert.deepStrictEqual(est.excluded, { upstream: 1, bulk: 1, tooLarge: 3, tooSmall: 5 });
  assert.strictEqual(est.unitMid, 94367172, '토지 평당 중앙값');
  assert.strictEqual(est.unitLow, 70939914); assert.strictEqual(est.unitHigh, 134526870);
  const pyeong = 140.8 / 3.3058;
  assert.strictEqual(est.mid, Math.round(94367172 * pyeong), '중앙 추정 = 평당 중앙값 × 토지 평');
  assert.ok(est.low < est.mid && est.mid < est.high);
  assert.ok(est.note.includes('감정평가 아님'), '감정평가 아님 표시');
  assert.ok(est.deals.length <= 8 && est.deals.every((d) => d.landAreaSqm >= 70.4 && d.landAreaSqm <= 281.6));
  const few = price.estimateAchievablePrice({ landAreaSqm: 140.8, rows: rows.slice(6, 9) });
  assert.strictEqual(few.state, 'insufficient', '비교거래 5건 미만은 추정하지 않음');
  assert.strictEqual(few.low, undefined);
  assert.strictEqual(price.estimateAchievablePrice({ landAreaSqm: 0, rows }).state, 'no_land_area');
  if (!discoverySource.includes('estimateAchievablePrice({landAreaSqm:subjectLandAreaSqm,rows:marketRows,subjectDong})')) throw new Error('추정은 잘리기 전 전체 거래(marketRows)로 계산해야 합니다');
  const svc = readFileSync('src/services/publicPropertyDiscoveryService.ts', 'utf8');
  const block = svc.slice(svc.indexOf('ACHIEVABLE_PRICE_SOURCE_PREFIX}${propertyId}'), svc.indexOf('ACHIEVABLE_PRICE_SOURCE_PREFIX}${propertyId}') + 700);
  if (!block.includes("verificationStatus: 'estimated'") || !block.includes('daon_estimate_not_appraisal')) throw new Error('추정값은 estimated 상태의 Data Room 출처로만 저장');
  console.log('PASS price layers: achievable-price estimate (bulk merge, scale filter, IQR range)');
}

// Issue #37 phase 2: residential sale / jeonse / monthly candidates and complex comparison (executable).
const residentialLib = await import(new URL('../api/_lib/residentialTrades.mjs', import.meta.url).href);
const { residentialTypeFor } = await import(new URL('../api/property-discovery.mjs', import.meta.url).href);
const { normalizeResidentialDeal, residentialSummary, classifyRtmsResponse, residentialMarket, areaBandKey, RESIDENTIAL_APIS } = residentialLib;
const resolvedApt = { bun: '0237', ji: '0000', region3: '명륜2가', sigunguCd: '11110' };
const targetApt = { complexName: '명륜동주상복합아남아파트' };
const aptMeta = (dealKind) => ({ propertyType: 'apartment', dealKind, apiId: dealKind === 'sale' ? 'aptTrade' : 'aptRent' });
// Real sample row (AptRent, 2025-01, LAWD_CD 11110): deposit 43,500만원, monthlyRent 0 → jeonse.
const jeonse = normalizeResidentialDeal({ aptNm: '명륜동주상복합아남아파트', buildYear: '1999', contractTerm: '', contractType: ' ', dealDay: '20', dealMonth: '1', dealYear: '2025', deposit: '43,500', excluUseAr: '50.49', floor: '2', jibun: '237', monthlyRent: '0', sggCd: '11110', umdNm: '명륜2가' }, aptMeta('rent'), resolvedApt, targetApt);
assert.strictEqual(jeonse.dealKind, 'jeonse');
assert.strictEqual(jeonse.deposit, 435_000_000, '보증금 만원→KRW');
assert.strictEqual(jeonse.sourceDepositTenThousandWon, 43_500);
assert.strictEqual(jeonse.amountSourceUnit, '만원');
assert.strictEqual(jeonse.dealDate, '2025-01-20');
assert.strictEqual(jeonse.matchLevel, 'exact_lot');
assert.strictEqual(jeonse.complexMatch, 'lot_and_name');
assert.strictEqual(jeonse.comparableExclusion, undefined, 'contractType 공백은 해제가 아님');
const monthly = normalizeResidentialDeal({ aptNm: '명륜동주상복합아남아파트', dealYear: '2025', dealMonth: '2', dealDay: '3', deposit: '5,000', excluUseAr: '50.12', jibun: '237', monthlyRent: '120', umdNm: '명륜2가' }, aptMeta('rent'), resolvedApt, targetApt);
assert.strictEqual(monthly.dealKind, 'monthly');
assert.strictEqual(monthly.monthlyRent, 1_200_000, '월세 만원→KRW');
assert.strictEqual(monthly.deposit, 50_000_000);
const sale = normalizeResidentialDeal({ aptNm: '명륜동주상복합 아남아파트', dealAmount: '87,000', dealYear: '2025', dealMonth: '1', dealDay: '5', excluUseAr: '50.49', jibun: '237', umdNm: '명륜2가', cdealType: '' }, aptMeta('sale'), resolvedApt, targetApt);
assert.strictEqual(sale.dealAmount, 870_000_000);
assert.strictEqual(sale.sourceDealAmountTenThousandWon, 87_000);
assert.strictEqual(sale.complexMatch, 'lot_and_name', '공백·"아파트" 접미 차이는 같은 단지명');
assert.strictEqual(sale.pricePerPyeong, Math.round(870_000_000 / (50.49 / 3.3058)));
const cancelledSale = normalizeResidentialDeal({ aptNm: '명륜동주상복합아남아파트', dealAmount: '10,000', dealYear: '2025', dealMonth: '1', dealDay: '7', excluUseAr: '50.3', jibun: '237', umdNm: '명륜2가', cdealType: 'O' }, aptMeta('sale'), resolvedApt, targetApt);
assert.strictEqual(cancelledSale.comparableExclusion, 'cancelled');
const blankAmount = normalizeResidentialDeal({ aptNm: 'x', dealAmount: ' ', dealYear: '2025', dealMonth: '1', dealDay: '1', excluUseAr: '84', jibun: '1', umdNm: '명륜2가' }, aptMeta('sale'), resolvedApt, targetApt);
assert.strictEqual(blankAmount.dealAmount, undefined, '공백 금액은 0원이 아니라 결측');
const otherComplex = normalizeResidentialDeal({ aptNm: '다른아파트', dealAmount: '120,000', dealYear: '2025', dealMonth: '1', dealDay: '9', excluUseAr: '84.9', jibun: '12', umdNm: '명륜2가' }, aptMeta('sale'), resolvedApt, targetApt);
assert.strictEqual(otherComplex.complexMatch, 'none');
assert.strictEqual(otherComplex.matchLevel, 'same_dong_candidate');
const masked = normalizeResidentialDeal({ mhouseNm: '21스타캐슬', houseType: '다세대', dealAmount: '47,000', dealYear: '2025', dealMonth: '1', dealDay: '24', excluUseAr: '59.75', landAr: '40.93', jibun: '5**', umdNm: '숭인동' }, { propertyType: 'row_house', dealKind: 'sale', apiId: 'rhTrade' }, { bun: '0581', ji: '0000', region3: '숭인동' }, { complexName: '' });
assert.strictEqual(masked.matchLevel, 'masked_address_candidate', '마스킹 지번은 후보');
assert.strictEqual(masked.complexName, '21스타캐슬');
assert.strictEqual(masked.landAreaSqm, 40.93, 'RHTrade landAr 대지권면적');
assert.strictEqual(areaBandKey(59.97), areaBandKey(59.12), '같은 59㎡대');
assert.notStrictEqual(areaBandKey(59.97), areaBandKey(84.97));

const summary37 = residentialSummary([jeonse, monthly, sale, cancelledSale, otherComplex]);
assert.strictEqual(summary37.complexCandidateCount, 4, '다른 단지는 단지 비교에서 제외');
const band50 = summary37.areaBands.find((band) => band.key === '50');
assert.ok(band50, '50㎡대 면적 그룹');
assert.strictEqual(band50.sale.count, 2);
assert.strictEqual(band50.sale.comparableCount, 1, '해제 거래는 중앙값 제외');
assert.strictEqual(band50.sale.medianDealAmount, 870_000_000, '해제 거래(1억)가 중앙값에 섞이면 안 됨');
assert.strictEqual(band50.jeonse.medianDeposit, 435_000_000);
assert.strictEqual(band50.monthly.medianMonthlyRent, 1_200_000);
assert.strictEqual(band50.jeonseRatioPercent, 50, '전세가율 = 전세 중앙값 ÷ 매매 중앙값 (계산값)');
assert.strictEqual(band50.jeonseRatioBasis, 'calculated_median_jeonse_over_median_sale');
assert.strictEqual(summary37.neighbourhood.sale.count, 3, '동 전체 후보에는 다른 단지 포함');

assert.strictEqual(classifyRtmsResponse(403, 'Forbidden').state, 'not_authorized');
assert.strictEqual(classifyRtmsResponse(200, '<OpenAPI_ServiceResponse><cmmMsgHeader><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg></cmmMsgHeader></OpenAPI_ServiceResponse>').state, 'not_authorized');
assert.strictEqual(classifyRtmsResponse(200, '<response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header><body><items></items></body></response>').state, 'ok');
assert.strictEqual(classifyRtmsResponse(200, '<response><header><resultCode>99</resultCode><resultMsg>SYSTEM ERROR</resultMsg></header></response>').state, 'error');
assert.strictEqual(classifyRtmsResponse(500, '').state, 'error');

assert.strictEqual(residentialTypeFor({ type: 'apartment' }), 'apartment');
assert.strictEqual(residentialTypeFor({ type: 'commercial_office' }), null, '상가·업무에는 주거 API 호출 안 함');
assert.strictEqual(residentialTypeFor({ type: 'land' }), null);
assert.strictEqual(residentialTypeFor({ type: 'mixed', candidates: ['commercial_office', 'row_house'] }), 'row_house');
for (const type of ['apartment', 'row_house', 'officetel', 'detached']) {
  assert.deepStrictEqual(RESIDENTIAL_APIS[type].map((api) => api.dealKind), ['sale', 'rent'], `${type}: 매매·전월세 API 쌍`);
}

// Unapproved rent API must surface as not_authorized, never as "0 transactions"; approved sale API still yields rows.
const fakeXml = (rows) => `<response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header><body><items>${rows.map((row) => `<item>${Object.entries(row).map(([k, v]) => `<${k}>${v}</${k}>`).join('')}</item>`).join('')}</items></body></response>`;
const tinyXmlItems = (xml) => [...String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => Object.fromEntries([...m[1].matchAll(/<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g)].map((x) => [x[1], x[2]])));
const calls = [];
const fakeFetch = async (url) => {
  calls.push(url);
  if (url.includes('RTMSDataSvcAptRent')) return { status: 403, text: async () => 'Forbidden' };
  return { status: 200, text: async () => fakeXml([{ aptNm: '명륜동주상복합아남아파트', dealAmount: '87,000', dealYear: '2025', dealMonth: '1', dealDay: '5', excluUseAr: '50.49', jibun: '237', umdNm: '명륜2가' }]) };
};
const market37 = await residentialMarket({ propertyType: 'apartment', resolved: resolvedApt, key: 'TEST', months: ['202501', '202412'], target: targetApt, xmlItems: tinyXmlItems, fetcher: fakeFetch });
assert.strictEqual(market37.apiStatus.aptRent.status, 'not_authorized', '미승인 API는 not_authorized');
assert.strictEqual(market37.apiStatus.aptTrade.status, 'ok');
assert.strictEqual(market37.complexDeals.length, 2, '승인된 매매 API 2개월 × 1건');
assert.ok(calls.every((url) => url.startsWith('https://apis.data.go.kr/1613000/RTMSDataSvcApt')), '아파트 유형은 아파트 API만 호출');
assert.ok(market37.interpretation.includes('후보'), '후보 의미 명시');
assert.strictEqual(await residentialMarket({ propertyType: 'commercial_office', resolved: resolvedApt, key: 'T', months: [], target: {}, xmlItems: tinyXmlItems, fetcher: fakeFetch }), null);
if (!discoverySource.includes('residentialTypeFor(propertyType)')) throw new Error('주거 API는 유형 판정 후에만 호출해야 합니다');

// R-ONE (한국부동산원 부동산통계) read-only proxy — owner request 2026-11-03 (executable).
{
  const rone = await import(new URL('../api/_lib/roneStats.mjs', import.meta.url).href);
  const u = new URL(rone.buildRoneUrl('data', new URLSearchParams({ STATBL_ID: 'A_2024_00900', DTACYCLE_CD: 'YY', KEY: 'attacker', SERVICE: 'x' }), 'SERVERKEY'));
  assert.strictEqual(u.origin + u.pathname, 'https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do');
  assert.strictEqual(u.searchParams.get('KEY'), 'SERVERKEY', '키는 서버 환경변수만 사용(요청 파라미터 무시)');
  assert.strictEqual(u.searchParams.get('SERVICE'), null, '허용 목록 밖 파라미터는 전달하지 않음');
  assert.strictEqual(u.searchParams.get('Type'), 'json');
  assert.throws(() => rone.buildRoneUrl('data', new URLSearchParams({ STATBL_ID: 'A&KEY=1', DTACYCLE_CD: 'YY' }), ''), /형식/);
  assert.throws(() => rone.buildRoneUrl('items', new URLSearchParams({}), ''), /STATBL_ID/);
  assert.throws(() => rone.buildRoneUrl('drop', new URLSearchParams({}), ''), /op/);
  assert.strictEqual(new URL(rone.buildRoneUrl('tables', new URLSearchParams({ pSize: '99999' }), '')).searchParams.get('pSize'), '100', 'pSize 상한');
  // Envelope shapes observed 2026-11-03 (sample mode from GitHub runner).
  const ok = rone.parseRoneResponse('tables', 200, JSON.stringify({ SttsApiTbl: [{ head: [{ list_total_count: 769 }, { RESULT: { CODE: 'INFO-000', MESSAGE: '정상 처리되었습니다.' } }] }, { row: [{ STATBL_ID: 'A_2024_00900', STATBL_NM: '(연) 지역별 지가지수', DTACYCLE_CD: 'YY' }] }] }));
  assert.ok(ok.ok && ok.total === 769 && ok.rows[0].STATBL_ID === 'A_2024_00900');
  const err = rone.parseRoneResponse('items', 200, JSON.stringify({ RESULT: { CODE: 'ERROR-300', MESSAGE: '필수 값이 누락되어 있습니다.' } }));
  assert.ok(!err.ok && err.code === 'ERROR-300');
  assert.ok(!rone.parseRoneResponse('data', 500, '<html>').ok);
  const proxy = read('api/rone-stats.mjs');
  const responses = proxy.split('\n').filter((line) => line.includes('sendJson(') || line.includes('fail('));
  if (!proxy.includes("process.env.RONE_API_KEY") || responses.some((line) => /\burl\b/.test(line))) throw new Error('R-ONE 키는 서버 전용이며 요청 URL을 응답에 넣으면 안 됩니다');
  if (!read('.env.example').includes('RONE_API_KEY=') || !read('scripts/scan-build-secrets.mjs').includes('process.env.RONE_API_KEY')) throw new Error('RONE_API_KEY 서버 전용 등록·빌드 비밀 스캔 누락');
  console.log('PASS R-ONE read-only proxy (key server-only, whitelisted params)');
}

// 2026-11-05 owner test (여의도동 14-26): without landUseZones the Property zoning must be the primary district, not the
// joined overlay list (대공방어협조구역, 과밀억제권역, … 일반상업지역).
if (!/\|\| landProfile\?\.primaryUseZone\n/.test(service) || /\|\| landProfile\?\.useZones\?\.join\(', '\)/.test(service)) {
  throw new Error('용도지역은 landUseZones → primaryUseZone 순으로 정해야 하며, 중첩 구역 전체 목록을 그대로 쓰면 안 됩니다.');
}

console.log('PASS public property discovery contract');
console.log('PASS MOLIT dealAmount 만원→KRW normalization regression');
console.log('PASS residential sale/jeonse/monthly complex comparison (Issue #37 phase 2)');
