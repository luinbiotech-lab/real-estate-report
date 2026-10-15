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
if (!discoveryPage.includes('공공자료 Data Room 저장') || !discoveryPage.includes('refreshExisting(existing, result)')) throw new Error('기존 물건 공공자료 refresh UI 연결 누락');
if (!form.includes('location.state')) throw new Error('Discovery → PropertyForm state 전달 연결 누락');
if (!discoveryPage.includes('주소 · 지번으로 물건 조회') || !discoveryPage.includes('이 물건 등록')) throw new Error('Address-first discovery workspace contract 누락');
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
if (!propertyHub.includes('개별공시지가') || !propertyHub.includes('공시지가 기준 토지가액')) throw new Error('Property Hub 공시지가 노출 누락');
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

console.log('PASS public property discovery contract');
console.log('PASS MOLIT dealAmount 만원→KRW normalization regression');
