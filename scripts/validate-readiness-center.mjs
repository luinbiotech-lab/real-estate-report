import { existsSync, readFileSync } from 'node:fs';

const files = {
  app: 'src/App.tsx',
  layout: 'src/components/Layout.tsx',
  hub: 'src/components/PortfolioOperationsHub.tsx',
  page: 'src/pages/PropertyReadinessCenterPage.tsx',
  service: 'src/services/propertyReadinessService.ts',
  repository: 'src/repositories/propertyDataRoomRepository.ts',
};
for (const file of Object.values(files)) if (!existsSync(file)) throw new Error(`Readiness 필수 파일 누락: ${file}`);
const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readFileSync(file, 'utf8')]));

if (!text.app.includes('path="readiness"') || !text.app.includes('PropertyReadinessCenterPage')) throw new Error('Readiness Center route가 필요합니다.');
if (!text.layout.includes('to="/readiness"') || !text.layout.includes('Property Readiness')) throw new Error('Readiness Center navigation이 필요합니다.');
if (!text.hub.includes("path: '/readiness'") || !text.hub.includes('준비도 센터')) throw new Error('Portfolio Hub에서 Readiness Center로 이동할 수 있어야 합니다.');
if (!text.repository.includes('getBundle(propertyId: string)')) throw new Error('Readiness는 Data Room bundle을 실제 저장소에서 읽어야 합니다.');

for (const id of ["'core'", "'documents'", "'provenance'", "'verification'", "'media'", "'report'", "'digital_twin'"]) {
  if (!text.service.includes(id)) throw new Error(`Readiness stage 누락: ${id}`);
}
for (const label of ['기본정보', '문서', '구조화 / 출처', '검증', '미디어', '보고서', '3D / Digital Twin']) {
  if (!text.service.includes(`label: '${label}'`)) throw new Error(`Readiness stage label 누락: ${label}`);
}
if (!text.service.includes("bundle.verifications.length > 0 ? 'ready' : bundle.verificationCandidates.length > 0 ? 'partial' : 'missing'")) throw new Error('Verification 기록이 없는 imported/candidate 자료를 READY로 승격하면 안 됩니다.');
if (!text.service.includes("snapshot.status === 'ready'")) throw new Error('보고서 READY는 ready Snapshot 존재 여부로 판단해야 합니다.');
if (!text.service.includes('weighted = readyCount + partialCount * 0.5')) throw new Error('Readiness score는 ready/partial/missing 상태에서 계산되어야 합니다.');

for (const label of ['Property Readiness Center', '보완 필요', '평균 준비도']) {
  if (!text.page.includes(label)) throw new Error(`Readiness UI 필수 표시 누락: ${label}`);
}
if (!text.page.includes('readiness.stages.map((stage)')) throw new Error('Readiness stage 정의를 화면에서 동적으로 렌더해야 합니다.');
if (!text.page.includes('Verification이 없는 imported 자료는 검증 완료로 승격하지 않습니다')) throw new Error('imported와 verified 상태를 구분하는 안전문구가 필요합니다.');
if (!text.page.includes("navigate(`/property/${propertyId}/data-room${stage.pathSuffix || ''}`)")) throw new Error('Readiness stage에서 해당 Data Room 보완 화면으로 이동할 수 있어야 합니다.');

console.log('Property readiness center integrity: PASS');
