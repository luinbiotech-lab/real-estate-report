import { existsSync, readFileSync } from 'node:fs';

const files = {
  app: 'src/App.tsx',
  layout: 'src/components/Layout.tsx',
  page: 'src/pages/AccessManagementPage.tsx',
  service: 'src/services/accessControlService.ts',
};

for (const file of Object.values(files)) {
  if (!existsSync(file)) throw new Error(`Access control 필수 파일 누락: ${file}`);
}

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readFileSync(file, 'utf8')]));

if (!text.app.includes('path="access"') || !text.app.includes('AccessManagementPage')) throw new Error('사용자·권한 관리 route가 필요합니다.');
if (!text.layout.includes('to="/access"') || !text.layout.includes('사용자 · 권한 관리')) throw new Error('사용자·권한 관리 navigation이 필요합니다.');

for (const role of ["'owner'", "'admin'", "'editor'", "'viewer'"]) {
  if (!text.service.includes(role)) throw new Error(`필수 역할 누락: ${role}`);
}
for (const capability of ['manage_users', 'manage_company', 'delete_property', 'finalize_report', 'manage_external_share', 'create_report_draft', 'verify_data', 'view_data']) {
  if (!text.service.includes(capability)) throw new Error(`필수 capability 누락: ${capability}`);
}
if (!text.service.includes('AUTH_BACKEND_CONNECTED = false')) throw new Error('Auth 미연결 상태를 과장 없이 표시해야 합니다.');
if (!text.service.includes("ACCESS_STORAGE_KEY = 'daon:access-profiles:v1'")) throw new Error('버전된 local-first access policy 저장소가 필요합니다.');
if (!text.service.includes("id: 'local-owner'") || !text.service.includes("role: 'owner'")) throw new Error('최소 1개의 로컬 OWNER 정책 seed가 필요합니다.');
if (!text.service.includes("target.id === 'local-owner' && role !== 'owner'")) throw new Error('로컬 OWNER 권한 해제 차단 규칙이 필요합니다.');
if (!text.service.includes("target.id === 'local-owner' && status !== 'active'")) throw new Error('로컬 OWNER 비활성화 차단 규칙이 필요합니다.');
if (!text.service.includes("viewer: ['view_data']")) throw new Error('VIEWER는 읽기 전용으로 유지해야 합니다.');

for (const label of ['사용자 · 권한 관리', 'LOCAL POLICY READY', 'AUTH NOT CONNECTED', 'ROLE MATRIX', 'ACCESS PROFILES']) {
  if (!text.page.includes(label)) throw new Error(`Access Management UI 필수 표시 누락: ${label}`);
}
if (!text.page.includes('실제 보안 경계는 부동산 전용 Auth + 서버 RLS 연결 후 강제됩니다')) throw new Error('로컬 정책과 실제 보안 경계를 혼동하지 않도록 경고해야 합니다.');

console.log('Access control policy integrity: PASS');
