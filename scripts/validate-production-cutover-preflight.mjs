import { existsSync, readFileSync } from 'node:fs';

const files = {
  workflow: '.github/workflows/production-cutover-preflight.yml',
  script: 'scripts/production-cutover-preflight.mjs',
};
for (const file of Object.values(files)) if (!existsSync(file)) throw new Error(`Cutover preflight file missing: ${file}`);

const workflow = readFileSync(files.workflow, 'utf8');
const script = readFileSync(files.script, 'utf8');

for (const marker of [
  'workflow_dispatch:',
  'VERCEL_TOKEN',
  'VERCEL_ORG_ID',
  'VERCEL_PROJECT_ID',
  'SUPABASE_MANAGEMENT_TOKEN',
  'DAON_PRODUCTION_OWNER_EMAIL',
  'DAON_PRODUCTION_OWNER_PASSWORD',
  'npm run test:prod-http',
  'Production write: NOT PERFORMED',
]) if (!workflow.includes(marker)) throw new Error(`Cutover preflight workflow marker missing: ${marker}`);

for (const marker of [
  'vercelDeploymentCredentialsReady',
  'supabaseAuthSecurityCredentialReady',
  'productionOwnerCredentialReady',
  'writesPerformed: 0',
  "url.protocol === 'https:'",
]) if (!script.includes(marker)) throw new Error(`Cutover preflight script marker missing: ${marker}`);

for (const forbidden of ['sb_secret_', 'service_role', 'password = \'', 'token = \'']) {
  if (workflow.includes(forbidden) || script.includes(forbidden)) throw new Error(`Cutover preflight must not hardcode secret material: ${forbidden}`);
}

console.log('Production cutover preflight contract: PASS');
