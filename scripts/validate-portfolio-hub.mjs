import { existsSync, readFileSync } from 'node:fs';

const files = {
  list: 'src/pages/PropertyList.tsx',
  hub: 'src/components/PortfolioOperationsHub.tsx',
  access: 'src/services/accessControlService.ts',
  shareProvider: 'src/services/externalShareProviderService.ts',
};

for (const file of Object.values(files)) {
  if (!existsSync(file)) throw new Error(`Portfolio hub 필수 파일 누락: ${file}`);
}

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readFileSync(file, 'utf8')]));

if (!text.list.includes('PortfolioOperationsHub') || !text.list.includes('<PortfolioOperationsHub items={items} />')) throw new Error('첫 화면에 Portfolio Operations Hub를 연결해야 합니다.');
for (const label of ['PORTFOLIO OPERATIONS HUB', '전체 물건', '기본정보 입력완료', '최근 7일 업데이트', '매매 물건']) {
  if (!text.hub.includes(label)) throw new Error(`Portfolio Hub KPI/표시 누락: ${label}`);
}
for (const label of ['Intake · Verification', '임대 · 수익', '검토 이력', '외부 공유', '보고서 이력', '3D · 도면', '사용자 · 권한', '엑셀 대량 등록']) {
  if (!text.hub.includes(label)) throw new Error(`Portfolio Hub Workspace 진입 항목 누락: ${label}`);
}
for (const path of ['/bulk-intake', '/income', '/review-history', '/external-shares', '/report-history', '/digital-twin-intake', '/access', '/import']) {
  if (!text.hub.includes(`path: '${path}'`)) throw new Error(`Portfolio Hub route 누락: ${path}`);
}
if (!text.hub.includes('AUTH NOT CONNECTED') || !text.hub.includes('REMOTE SHARE NOT CONFIGURED')) throw new Error('첫 화면은 Auth/Remote Share 미연결 경계를 명확히 표시해야 합니다.');
if (!text.hub.includes('property.address?.trim()') || !text.hub.includes('property.landAreaSqm > 0') || !text.hub.includes('property.totalFloorAreaSqm > 0') || !text.hub.includes('property.managerName?.trim()')) throw new Error('기본정보 입력완료 KPI는 실제 Property 필드 기준이어야 합니다.');
if (!text.access.includes('AUTH_BACKEND_CONNECTED = false')) throw new Error('Auth 상태 기준이 access service에서 제공되어야 합니다.');
if (!text.shareProvider.includes("availability: 'not_configured'")) throw new Error('Remote Share 상태 기준이 provider service에서 제공되어야 합니다.');

console.log('Portfolio operations hub integrity: PASS');
