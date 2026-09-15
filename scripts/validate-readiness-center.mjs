import { existsSync, readFileSync } from 'node:fs';

const files = {
  app: 'src/App.tsx', layout: 'src/components/Layout.tsx', hub: 'src/components/PortfolioOperationsHub.tsx',
  page: 'src/pages/PropertyReadinessCenterPage.tsx', service: 'src/services/propertyReadinessService.ts',
  nextAction: 'src/services/propertyNextActionService.ts', worklog: 'src/services/propertyReadinessWorklogService.ts',
  repository: 'src/repositories/propertyDataRoomRepository.ts',
};
for (const file of Object.values(files)) if (!existsSync(file)) throw new Error(`Readiness 필수 파일 누락: ${file}`);
const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readFileSync(file, 'utf8')]));

if (!text.app.includes('path="readiness"') || !text.app.includes('PropertyReadinessCenterPage')) throw new Error('Readiness Center route가 필요합니다.');
if (!text.layout.includes('to="/readiness"') || !text.layout.includes('Property Readiness')) throw new Error('Readiness Center navigation이 필요합니다.');
if (!text.hub.includes("path: '/readiness'") || !text.hub.includes('준비도 센터')) throw new Error('Portfolio Hub에서 Readiness Center로 이동할 수 있어야 합니다.');
if (!text.repository.includes('getBundle(propertyId: string)')) throw new Error('Readiness는 Data Room bundle을 실제 저장소에서 읽어야 합니다.');

for (const id of ["'core'", "'documents'", "'provenance'", "'verification'", "'media'", "'report'", "'digital_twin'"]) if (!text.service.includes(id)) throw new Error(`Readiness stage 누락: ${id}`);
for (const label of ['기본정보', '문서', '구조화 / 출처', '검증', '미디어', '보고서', '3D / Digital Twin']) if (!text.service.includes(`label: '${label}'`)) throw new Error(`Readiness stage label 누락: ${label}`);
if (!text.service.includes("bundle.verifications.length > 0 ? 'ready' : bundle.verificationCandidates.length > 0 ? 'partial' : 'missing'")) throw new Error('Verification 기록이 없는 imported/candidate 자료를 READY로 승격하면 안 됩니다.');
if (!text.service.includes("snapshot.status === 'ready'")) throw new Error('보고서 READY는 ready Snapshot 존재 여부로 판단해야 합니다.');
if (!text.service.includes('weighted = readyCount + partialCount * 0.5')) throw new Error('Readiness score는 ready/partial/missing 상태에서 계산되어야 합니다.');

if (!text.nextAction.includes(".filter((stage): stage is ReadinessStage & { state: 'missing' | 'partial' } => stage.state !== 'ready')")) throw new Error('Next Action Queue는 READY 항목을 제외해야 합니다.');
if (!text.nextAction.includes("left.state === 'missing' ? 0 : 1") || !text.nextAction.includes('left.workflowOrder - right.workflowOrder')) throw new Error('Next Action Queue는 MISSING 우선 + workflow 순으로 정렬해야 합니다.');
for (const pair of ["core: 1", "documents: 2", "provenance: 3", "verification: 4", "media: 5", "report: 6", "digital_twin: 7"]) if (!text.nextAction.includes(pair)) throw new Error(`Next Action workflow 순서 누락: ${pair}`);
if (!text.nextAction.includes("return `/property/${propertyId}/data-room${stage.pathSuffix || ''}`")) throw new Error('Next Action은 해당 보완 화면으로 직접 연결되어야 합니다.');

if (!text.worklog.includes("STORAGE_KEY = 'daon:property-readiness-worklog:v1'")) throw new Error('Readiness 작업 이력은 버전된 local-first 저장소를 사용해야 합니다.');
if (!text.worklog.includes("status: 'open' | 'improved' | 'completed'")) throw new Error('Readiness 작업 이력은 OPEN/IMPROVED/COMPLETED 상태를 가져야 합니다.');
if (!text.worklog.includes('stateRank[stage.state] > stateRank[entry.initialState]')) throw new Error('작업 개선은 실제 readiness state 상승으로만 판정해야 합니다.');
if (!text.worklog.includes("stage.state === 'ready' ? 'completed' : improved ? 'improved' : 'open'")) throw new Error('COMPLETED는 실제 READY 상태에서만 판정해야 합니다.');
if (!text.worklog.includes('recordOpened(action: PropertyNextAction)') || !text.worklog.includes('reconcile(rows:')) throw new Error('작업 오픈 기록과 실제 데이터 재검사 경로가 필요합니다.');

for (const label of ['Property Readiness Center', '보완 필요', '평균 준비도', 'NEXT ACTION QUEUE', '준비도 기반 다음 작업', 'RECENT PROGRESS', '실제 데이터 변화로 확인된 진행', '재검사 / 새로고침']) if (!text.page.includes(label)) throw new Error(`Readiness UI 필수 표시 누락: ${label}`);
if (!text.page.includes('derivePropertyNextActions(rows)')) throw new Error('Readiness Center는 Next Action Queue를 readiness 데이터에서 파생해야 합니다.');
if (!text.page.includes('propertyReadinessWorklogService.recordOpened(action)')) throw new Error('보완 화면 진입 시 작업 이력을 기록해야 합니다.');
if (!text.page.includes('propertyReadinessWorklogService.reconcile(sorted)')) throw new Error('Readiness 재검사 시 작업 이력을 실제 상태와 대조해야 합니다.');
if (!text.page.includes('Verification이 없는 imported 자료는 검증 완료로 승격하지 않습니다')) throw new Error('imported와 verified 상태를 구분하는 안전문구가 필요합니다.');
if (!text.page.includes('작업 완료도 실제 readiness 변화가 확인될 때만 기록됩니다')) throw new Error('수동 완료가 아닌 실제 상태 변화 원칙을 명시해야 합니다.');

console.log('Property readiness + closed-loop next action integrity: PASS');
