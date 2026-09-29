import { existsSync, readFileSync } from 'node:fs';

const files = {
  workflow: '.github/workflows/enable-supabase-leaked-password-protection.yml',
  script: 'scripts/enable-supabase-leaked-password-protection.mjs',
};
for (const file of Object.values(files)) if (!existsSync(file)) throw new Error(`Supabase auth-security automation file missing: ${file}`);

const workflow = readFileSync(files.workflow, 'utf8');
const scriptText = readFileSync(files.script, 'utf8');

for (const marker of [
  'workflow_dispatch:',
  'ENABLE LEAKED PASSWORD PROTECTION',
  'SUPABASE_MANAGEMENT_TOKEN',
  'secrets.SUPABASE_MANAGEMENT_TOKEN',
  'neeqcfxjwotyiodrlzvq',
]) {
  if (!workflow.includes(marker)) throw new Error(`Supabase auth-security workflow marker missing: ${marker}`);
}

for (const marker of [
  "confirmation !== 'ENABLE LEAKED PASSWORD PROTECTION'",
  'https://api.supabase.com/v1/projects/',
  "method: 'PATCH'",
  'password_hibp_enabled: true',
  'payload.password_hibp_enabled !== true',
]) {
  if (!scriptText.includes(marker)) throw new Error(`Supabase auth-security script marker missing: ${marker}`);
}

for (const forbidden of ['sbp_', 'service_role', 'sb_secret_']) {
  if (scriptText.includes(forbidden) || workflow.includes(forbidden)) {
    throw new Error(`Supabase auth-security automation must not hardcode secret material: ${forbidden}`);
  }
}

console.log('Supabase leaked-password protection automation contract: PASS');
