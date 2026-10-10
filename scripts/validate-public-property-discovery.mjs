import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const api = read('api/property-discovery.mjs');
const panel = read('src/components/PropertyPublicDiscoveryPanel.tsx');
const service = read('src/services/publicPropertyDiscoveryService.ts');
const form = read('src/pages/PropertyForm.tsx');
const valuePolicy = read('src/domain/professionalReport/valuePolicy.ts');

for (const marker of [
  "KAKAO_ADDRESS",
  "BldRgstHubService",
  "RTMSDataSvcNrgTrade",
  "RTMSDataSvcLandTrade",
  "DATA_GO_KR_SERVICE_KEY",
  "getBrTitleInfo",
  "getBrFlrOulnInfo",
  "publicDataConfigured",
  "sigunguCd",
  "bjdongCd",
]) if (!api.includes(marker)) throw new Error(`Property discovery API marker missing: ${marker}`);

for (const marker of [
  '주소 · 지번으로 건물 자동조회',
  '현재 매물 여부',
  '실제 사용 / 점유 상태',
  '공적정보 적용',
  '주소·좌표 적용',
  '건축물대장/국토부 실거래 자동조회',
]) if (!panel.includes(marker)) throw new Error(`Property discovery panel marker missing: ${marker}`);

for (const marker of [
  'public-address:',
  'building-register:',
  'public-market:',
  "sourceType: 'public_api'",
  "sourceType: 'market_data'",
  'explicitFields',
]) if (!service.includes(marker)) throw new Error(`Property discovery provenance marker missing: ${marker}`);

if (!form.includes('<PropertyPublicDiscoveryPanel')) throw new Error('PropertyForm public discovery panel 연결 누락');
if (!form.includes('publicPropertyDiscoveryService.persist')) throw new Error('PropertyForm discovery provenance 저장 연결 누락');
if (!valuePolicy.includes('Array.isArray(explicitFields)')) throw new Error('Report public-source explicitFields provenance 연결 누락');

console.log('PASS public property discovery contract');
