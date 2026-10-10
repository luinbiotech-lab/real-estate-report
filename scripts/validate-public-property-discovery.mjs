import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const api = read('api/property-discovery.mjs');
const panel = read('src/components/PropertyPublicDiscoveryPanel.tsx');
const service = read('src/services/publicPropertyDiscoveryService.ts');
const form = read('src/pages/PropertyForm.tsx');
const valuePolicy = read('src/domain/professionalReport/valuePolicy.ts');
const discoveryPage = read('src/pages/PropertyDiscoveryPage.tsx');
const app = read('src/App.tsx');
const layout = read('src/components/Layout.tsx');

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
]) if (!api.includes(marker)) throw new Error(`Property discovery API marker missing: ${marker}`);

for (const marker of [
  '주소 · 지번으로 건물 자동조회',
  '현재 매물 여부',
  '실제 사용 / 점유 상태',
  '에너지 사용 흔적 있음',
  '공개 사용량 자료 없음',
  '동일 주소 영업 업소 관측',
  '건물 전체 사용상태 확정값으로 사용하지 않습니다',
  '공적정보 적용',
  '주소·좌표 적용',
  '건축물대장/국토부 실거래 자동조회',
]) if (!panel.includes(marker)) throw new Error(`Property discovery panel marker missing: ${marker}`);

for (const marker of [
  'public-address:',
  'building-register:',
  'public-market:',
  'building-energy:',
  'building_energy_usage_evidence',
  'occupancy_supporting_evidence_only',
  'operating-businesses:',
  'operating_business_evidence',
  'commercial_activity_supporting_evidence_only',
  "sourceType: 'public_api'",
  "sourceType: 'market_data'",
  'explicitFields',
]) if (!service.includes(marker)) throw new Error(`Property discovery provenance marker missing: ${marker}`);

if (!form.includes('<PropertyPublicDiscoveryPanel')) throw new Error('PropertyForm public discovery panel 연결 누락');
if (!form.includes('publicPropertyDiscoveryService.persist')) throw new Error('PropertyForm discovery provenance 저장 연결 누락');
if (!form.includes('location.state')) throw new Error('Discovery → PropertyForm state 전달 연결 누락');
if (!discoveryPage.includes('주소 · 지번으로 물건 조회') || !discoveryPage.includes('이 물건 등록')) throw new Error('Address-first discovery workspace contract 누락');
if (!app.includes('path="discover"')) throw new Error('Discovery route 누락');
if (!layout.includes('to="/discover"')) throw new Error('Discovery primary navigation 누락');
if (!valuePolicy.includes('Array.isArray(explicitFields)')) throw new Error('Report public-source explicitFields provenance 연결 누락');

console.log('PASS public property discovery contract');
