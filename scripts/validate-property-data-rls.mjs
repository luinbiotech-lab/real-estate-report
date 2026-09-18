import { existsSync, readFileSync } from 'node:fs';

const files = {
  authMigration: 'supabase/migrations/20260916_auth_profiles_rls.sql',
  dataMigration: 'supabase/migrations/20260916_property_data_rls.sql',
  assetMigration: 'supabase/migrations/20260916_property_asset_storage.sql',
  hardeningMigration: 'supabase/migrations/20260918_restore_private_rls_hardening.sql',
  gateway: 'src/services/remoteDataGateway.ts',
  access: 'src/services/accessControlService.ts',
  database: 'src/repositories/database.ts',
};

for (const file of Object.values(files)) {
  if (!existsSync(file)) throw new Error(`Property/Data RLS 필수 파일 누락: ${file}`);
}

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readFileSync(file, 'utf8')]));

if (/for_each_table\s*:/i.test(text.dataMigration)) throw new Error('Property/Data migration에 실행 불가능한 placeholder SQL이 남아 있습니다.');
if (!text.dataMigration.trim().endsWith('commit;')) throw new Error('Property/Data migration은 transaction commit으로 종료되어야 합니다.');
if (!text.assetMigration.trim().endsWith('commit;')) throw new Error('Property asset migration은 transaction commit으로 종료되어야 합니다.');
if (!text.hardeningMigration.trim().endsWith('commit;')) throw new Error('Private RLS hardening migration은 transaction commit으로 종료되어야 합니다.');

for (const marker of [
  'create table if not exists public.properties',
  'create table if not exists public.property_objects',
  'create table if not exists public.property_verification_candidates',
  'create table if not exists public.property_verifications',
  'create table if not exists public.report_snapshots',
  'create table if not exists public.company_settings',
  'create or replace function public.daon_is_active_user()',
  'create or replace function public.daon_can_edit_data()',
  'create or replace function public.daon_can_verify_data()',
  'properties_delete_owner_only',
  'property_objects_insert_editor_plus',
  'verification_candidates_update_verifier',
  'property_verifications_insert_verifier',
  'report_snapshots_insert_role',
  'company_settings_update_owner',
  'No anonymous policies are created for any operational property/data table',
]) {
  if (!text.dataMigration.includes(marker)) throw new Error(`Property/Data RLS 규칙 누락: ${marker}`);
}

for (const table of ['properties', 'property_objects', 'property_verification_candidates', 'property_verifications', 'report_snapshots', 'company_settings']) {
  if (!text.dataMigration.includes(`alter table public.${table} enable row level security`)) {
    throw new Error(`RLS enable 누락: ${table}`);
  }
  if (!text.dataMigration.includes(`revoke all on public.${table} from anon`)) {
    throw new Error(`anon revoke 누락: ${table}`);
  }
}

if (!text.dataMigration.includes("decision_status = 'pending'")) throw new Error('EDITOR+ verification candidate는 pending으로만 제출되어야 합니다.');
if (!text.dataMigration.includes('public.daon_can_verify_data()')) throw new Error('Verification 결정은 verifier role 경계가 필요합니다.');
if (!text.dataMigration.includes("public.daon_current_role() = 'editor'::public.daon_access_role and status = 'draft'")) {
  throw new Error('EDITOR는 report draft만 생성할 수 있어야 합니다.');
}
if (text.dataMigration.includes('create policy "report_snapshots_update')) throw new Error('Report snapshot은 immutable이어야 하므로 UPDATE policy를 만들면 안 됩니다.');

for (const marker of [
  'create table if not exists public.property_assets',
  "resource_type in ('document', 'media', 'digital_twin')",
  'property_assets_no_inline_binary',
  "not (metadata ? 'fileData')",
  "left(coalesce(metadata ->> 'url', ''), 5) <> 'data:'",
  "left(coalesce(metadata ->> 'fileUrl', ''), 5) <> 'data:'",
  "values ('daon-property-assets', 'daon-property-assets', false, 52428800)",
  'daon_property_assets_storage_select',
  'daon_property_assets_storage_insert',
  'daon_property_assets_storage_update',
  'daon_property_assets_storage_delete',
  'No anon policies are created. Bucket remains private.',
]) {
  if (!text.assetMigration.includes(marker)) throw new Error(`Property asset storage 규칙 누락: ${marker}`);
}

const finalObjectTypeConstraint = text.assetMigration.match(/property_objects add constraint property_objects_type_allowed check \(object_type in \(([\s\S]*?)\)\);/)?.[1] ?? '';
if (!finalObjectTypeConstraint) throw new Error('최종 property_objects type constraint를 찾을 수 없습니다.');
for (const binaryStore of ['propertyDocuments', 'propertyMedia', 'digitalTwinAssets']) {
  if (finalObjectTypeConstraint.includes(`'${binaryStore}'`)) throw new Error(`${binaryStore} binary-bearing store를 property_objects JSONB에 허용하면 안 됩니다.`);
}

for (const localStore of ['propertyDocuments', 'propertyMedia', 'digitalTwinAssets']) {
  if (!text.database.includes(`'${localStore}'`)) throw new Error(`로컬 binary store 기준 누락: ${localStore}`);
}

for (const marker of [
  'export interface RemoteDataGateway',
  'listProperties(): Promise<Property[]>',
  'upsertProperty(property: Property)',
  'deleteProperty(propertyId: string)',
  'listObjects(propertyId: string',
  'listAssets(propertyId: string',
  'submitVerificationCandidate',
  'decideVerificationCandidate',
  'appendVerification',
  'createReportSnapshot',
  'getCompanySettings',
  'saveCompanySettings',
  'createSupabaseRemoteDataGateway(remoteDataConfig)',
  'createSupabaseRemoteAssetStorageGateway(remoteDataConfig)',
]) {
  if (!text.gateway.includes(marker)) throw new Error(`Remote Data Gateway contract 누락: ${marker}`);
}

for (const marker of [
  "owner: [",
  "admin: [",
  "editor: [",
  "viewer: ['view_data']",
  "'delete_property'",
  "'verify_data'",
  "'finalize_report'",
  "'manage_company'",
]) {
  if (!text.access.includes(marker)) throw new Error(`Access role/capability 기준 누락: ${marker}`);
}

if (!text.authMigration.includes("default 'viewer'")) throw new Error('Remote user 기본 role은 viewer여야 합니다.');
if (!text.authMigration.includes('daon_is_owner()')) throw new Error('Owner RLS helper가 선행 migration에 필요합니다.');

for (const marker of [
  'grant usage on schema private to authenticated',
  'private.daon_is_owner()',
  'private.daon_is_active_user()',
  'private.daon_can_edit_data()',
  'private.daon_can_verify_data()',
  'revoke all on public.external_share_sessions from anon, authenticated',
  'revoke all on public.external_share_review_notes from anon, authenticated',
  'drop function if exists public.daon_is_owner()',
  'drop function if exists public.daon_current_role()',
  'revoke all on function public.daon_touch_updated_at() from public, anon, authenticated',
]) {
  if (!text.hardeningMigration.includes(marker)) throw new Error(`Private RLS hardening 규칙 누락: ${marker}`);
}

console.log('Property/Data persistence + RLS boundary: PASS');
