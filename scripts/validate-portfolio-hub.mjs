import { existsSync, readFileSync } from 'node:fs';

const files = {
  list: 'src/pages/PropertyList.tsx',
  control: 'src/pages/AgentControlCenterPage.tsx',
  layout: 'src/components/Layout.tsx',
  access: 'src/services/accessControlService.ts',
  shareProvider: 'src/services/externalShareProviderService.ts',
};

for (const file of Object.values(files)) {
  if (!existsSync(file)) throw new Error(`Portfolio/operations 필수 파일 누락: ${file}`);
}

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readFileSync(file, 'utf8')]));

for (const marker of [
  '물건 · Data Room',
  '물건을 찾고 열어 자료·검증·보고 흐름을 이어갑니다.',
  'property-list-summary',
  'property-focus-table',
  'MoreHorizRounded',
  'DA:ON 7P 상세보고서',
  'DA:ON 1P 요약제안서',
  '입지 브리핑',
]) {
  if (!text.list.includes(marker)) throw new Error(`집중형 Property List 계약 누락: ${marker}`);
}
if (text.list.includes('<PortfolioOperationsHub items={items} />')) {
  throw new Error('물건 목록은 운영 허브를 중복 노출하지 않아야 합니다.');
}

for (const marker of [
  '운영 홈',
  '지금 확인할 문제와 다음 작업만 먼저 보여줍니다.',
  'control-priority',
  'NEXT ACTION',
  'Agent 상세 상태',
  'Blocked Agent',
  'Review 대기',
  '/readiness',
]) {
  if (!text.control.includes(marker)) throw new Error(`운영 홈 집중형 IA 계약 누락: ${marker}`);
}

for (const marker of [
  '운영 홈',
  '물건 · Data Room',
  '등록 · 검증',
  '공간 · 3D',
  '분석 · 보고',
  '공유 · 관리',
]) {
  if (!text.layout.includes(marker)) throw new Error(`상위 navigation IA 누락: ${marker}`);
}

if (!text.access.includes('AUTH_BACKEND_CONNECTED = true')) throw new Error('Auth 상태 기준이 production connected 상태여야 합니다.');
if (!text.shareProvider.includes("availability: 'ready'")) throw new Error('Remote Share 상태 기준이 production ready 상태여야 합니다.');

console.log('Focused operations + property workspace integrity: PASS');
