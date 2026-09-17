import { existsSync, readFileSync } from 'node:fs';

const files = {
  migration: 'supabase/migrations/20260916_auth_profiles_rls.sql',
  edge: 'supabase/functions/remote-auth-admin/index.ts',
  readme: 'supabase/functions/remote-auth-admin/README.md',
  provider: 'src/services/authProviderService.ts',
};

for (const file of Object.values(files)) {
  if (!existsSync(file)) throw new Error(`REMOTE AUTH admin 필수 파일 누락: ${file}`);
}

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readFileSync(file, 'utf8')]));

for (const marker of [
  "default 'viewer'",
  'daon_handle_new_user()',
  'daon_is_owner()',
  'No anonymous policies are created',
  'Do NOT expose service_role credentials to the browser',
]) {
  if (!text.migration.includes(marker)) throw new Error(`Auth migration 보안 규칙 누락: ${marker}`);
}

for (const marker of [
  "Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')",
  "Deno.env.get('DAON_OWNER_BOOTSTRAP_KEY')",
  "Deno.env.get('AUTH_ADMIN_ALLOWED_ORIGINS')",
  'DAON_OWNER_BOOTSTRAP_KEY.length < 32',
  'timingSafeEqualText',
  'await authenticatedUser(req)',
  "profile.role !== 'owner'",
  "case 'bootstrap_owner'",
  "case 'invite_user'",
  "case 'update_role'",
  "case 'set_active'",
  "case 'list_profiles'",
  "throw new Error('bootstrap_already_completed')",
  "throw new Error('last_active_owner_protected')",
  'inviteUserByEmail',
  "'cache-control': 'no-store'",
  'AUTH_ADMIN_ALLOWED_ORIGINS.includes(origin)',
]) {
  if (!text.edge.includes(marker)) throw new Error(`Remote Auth admin 보안 규칙 누락: ${marker}`);
}

if (text.edge.includes("'Access-Control-Allow-Origin': '*'")) {
  throw new Error('REMOTE AUTH admin Edge는 wildcard CORS를 사용하면 안 됩니다.');
}
if (/SUPABASE_SERVICE_ROLE_KEY\s*[:=].*VITE_/i.test(text.edge)) {
  throw new Error('service_role을 browser-safe 환경변수로 취급하면 안 됩니다.');
}

const bootstrapBlock = text.edge.match(/async function bootstrapOwner\([\s\S]*?\n\}\n\nasync function inviteUser/)?.[0] ?? '';
if (!bootstrapBlock) throw new Error('bootstrapOwner handler를 찾을 수 없습니다.');
for (const marker of ['authenticatedUser(req)', 'timingSafeEqualText', 'activeOwnerCount() > 0']) {
  if (!bootstrapBlock.includes(marker)) throw new Error(`Owner bootstrap 안전장치 누락: ${marker}`);
}

const ownerContinuityBlock = text.edge.match(/async function ensureOwnerContinuity\([\s\S]*?\n\}/)?.[0] ?? '';
if (!ownerContinuityBlock.includes("target.role === 'owner'")) throw new Error('마지막 active OWNER 보호 로직이 필요합니다.');
if (!ownerContinuityBlock.includes('activeOwnerCount() <= 1')) throw new Error('마지막 active OWNER count 검증이 필요합니다.');

for (const marker of [
  'DEPLOYED / PRODUCTION CONNECTED',
  'supabase functions deploy remote-auth-admin',
  'Do **not** use `--no-verify-jwt`',
  'minimum 32 characters',
  'zero active OWNER profiles',
  'last active OWNER cannot be demoted',
  'last active OWNER cannot be deactivated',
  'rotate or remove `DAON_OWNER_BOOTSTRAP_KEY`',
  'no wildcard origin',
]) {
  if (!text.readme.includes(marker)) throw new Error(`REMOTE AUTH admin 배포 계약 누락: ${marker}`);
}

if (!text.provider.includes("label: 'REMOTE AUTH'")) throw new Error('Auth provider REMOTE AUTH 경계가 유지되어야 합니다.');
if (!text.provider.includes("status: 'ready'")) throw new Error('Production REMOTE AUTH provider는 ready 상태여야 합니다.');

console.log('REMOTE AUTH administration boundary: PASS');
