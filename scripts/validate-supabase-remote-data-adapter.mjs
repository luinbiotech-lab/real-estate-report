import { existsSync, readFileSync } from 'node:fs';

const files = {
  adapter: 'src/services/supabaseRemoteDataGateway.ts',
  browserCredential: 'src/services/supabaseBrowserCredential.ts',
  gateway: 'src/services/remoteDataGateway.ts',
  dataMigration: 'supabase/migrations/20260916_property_data_rls.sql',
  assetMigration: 'supabase/migrations/20260916_property_asset_storage.sql',
};

for (const file of Object.values(files)) {
  if (!existsSync(file)) throw new Error(`Supabase remote adapter 필수 파일 누락: ${file}`);
}

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readFileSync(file, 'utf8')]));

for (const marker of [
  'export class SupabaseRemoteDataGateway',
  'export class SupabaseRemoteAssetStorageGateway',
  'createSupabaseRemoteDataGateway',
  'createSupabaseRemoteAssetStorageGateway',
  'requireBrowserSafeSupabaseKey',
  "Authorization: `Bearer ${token}`",
  'apikey: this.anonKey',
  "cache: 'no-store'",
  "const ASSET_BUCKET = 'daon-property-assets'",
  '50 * 1024 * 1024',
  "url.protocol !== 'https:'",
  'getAccessToken: () => Promise<string | null>',
  'getActorId: () => Promise<string | null>',
  "created_by: actorId",
  "updated_by: actorId",
]) {
  if (!text.adapter.includes(marker)) throw new Error(`Supabase remote adapter 보안/계약 누락: ${marker}`);
}

for (const marker of [
  'export function requireBrowserSafeSupabaseKey',
  'decodeBase64Url',
  '/^sb_secret_/i.test(key)',
  '/service[_-]?role/i.test(key)',
  '/^sb_publishable_/i.test(key)',
  "role !== 'anon'",
  'legacy anon JWT',
]) {
  if (!text.browserCredential.includes(marker)) throw new Error(`Supabase browser credential 보안 경계 누락: ${marker}`);
}

for (const table of [
  'properties',
  'property_objects',
  'property_assets',
  'property_verification_candidates',
  'property_verifications',
  'report_snapshots',
  'company_settings',
]) {
  if (!text.adapter.includes(`'${table}'`)) throw new Error(`Supabase remote adapter table mapping 누락: ${table}`);
}

for (const forbidden of [
  'SUPABASE_SERVICE_ROLE_KEY',
  'service_role:',
  'localStorage.setItem',
  'sessionStorage.setItem',
]) {
  if (text.adapter.includes(forbidden)) throw new Error(`Supabase remote adapter 금지 패턴 검출: ${forbidden}`);
}

if (!text.gateway.includes('new NotConfiguredRemoteDataGateway()')) {
  throw new Error('실제 backend 연결 전 기본 RemoteDataGateway는 NotConfigured 상태를 유지해야 합니다.');
}
if (text.gateway.includes('createSupabaseRemoteDataGateway(')) {
  throw new Error('Supabase adapter를 기본 gateway에 자동 연결하면 안 됩니다.');
}

for (const marker of ['created_by = auth.uid()', 'updated_by = auth.uid()', 'enable row level security']) {
  if (!text.dataMigration.includes(marker) && !text.assetMigration.includes(marker)) throw new Error(`RLS actor enforcement 누락: ${marker}`);
}
if (!text.assetMigration.includes("values ('daon-property-assets', 'daon-property-assets', false, 52428800)")) {
  throw new Error('Private asset bucket / 50MiB hard cap migration 경계가 유지되어야 합니다.');
}

console.log('Prepared Supabase remote data + private Storage adapter boundary: PASS');
