import { existsSync, readFileSync } from 'node:fs';

const files = {
  workflow: '.github/workflows/production-browser-acceptance.yml',
  script: 'scripts/production-browser-acceptance.mjs',
};
for (const file of Object.values(files)) if (!existsSync(file)) throw new Error(`Production browser acceptance 필수 파일 누락: ${file}`);

const workflow = readFileSync(files.workflow, 'utf8');
const scriptText = readFileSync(files.script, 'utf8');

for (const marker of [
  'workflow_dispatch:',
  'production_base_url:',
  'DAON_PRODUCTION_OWNER_EMAIL',
  'DAON_PRODUCTION_OWNER_PASSWORD',
  'secrets.DAON_PRODUCTION_OWNER_EMAIL',
  'secrets.DAON_PRODUCTION_OWNER_PASSWORD',
  'production-browser-acceptance.mjs',
]) {
  if (!workflow.includes(marker)) throw new Error(`Production browser acceptance workflow marker 누락: ${marker}`);
}

for (const marker of [
  "base.protocol !== 'https:'",
  'browser.newContext()',
  "signInAndVerify(deviceA, 'device-A')",
  "signInAndVerify(deviceB, 'device-B')",
  "getByLabel('이메일')",
  "getByLabel('비밀번호')",
  "getByRole('button', { name: 'Production 로그인', exact: true })",
  "'/migration-readiness'",
  "'/backup'",
  "'/external-shares'",
  'DRY-RUN NETWORK WRITES = 0',
  'independentBrowserContexts',
]) {
  if (!scriptText.includes(marker)) throw new Error(`Production browser acceptance marker 누락: ${marker}`);
}

for (const forbidden of [
  'http://',
  'password = \'',
  'DAON_PRODUCTION_OWNER_PASSWORD=',
  'service_role',
  'sb_secret_',
]) {
  if (scriptText.includes(forbidden) || workflow.includes(forbidden)) {
    throw new Error(`Production browser acceptance에 금지된 하드코딩/secret marker가 있습니다: ${forbidden}`);
  }
}

console.log('Production two-context browser acceptance contract: PASS');
