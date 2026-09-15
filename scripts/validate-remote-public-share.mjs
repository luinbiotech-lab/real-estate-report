import { existsSync, readFileSync } from 'node:fs';

const files = {
  gateway: 'src/services/remoteExternalShareGateway.ts',
  migration: 'supabase/migrations/20260915_external_public_share.sql',
  edge: 'supabase/functions/remote-public-share/index.ts',
  edgeReadme: 'supabase/functions/remote-public-share/README.md',
};

for (const file of Object.values(files)) {
  if (!existsSync(file)) throw new Error(`REMOTE / PUBLIC share 필수 파일 누락: ${file}`);
}

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readFileSync(file, 'utf8')]));

for (const marker of [
  'export interface RemoteShareIssuedSession',
  'rawToken: string',
  'export interface RemoteShareRecord',
  'listForSnapshot(snapshotId: string): Promise<RemoteShareRecord[]>',
  'raw token must never be persisted',
]) {
  if (!text.gateway.includes(marker)) throw new Error(`Remote gateway contract 누락: ${marker}`);
}

const recordBlock = text.gateway.match(/export interface RemoteShareRecord \{([\s\S]*?)\n\}/)?.[1] ?? '';
if (!recordBlock) throw new Error('RemoteShareRecord 정의를 찾을 수 없습니다.');
if (/rawToken|publicUrl/.test(recordBlock)) throw new Error('감사/list용 RemoteShareRecord에는 rawToken/publicUrl이 포함되면 안 됩니다.');

for (const marker of [
  'snapshot_payload jsonb not null',
  'token_hash text not null unique',
  'external_share_sessions_token_hash_not_raw',
  'enable row level security',
  'Intentionally NO anon SELECT/INSERT/UPDATE/DELETE policies',
  'returns only the minimal snapshot_payload',
]) {
  if (!text.migration.includes(marker)) throw new Error(`Remote share migration 보안 규칙 누락: ${marker}`);
}
if (/\braw_token\b/i.test(text.migration)) throw new Error('Remote share migration에 raw_token 저장 컬럼을 만들면 안 됩니다.');

for (const marker of [
  "Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')",
  "Deno.env.get('PUBLIC_SHARE_BASE_URL')",
  "Deno.env.get('PUBLIC_SHARE_ALLOWED_ORIGINS')",
  'new Uint8Array(32)',
  'crypto.getRandomValues(bytes)',
  "crypto.subtle.digest('SHA-256'",
  "!['owner', 'admin'].includes(profile.role)",
  "case 'issue'",
  "case 'revoke'",
  "case 'list'",
  "case 'resolve'",
  "case 'add_review'",
  "if (row.revoked_at)",
  'new Date(row.expires_at).getTime() <= Date.now()',
  "snapshot_payload: snapshot.payload",
  "#token=${encodeURIComponent(rawToken)}",
  "'cache-control': 'no-store'",
  'PUBLIC_SHARE_ALLOWED_ORIGINS.includes(origin)',
]) {
  if (!text.edge.includes(marker)) throw new Error(`Remote share Edge 보안 규칙 누락: ${marker}`);
}

if (text.edge.includes("'Access-Control-Allow-Origin': '*'")) throw new Error('REMOTE / PUBLIC Edge는 wildcard CORS를 사용하면 안 됩니다.');

const insertPayloads = [...text.edge.matchAll(/\.insert\(\{([\s\S]*?)\}\)\s*\.select/g)].map((match) => match[1]);
if (!insertPayloads.length) throw new Error('Edge Function DB insert payload를 찾을 수 없습니다.');
for (const payload of insertPayloads) {
  if (/\brawToken\b|\braw_token\b/i.test(payload)) throw new Error('Edge Function이 raw token을 DB insert payload에 포함하면 안 됩니다.');
}

const listFunction = text.edge.match(/async function list\([\s\S]*?\n\}\n\nasync function resolve/)?.[0] ?? '';
if (!listFunction) throw new Error('Remote share list handler를 찾을 수 없습니다.');
if (/rawToken|publicUrl/.test(listFunction)) throw new Error('Remote share list handler는 rawToken/publicUrl을 반환하면 안 됩니다.');

for (const marker of [
  'PREPARED ONLY / NOT DEPLOYED',
  'supabase functions deploy remote-public-share --no-verify-jwt',
  'issue`, `revoke`, `list`',
  'resolve`, `add_review`',
  'Only `token_hash` is persisted',
  'List responses intentionally contain no raw token',
  'no wildcard origin',
]) {
  if (!text.edgeReadme.includes(marker)) throw new Error(`Remote share 배포 계약 누락: ${marker}`);
}

console.log('REMOTE / PUBLIC share Edge security boundary: PASS');
