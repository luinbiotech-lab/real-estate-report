-- DA:ON Real Estate Platform
-- Property/Data persistence + RLS draft.
-- PREPARED ONLY. Apply only to a dedicated real-estate Supabase project.
-- Do not apply this migration to GPS Tracker or Sports AI projects.
-- Requires: 20260916_auth_profiles_rls.sql

begin;

create or replace function public.daon_is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.is_active = true
  )
$$;

revoke all on function public.daon_is_active_user() from public;
grant execute on function public.daon_is_active_user() to authenticated;

create or replace function public.daon_can_edit_data()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.daon_current_role() in (
    'owner'::public.daon_access_role,
    'admin'::public.daon_access_role,
    'editor'::public.daon_access_role
  ), false)
$$;

revoke all on function public.daon_can_edit_data() from public;
grant execute on function public.daon_can_edit_data() to authenticated;

create or replace function public.daon_can_verify_data()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.daon_current_role() in (
    'owner'::public.daon_access_role,
    'admin'::public.daon_access_role
  ), false)
$$;

revoke all on function public.daon_can_verify_data() from public;
grant execute on function public.daon_can_verify_data() to authenticated;

create or replace function public.daon_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.daon_touch_updated_at() from public;

create table if not exists public.properties (
  id text primary key,
  payload jsonb not null,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.property_objects (
  object_type text not null,
  id text not null,
  property_id text not null references public.properties(id) on delete cascade,
  payload jsonb not null,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (object_type, id),
  constraint property_objects_type_allowed check (object_type in (
    'propertyDocuments',
    'propertyMedia',
    'propertyDataSources',
    'digitalTwinAssets',
    'agentJobs',
    'agentResults',
    'agentReviews',
    'propertySpaces',
    'spaceMediaLinks',
    'spaceRoomLinks',
    'propertyFacilities',
    'roomEvidencePositions',
    'roomConditionHistory',
    'renovationAssessments',
    'roomRenovationAssessments',
    'roomRenovationHistory',
    'riskAssessments',
    'buildingReleaseSnapshots',
    'buildingReleaseSnapshotStates',
    'buildingReleaseShares',
    'buildingReleaseReviewNotes'
  ))
);

create index if not exists property_objects_property_id_idx on public.property_objects(property_id);
create index if not exists property_objects_property_type_idx on public.property_objects(property_id, object_type);

create table if not exists public.property_verification_candidates (
  id text primary key,
  property_id text not null references public.properties(id) on delete cascade,
  field_key text not null,
  candidate_value jsonb,
  source_type text not null,
  source_name text,
  source_reference text,
  note text,
  decision_status text not null default 'pending' check (decision_status in ('pending', 'held', 'approved', 'rejected')),
  decision_note text,
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists property_verification_candidates_property_idx on public.property_verification_candidates(property_id);
create index if not exists property_verification_candidates_status_idx on public.property_verification_candidates(property_id, decision_status);

create table if not exists public.property_verifications (
  id text primary key,
  property_id text not null references public.properties(id) on delete cascade,
  payload jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists property_verifications_property_idx on public.property_verifications(property_id);

create table if not exists public.report_snapshots (
  id text primary key,
  property_id text not null references public.properties(id) on delete cascade,
  payload jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'final')),
  created_by uuid not null references auth.users(id),
  finalized_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  constraint report_snapshots_final_metadata check (
    (status = 'draft' and finalized_by is null and finalized_at is null)
    or
    (status = 'final' and finalized_by is not null and finalized_at is not null)
  )
);

create index if not exists report_snapshots_property_idx on public.report_snapshots(property_id, created_at desc);

create table if not exists public.company_settings (
  id text primary key default 'main',
  payload jsonb not null,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);

-- updated_at trigger coverage
for_each_table: begin end;

-- PostgreSQL has no statement label loop for DDL here; define triggers explicitly.
drop trigger if exists properties_touch_updated_at on public.properties;
create trigger properties_touch_updated_at before update on public.properties
for each row execute function public.daon_touch_updated_at();

drop trigger if exists property_objects_touch_updated_at on public.property_objects;
create trigger property_objects_touch_updated_at before update on public.property_objects
for each row execute function public.daon_touch_updated_at();

drop trigger if exists property_verification_candidates_touch_updated_at on public.property_verification_candidates;
create trigger property_verification_candidates_touch_updated_at before update on public.property_verification_candidates
for each row execute function public.daon_touch_updated_at();

drop trigger if exists company_settings_touch_updated_at on public.company_settings;
create trigger company_settings_touch_updated_at before update on public.company_settings
for each row execute function public.daon_touch_updated_at();

alter table public.properties enable row level security;
alter table public.property_objects enable row level security;
alter table public.property_verification_candidates enable row level security;
alter table public.property_verifications enable row level security;
alter table public.report_snapshots enable row level security;
alter table public.company_settings enable row level security;

revoke all on public.properties from anon;
revoke all on public.property_objects from anon;
revoke all on public.property_verification_candidates from anon;
revoke all on public.property_verifications from anon;
revoke all on public.report_snapshots from anon;
revoke all on public.company_settings from anon;

grant select, insert, update, delete on public.properties to authenticated;
grant select, insert, update, delete on public.property_objects to authenticated;
grant select, insert, update, delete on public.property_verification_candidates to authenticated;
grant select, insert, update, delete on public.property_verifications to authenticated;
grant select, insert, update, delete on public.report_snapshots to authenticated;
grant select, insert, update, delete on public.company_settings to authenticated;

-- PROPERTIES: all active roles may read; OWNER/ADMIN/EDITOR may create/update; OWNER only may delete.
drop policy if exists "properties_select_active" on public.properties;
create policy "properties_select_active" on public.properties
for select to authenticated using (public.daon_is_active_user());

drop policy if exists "properties_insert_editor_plus" on public.properties;
create policy "properties_insert_editor_plus" on public.properties
for insert to authenticated
with check (public.daon_can_edit_data() and created_by = auth.uid() and updated_by = auth.uid());

drop policy if exists "properties_update_editor_plus" on public.properties;
create policy "properties_update_editor_plus" on public.properties
for update to authenticated
using (public.daon_can_edit_data())
with check (public.daon_can_edit_data() and updated_by = auth.uid());

drop policy if exists "properties_delete_owner_only" on public.properties;
create policy "properties_delete_owner_only" on public.properties
for delete to authenticated using (public.daon_is_owner());

-- MODULAR PROPERTY OBJECTS: all active roles read; OWNER/ADMIN/EDITOR mutate.
drop policy if exists "property_objects_select_active" on public.property_objects;
create policy "property_objects_select_active" on public.property_objects
for select to authenticated using (public.daon_is_active_user());

drop policy if exists "property_objects_insert_editor_plus" on public.property_objects;
create policy "property_objects_insert_editor_plus" on public.property_objects
for insert to authenticated
with check (public.daon_can_edit_data() and created_by = auth.uid() and updated_by = auth.uid());

drop policy if exists "property_objects_update_editor_plus" on public.property_objects;
create policy "property_objects_update_editor_plus" on public.property_objects
for update to authenticated
using (public.daon_can_edit_data())
with check (public.daon_can_edit_data() and updated_by = auth.uid());

drop policy if exists "property_objects_delete_editor_plus" on public.property_objects;
create policy "property_objects_delete_editor_plus" on public.property_objects
for delete to authenticated using (public.daon_can_edit_data());

-- VERIFICATION CANDIDATES: EDITOR+ may submit PENDING candidates. Decisions are OWNER/ADMIN only.
drop policy if exists "verification_candidates_select_active" on public.property_verification_candidates;
create policy "verification_candidates_select_active" on public.property_verification_candidates
for select to authenticated using (public.daon_is_active_user());

drop policy if exists "verification_candidates_insert_editor_plus" on public.property_verification_candidates;
create policy "verification_candidates_insert_editor_plus" on public.property_verification_candidates
for insert to authenticated
with check (
  public.daon_can_edit_data()
  and created_by = auth.uid()
  and decision_status = 'pending'
  and decided_by is null
  and decided_at is null
);

drop policy if exists "verification_candidates_update_verifier" on public.property_verification_candidates;
create policy "verification_candidates_update_verifier" on public.property_verification_candidates
for update to authenticated
using (public.daon_can_verify_data())
with check (
  public.daon_can_verify_data()
  and (
    (decision_status in ('pending', 'held') and decided_by is null and decided_at is null)
    or
    (decision_status in ('approved', 'rejected') and decided_by = auth.uid() and decided_at is not null)
  )
);

drop policy if exists "verification_candidates_delete_verifier" on public.property_verification_candidates;
create policy "verification_candidates_delete_verifier" on public.property_verification_candidates
for delete to authenticated using (public.daon_can_verify_data());

-- VERIFIED HISTORY: immutable append by OWNER/ADMIN; OWNER may remove only for exceptional remediation.
drop policy if exists "property_verifications_select_active" on public.property_verifications;
create policy "property_verifications_select_active" on public.property_verifications
for select to authenticated using (public.daon_is_active_user());

drop policy if exists "property_verifications_insert_verifier" on public.property_verifications;
create policy "property_verifications_insert_verifier" on public.property_verifications
for insert to authenticated
with check (public.daon_can_verify_data() and created_by = auth.uid());

drop policy if exists "property_verifications_delete_owner" on public.property_verifications;
create policy "property_verifications_delete_owner" on public.property_verifications
for delete to authenticated using (public.daon_is_owner());

-- REPORT SNAPSHOTS: EDITOR may create drafts; OWNER/ADMIN may create draft/final. No UPDATE policy: snapshots are immutable.
drop policy if exists "report_snapshots_select_active" on public.report_snapshots;
create policy "report_snapshots_select_active" on public.report_snapshots
for select to authenticated using (public.daon_is_active_user());

drop policy if exists "report_snapshots_insert_role" on public.report_snapshots;
create policy "report_snapshots_insert_role" on public.report_snapshots
for insert to authenticated
with check (
  created_by = auth.uid()
  and (
    (public.daon_current_role() = 'editor'::public.daon_access_role and status = 'draft' and finalized_by is null and finalized_at is null)
    or
    (public.daon_can_verify_data() and (
      (status = 'draft' and finalized_by is null and finalized_at is null)
      or
      (status = 'final' and finalized_by = auth.uid() and finalized_at is not null)
    ))
  )
);

drop policy if exists "report_snapshots_delete_owner" on public.report_snapshots;
create policy "report_snapshots_delete_owner" on public.report_snapshots
for delete to authenticated using (public.daon_is_owner());

-- COMPANY SETTINGS: active users may read; OWNER only may mutate.
drop policy if exists "company_settings_select_active" on public.company_settings;
create policy "company_settings_select_active" on public.company_settings
for select to authenticated using (public.daon_is_active_user());

drop policy if exists "company_settings_insert_owner" on public.company_settings;
create policy "company_settings_insert_owner" on public.company_settings
for insert to authenticated
with check (public.daon_is_owner() and updated_by = auth.uid());

drop policy if exists "company_settings_update_owner" on public.company_settings;
create policy "company_settings_update_owner" on public.company_settings
for update to authenticated
using (public.daon_is_owner())
with check (public.daon_is_owner() and updated_by = auth.uid());

drop policy if exists "company_settings_delete_owner" on public.company_settings;
create policy "company_settings_delete_owner" on public.company_settings
for delete to authenticated using (public.daon_is_owner());

-- No anonymous policies are created for any operational property/data table.
-- service_role is reserved for trusted server/Edge Function operations only.

commit;
