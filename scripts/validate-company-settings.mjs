import { existsSync, readFileSync } from 'node:fs';

const files = {
  settingsPage: 'src/pages/SettingsPage.tsx',
  types: 'src/types.ts',
  app: 'src/App.tsx',
  propertyForm: 'src/pages/PropertyForm.tsx',
};
for (const file of Object.values(files)) if (!existsSync(file)) throw new Error(`회사 설정 필수 파일 누락: ${file}`);
const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readFileSync(file, 'utf8')]));

for (const token of ['BRAND IDENTITY', 'DEFAULT CONTACT', 'REPORT POLICY', 'REPORT CONTACT PREVIEW', 'APPLY SCOPE']) {
  if (!text.settingsPage.includes(token)) throw new Error(`회사 설정 UI 필수 섹션 누락: ${token}`);
}
if (!text.settingsPage.includes("reportContactMode: 'mobile_email_only'") || !text.settingsPage.includes('휴대폰과 이메일만 사용합니다')) {
  throw new Error('보고서 연락처는 휴대폰 + 이메일 정책으로 고정되어야 합니다.');
}
if (!text.settingsPage.includes('기존 물건 담당자 자동 덮어쓰기 없음')) throw new Error('기존 물건 담당자 보존 원칙을 UI에 명시해야 합니다.');
if (!text.types.includes("reportContactMode: 'mobile_email_only'")) throw new Error('Settings 타입에 reportContactMode 고정 정책이 필요합니다.');
if (!text.types.includes('brandSlogan: string')) throw new Error('Settings 타입에 브랜드 슬로건이 필요합니다.');
if (!text.app.includes("reportContactMode: 'mobile_email_only'")) throw new Error('App 기본설정은 mobile_email_only 정책을 강제해야 합니다.');
if (!text.app.includes('...defaults, ...(stored ?? {})')) throw new Error('기존 브라우저 설정을 새 스키마로 안전하게 정규화해야 합니다.');
if (!text.propertyForm.includes('managerName: settings.defaultManager') || !text.propertyForm.includes('managerPhone: settings.phone') || !text.propertyForm.includes('managerEmail: settings.email')) {
  throw new Error('새 물건 등록은 회사 설정의 기본 담당자/휴대폰/이메일을 사용해야 합니다.');
}

console.log('Company settings + report contact policy integrity: PASS');
