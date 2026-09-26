-- DA:ON Real Estate Platform production security hardening
-- Applied to dedicated real-estate Supabase project only.

begin;

-- External share tables are Edge-Function-only. Keep direct client grants disabled.
revoke all on table public.external_share_sessions from anon, authenticated;
revoke all on table public.external_share_review_notes from anon, authenticated;

-- Move RLS helper functions out of the exposed public API schema.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.daon_current_role()
returns public.daon_access_role
language sql stable security definer set search_path = public
as $$
  select p.role from public.profiles p
  where p.user_id = auth.uid() and p.is_active = true limit 1
$$;

create or replace function private.daon_is_owner()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(private.daon_current_role() = 'owner'::public.daon_access_role, false) $$;

create or replace function private.daon_is_active_user()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.is_active = true) $$;

create or replace function private.daon_can_edit_data()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(private.daon_current_role() in ('owner'::public.daon_access_role,'admin'::public.daon_access_role,'editor'::public.daon_access_role), false) $$;

create or replace function private.daon_can_verify_data()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(private.daon_current_role() in ('owner'::public.daon_access_role,'admin'::public.daon_access_role), false) $$;

revoke all on function private.daon_current_role() from public, anon;
revoke all on function private.daon_is_owner() from public, anon;
revoke all on function private.daon_is_active_user() from public, anon;
revoke all on function private.daon_can_edit_data() from public, anon;
revoke all on function private.daon_can_verify_data() from public, anon;
grant execute on function private.daon_current_role() to authenticated;
grant execute on function private.daon_is_owner() to authenticated;
grant execute on function private.daon_is_active_user() to authenticated;
grant execute on function private.daon_can_edit_data() to authenticated;
grant execute on function private.daon_can_verify_data() to authenticated;

-- profiles
drop policy if exists "profiles_select_self_or_owner" on public.profiles;
create policy "profiles_select_self_or_owner" on public.profiles for select to authenticated using (user_id = auth.uid() or private.daon_is_owner());
drop policy if exists "profiles_insert_owner_only" on public.profiles;
create policy "profiles_insert_owner_only" on public.profiles for insert to authenticated with check (private.daon_is_owner());
drop policy if exists "profiles_update_owner_only" on public.profiles;
create policy "profiles_update_owner_only" on public.profiles for update to authenticated using (private.daon_is_owner()) with check (private.daon_is_owner());
drop policy if exists "profiles_delete_owner_only" on public.profiles;
create policy "profiles_delete_owner_only" on public.profiles for delete to authenticated using (private.daon_is_owner());

-- properties
drop policy if exists "properties_select_active" on public.properties;
create policy "properties_select_active" on public.properties for select to authenticated using (private.daon_is_active_user());
drop policy if exists "properties_insert_editor_plus" on public.properties;
create policy "properties_insert_editor_plus" on public.properties for insert to authenticated with check (private.daon_can_edit_data() and created_by=auth.uid() and updated_by=auth.uid());
drop policy if exists "properties_update_editor_plus" on public.properties;
create policy "properties_update_editor_plus" on public.properties for update to authenticated using (private.daon_can_edit_data()) with check (private.daon_can_edit_data() and updated_by=auth.uid());
drop policy if exists "properties_delete_owner_only" on public.properties;
create policy "properties_delete_owner_only" on public.properties for delete to authenticated using (private.daon_is_owner());

-- property objects
drop policy if exists "property_objects_select_active" on public.property_objects;
create policy "property_objects_select_active" on public.property_objects for select to authenticated using (private.daon_is_active_user());
drop policy if exists "property_objects_insert_editor_plus" on public.property_objects;
create policy "property_objects_insert_editor_plus" on public.property_objects for insert to authenticated with check (private.daon_can_edit_data() and created_by=auth.uid() and updated_by=auth.uid());
drop policy if exists "property_objects_update_editor_plus" on public.property_objects;
create policy "property_objects_update_editor_plus" on public.property_objects for update to authenticated using (private.daon_can_edit_data()) with check (private.daon_can_edit_data() and updated_by=auth.uid());
drop policy if exists "property_objects_delete_editor_plus" on public.property_objects;
create policy "property_objects_delete_editor_plus" on public.property_objects for delete to authenticated using (private.daon_can_edit_data());

-- verification
drop policy if exists "verification_candidates_select_active" on public.property_verification_candidates;
create policy "verification_candidates_select_active" on public.property_verification_candidates for select to authenticated using (private.daon_is_active_user());
drop policy if exists "verification_candidates_insert_editor_plus" on public.property_verification_candidates;
create policy "verification_candidates_insert_editor_plus" on public.property_verification_candidates for insert to authenticated with check (private.daon_can_edit_data() and created_by=auth.uid() and decision_status='pending' and decided_by is null and decided_at is null);
drop policy if exists "verification_candidates_update_verifier" on public.property_verification_candidates;
create policy "verification_candidates_update_verifier" on public.property_verification_candidates for update to authenticated using (private.daon_can_verify_data()) with check (private.daon_can_verify_data() and ((decision_status in ('pending','held') and decided_by is null and decided_at is null) or (decision_status in ('approved','rejected') and decided_by=auth.uid() and decided_at is not null)));
drop policy if exists "verification_candidates_delete_verifier" on public.property_verification_candidates;
create policy "verification_candidates_delete_verifier" on public.property_verification_candidates for delete to authenticated using (private.daon_can_verify_data());

drop policy if exists "property_verifications_select_active" on public.property_verifications;
create policy "property_verifications_select_active" on public.property_verifications for select to authenticated using (private.daon_is_active_user());
drop policy if exists "property_verifications_insert_verifier" on public.property_verifications;
create policy "property_verifications_insert_verifier" on public.property_verifications for insert to authenticated with check (private.daon_can_verify_data() and created_by=auth.uid());
drop policy if exists "property_verifications_delete_owner" on public.property_verifications;
create policy "property_verifications_delete_owner" on public.property_verifications for delete to authenticated using (private.daon_is_owner());

-- report snapshots
drop policy if exists "report_snapshots_select_active" on public.report_snapshots;
create policy "report_snapshots_select_active" on public.report_snapshots for select to authenticated using (private.daon_is_active_user());
drop policy if exists "report_snapshots_insert_role" on public.report_snapshots;
create policy "report_snapshots_insert_role" on public.report_snapshots for insert to authenticated with check (created_by=auth.uid() and ((private.daon_current_role()='editor'::public.daon_access_role and status='draft' and finalized_by is null and finalized_at is null) or (private.daon_can_verify_data() and ((status='draft' and finalized_by is null and finalized_at is null) or (status='final' and finalized_by=auth.uid() and finalized_at is not null)))));
drop policy if exists "report_snapshots_delete_owner" on public.report_snapshots;
create policy "report_snapshots_delete_owner" on public.report_snapshots for delete to authenticated using (private.daon_is_owner());

-- company settings
drop policy if exists "company_settings_select_active" on public.company_settings;
create policy "company_settings_select_active" on public.company_settings for select to authenticated using (private.daon_is_active_user());
drop policy if exists "company_settings_insert_owner" on public.company_settings;
create policy "company_settings_insert_owner" on public.company_settings for insert to authenticated with check (private.daon_is_owner() and updated_by=auth.uid());
drop policy if exists "company_settings_update_owner" on public.company_settings;
create policy "company_settings_update_owner" on public.company_settings for update to authenticated using (private.daon_is_owner()) with check (private.daon_is_owner() and updated_by=auth.uid());
drop policy if exists "company_settings_delete_owner" on public.company_settings;
create policy "company_settings_delete_owner" on public.company_settings for delete to authenticated using (private.daon_is_owner());

-- property asset metadata
drop policy if exists "property_assets_select_active" on public.property_assets;
create policy "property_assets_select_active" on public.property_assets for select to authenticated using (private.daon_is_active_user());
drop policy if exists "property_assets_insert_editor_plus" on public.property_assets;
create policy "property_assets_insert_editor_plus" on public.property_assets for insert to authenticated with check (private.daon_can_edit_data() and created_by=auth.uid() and updated_by=auth.uid());
drop policy if exists "property_assets_update_editor_plus" on public.property_assets;
create policy "property_assets_update_editor_plus" on public.property_assets for update to authenticated using (private.daon_can_edit_data()) with check (private.daon_can_edit_data() and updated_by=auth.uid());
drop policy if exists "property_assets_delete_editor_plus" on public.property_assets;
create policy "property_assets_delete_editor_plus" on public.property_assets for delete to authenticated using (private.daon_can_edit_data());

-- private Storage bucket policies
drop policy if exists "daon_property_assets_storage_select" on storage.objects;
create policy "daon_property_assets_storage_select" on storage.objects for select to authenticated using (bucket_id='daon-property-assets' and private.daon_is_active_user());
drop policy if exists "daon_property_assets_storage_insert" on storage.objects;
create policy "daon_property_assets_storage_insert" on storage.objects for insert to authenticated with check (bucket_id='daon-property-assets' and private.daon_can_edit_data() and array_length(storage.foldername(name),1)>=3);
drop policy if exists "daon_property_assets_storage_update" on storage.objects;
create policy "daon_property_assets_storage_update" on storage.objects for update to authenticated using (bucket_id='daon-property-assets' and private.daon_can_edit_data()) with check (bucket_id='daon-property-assets' and private.daon_can_edit_data() and array_length(storage.foldername(name),1)>=3);
drop policy if exists "daon_property_assets_storage_delete" on storage.objects;
create policy "daon_property_assets_storage_delete" on storage.objects for delete to authenticated using (bucket_id='daon-property-assets' and private.daon_can_edit_data());

-- Obsolete public helper functions must not be callable through PostgREST RPC.
revoke execute on function public.daon_current_role() from authenticated, anon;
revoke execute on function public.daon_is_owner() from authenticated, anon;
revoke execute on function public.daon_is_active_user() from authenticated, anon;
revoke execute on function public.daon_can_edit_data() from authenticated, anon;
revoke execute on function public.daon_can_verify_data() from authenticated, anon;
revoke execute on function public.daon_handle_new_user() from authenticated, anon;

commit;
