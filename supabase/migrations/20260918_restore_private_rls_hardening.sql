-- DA:ON Real Estate Platform
-- Restore private RLS helper hardening after base schema application.
-- Apply after auth_profiles_rls + property_data_rls + property_asset_storage.

begin;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

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

drop policy if exists "profiles_select_self_or_owner" on public.profiles;
create policy "profiles_select_self_or_owner" on public.profiles for select to authenticated
using (user_id = auth.uid() or private.daon_is_owner());
drop policy if exists "profiles_insert_owner_only" on public.profiles;
create policy "profiles_insert_owner_only" on public.profiles for insert to authenticated
with check (private.daon_is_owner());
drop policy if exists "profiles_update_owner_only" on public.profiles;
create policy "profiles_update_owner_only" on public.profiles for update to authenticated
using (private.daon_is_owner()) with check (private.daon_is_owner());
drop policy if exists "profiles_delete_owner_only" on public.profiles;
create policy "profiles_delete_owner_only" on public.profiles for delete to authenticated
using (private.daon_is_owner());

drop policy if exists "properties_select_active" on public.properties;
create policy "properties_select_active" on public.properties for select to authenticated
using (private.daon_is_active_user());
drop policy if exists "properties_insert_editor_plus" on public.properties;
create policy "properties_insert_editor_plus" on public.properties for insert to authenticated
with check (private.daon_can_edit_data() and created_by = auth.uid() and updated_by = auth.uid());
drop policy if exists "properties_update_editor_plus" on public.properties;
create policy "properties_update_editor_plus" on public.properties for update to authenticated
using (private.daon_can_edit_data())
with check (private.daon_can_edit_data() and updated_by = auth.uid());
drop policy if exists "properties_delete_owner_only" on public.properties;
create policy "properties_delete_owner_only" on public.properties for delete to authenticated
using (private.daon_is_owner());

drop policy if exists "property_objects_select_active" on public.property_objects;
create policy "property_objects_select_active" on public.property_objects for select to authenticated
using (private.daon_is_active_user());
drop policy if exists "property_objects_insert_editor_plus" on public.property_objects;
create policy "property_objects_insert_editor_plus" on public.property_objects for insert to authenticated
with check (private.daon_can_edit_data() and created_by = auth.uid() and updated_by = auth.uid());
drop policy if exists "property_objects_update_editor_plus" on public.property_objects;
create policy "property_objects_update_editor_plus" on public.property_objects for update to authenticated
using (private.daon_can_edit_data())
with check (private.daon_can_edit_data() and updated_by = auth.uid());
drop policy if exists "property_objects_delete_editor_plus" on public.property_objects;
create policy "property_objects_delete_editor_plus" on public.property_objects for delete to authenticated
using (private.daon_can_edit_data());

drop policy if exists "verification_candidates_select_active" on public.property_verification_candidates;
create policy "verification_candidates_select_active" on public.property_verification_candidates for select to authenticated
using (private.daon_is_active_user());
drop policy if exists "verification_candidates_insert_editor_plus" on public.property_verification_candidates;
create policy "verification_candidates_insert_editor_plus" on public.property_verification_candidates for insert to authenticated
with check (
  private.daon_can_edit_data()
  and created_by = auth.uid()
  and decision_status = 'pending'
  and decided_by is null
  and decided_at is null
);
drop policy if exists "verification_candidates_update_verifier" on public.property_verification_candidates;
create policy "verification_candidates_update_verifier" on public.property_verification_candidates for update to authenticated
using (private.daon_can_verify_data())
with check (
  private.daon_can_verify_data()
  and (
    (decision_status in ('pending','held') and decided_by is null and decided_at is null)
    or
    (decision_status in ('approved','rejected') and decided_by = auth.uid() and decided_at is not null)
  )
);
drop policy if exists "verification_candidates_delete_verifier" on public.property_verification_candidates;
create policy "verification_candidates_delete_verifier" on public.property_verification_candidates for delete to authenticated
using (private.daon_can_verify_data());

drop policy if exists "property_verifications_select_active" on public.property_verifications;
create policy "property_verifications_select_active" on public.property_verifications for select to authenticated
using (private.daon_is_active_user());
drop policy if exists "property_verifications_insert_verifier" on public.property_verifications;
create policy "property_verifications_insert_verifier" on public.property_verifications for insert to authenticated
with check (private.daon_can_verify_data() and created_by = auth.uid());
drop policy if exists "property_verifications_delete_owner" on public.property_verifications;
create policy "property_verifications_delete_owner" on public.property_verifications for delete to authenticated
using (private.daon_is_owner());

drop policy if exists "report_snapshots_select_active" on public.report_snapshots;
create policy "report_snapshots_select_active" on public.report_snapshots for select to authenticated
using (private.daon_is_active_user());
drop policy if exists "report_snapshots_insert_role" on public.report_snapshots;
create policy "report_snapshots_insert_role" on public.report_snapshots for insert to authenticated
with check (
  created_by = auth.uid()
  and (
    (private.daon_current_role() = 'editor'::public.daon_access_role and status = 'draft' and finalized_by is null and finalized_at is null)
    or
    (private.daon_can_verify_data() and (
      (status = 'draft' and finalized_by is null and finalized_at is null)
      or
      (status = 'final' and finalized_by = auth.uid() and finalized_at is not null)
    ))
  )
);
drop policy if exists "report_snapshots_delete_owner" on public.report_snapshots;
create policy "report_snapshots_delete_owner" on public.report_snapshots for delete to authenticated
using (private.daon_is_owner());

drop policy if exists "company_settings_select_active" on public.company_settings;
create policy "company_settings_select_active" on public.company_settings for select to authenticated
using (private.daon_is_active_user());
drop policy if exists "company_settings_insert_owner" on public.company_settings;
create policy "company_settings_insert_owner" on public.company_settings for insert to authenticated
with check (private.daon_is_owner() and updated_by = auth.uid());
drop policy if exists "company_settings_update_owner" on public.company_settings;
create policy "company_settings_update_owner" on public.company_settings for update to authenticated
using (private.daon_is_owner())
with check (private.daon_is_owner() and updated_by = auth.uid());
drop policy if exists "company_settings_delete_owner" on public.company_settings;
create policy "company_settings_delete_owner" on public.company_settings for delete to authenticated
using (private.daon_is_owner());

drop policy if exists "property_assets_select_active" on public.property_assets;
create policy "property_assets_select_active" on public.property_assets for select to authenticated
using (private.daon_is_active_user());
drop policy if exists "property_assets_insert_editor_plus" on public.property_assets;
create policy "property_assets_insert_editor_plus" on public.property_assets for insert to authenticated
with check (private.daon_can_edit_data() and created_by = auth.uid() and updated_by = auth.uid());
drop policy if exists "property_assets_update_editor_plus" on public.property_assets;
create policy "property_assets_update_editor_plus" on public.property_assets for update to authenticated
using (private.daon_can_edit_data())
with check (private.daon_can_edit_data() and updated_by = auth.uid());
drop policy if exists "property_assets_delete_editor_plus" on public.property_assets;
create policy "property_assets_delete_editor_plus" on public.property_assets for delete to authenticated
using (private.daon_can_edit_data());

drop policy if exists "daon_property_assets_storage_select" on storage.objects;
create policy "daon_property_assets_storage_select" on storage.objects for select to authenticated
using (bucket_id = 'daon-property-assets' and private.daon_is_active_user());
drop policy if exists "daon_property_assets_storage_insert" on storage.objects;
create policy "daon_property_assets_storage_insert" on storage.objects for insert to authenticated
with check (
  bucket_id = 'daon-property-assets'
  and private.daon_can_edit_data()
  and array_length(storage.foldername(name), 1) >= 3
);
drop policy if exists "daon_property_assets_storage_update" on storage.objects;
create policy "daon_property_assets_storage_update" on storage.objects for update to authenticated
using (bucket_id = 'daon-property-assets' and private.daon_can_edit_data())
with check (
  bucket_id = 'daon-property-assets'
  and private.daon_can_edit_data()
  and array_length(storage.foldername(name), 1) >= 3
);
drop policy if exists "daon_property_assets_storage_delete" on storage.objects;
create policy "daon_property_assets_storage_delete" on storage.objects for delete to authenticated
using (bucket_id = 'daon-property-assets' and private.daon_can_edit_data());

revoke all on public.profiles from anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
revoke all on public.properties from anon, authenticated;
grant select, insert, update, delete on public.properties to authenticated;
revoke all on public.property_objects from anon, authenticated;
grant select, insert, update, delete on public.property_objects to authenticated;
revoke all on public.property_verification_candidates from anon, authenticated;
grant select, insert, update, delete on public.property_verification_candidates to authenticated;
revoke all on public.property_verifications from anon, authenticated;
grant select, insert, delete on public.property_verifications to authenticated;
revoke all on public.report_snapshots from anon, authenticated;
grant select, insert, delete on public.report_snapshots to authenticated;
revoke all on public.company_settings from anon, authenticated;
grant select, insert, update, delete on public.company_settings to authenticated;
revoke all on public.property_assets from anon, authenticated;
grant select, insert, update, delete on public.property_assets to authenticated;
revoke all on public.external_share_sessions from anon, authenticated;
revoke all on public.external_share_review_notes from anon, authenticated;

drop function if exists public.daon_can_edit_data();
drop function if exists public.daon_can_verify_data();
drop function if exists public.daon_is_active_user();
drop function if exists public.daon_is_owner();
drop function if exists public.daon_current_role();

revoke all on function public.daon_touch_updated_at() from public, anon, authenticated;
revoke all on function public.daon_validate_asset_storage_path() from public, anon, authenticated;

commit;
