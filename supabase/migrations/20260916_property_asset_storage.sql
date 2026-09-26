-- DA:ON Real Estate Platform
-- Private binary asset storage boundary for documents/media/digital-twin files.
-- PREPARED ONLY. Apply only to a dedicated real-estate Supabase project.
-- Requires: 20260916_auth_profiles_rls.sql + 20260916_property_data_rls.sql

begin;

-- Binary-bearing resource types must not be persisted in property_objects JSONB.
alter table public.property_objects drop constraint if exists property_objects_type_allowed;
alter table public.property_objects add constraint property_objects_type_allowed check (object_type in (
  'propertyDataSources',
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
));

create table if not exists public.property_assets (
  resource_type text not null check (resource_type in ('document', 'media', 'digital_twin')),
  id text not null,
  property_id text not null references public.properties(id) on delete cascade,
  storage_path text not null unique,
  original_file_name text,
  mime_type text,
  file_size bigint check (file_size is null or (file_size >= 0 and file_size <= 52428800)),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (resource_type, id),
  constraint property_assets_no_inline_binary check (
    not (metadata ? 'fileData')
    and left(coalesce(metadata ->> 'url', ''), 5) <> 'data:'
    and left(coalesce(metadata ->> 'fileUrl', ''), 5) <> 'data:'
  )
);

create index if not exists property_assets_property_idx on public.property_assets(property_id, resource_type);

create or replace function public.daon_validate_asset_storage_path()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.storage_path <> concat(new.property_id, '/', new.resource_type, '/', new.id, '/', regexp_replace(coalesce(new.original_file_name, 'asset'), '[^A-Za-z0-9._-]+', '_', 'g')) then
    raise exception 'invalid_property_asset_storage_path';
  end if;
  return new;
end;
$$;

revoke all on function public.daon_validate_asset_storage_path() from public;

drop trigger if exists property_assets_validate_storage_path on public.property_assets;
create trigger property_assets_validate_storage_path
before insert or update on public.property_assets
for each row execute function public.daon_validate_asset_storage_path();

drop trigger if exists property_assets_touch_updated_at on public.property_assets;
create trigger property_assets_touch_updated_at
before update on public.property_assets
for each row execute function public.daon_touch_updated_at();

alter table public.property_assets enable row level security;
revoke all on public.property_assets from anon;
grant select, insert, update, delete on public.property_assets to authenticated;

drop policy if exists "property_assets_select_active" on public.property_assets;
create policy "property_assets_select_active" on public.property_assets
for select to authenticated using (public.daon_is_active_user());

drop policy if exists "property_assets_insert_editor_plus" on public.property_assets;
create policy "property_assets_insert_editor_plus" on public.property_assets
for insert to authenticated
with check (public.daon_can_edit_data() and created_by = auth.uid() and updated_by = auth.uid());

drop policy if exists "property_assets_update_editor_plus" on public.property_assets;
create policy "property_assets_update_editor_plus" on public.property_assets
for update to authenticated
using (public.daon_can_edit_data())
with check (public.daon_can_edit_data() and updated_by = auth.uid());

drop policy if exists "property_assets_delete_editor_plus" on public.property_assets;
create policy "property_assets_delete_editor_plus" on public.property_assets
for delete to authenticated using (public.daon_can_edit_data());

-- One private bucket for current Data Room / media / Digital Twin binaries.
-- Current browser validation is stricter for many upload paths; server cap is a hard upper boundary.
insert into storage.buckets (id, name, public, file_size_limit)
values ('daon-property-assets', 'daon-property-assets', false, 52428800)
on conflict (id) do update set
  public = false,
  file_size_limit = 52428800;

-- Path contract: <propertyId>/<resourceType>/<resourceId>/<sanitizedFileName>
drop policy if exists "daon_property_assets_storage_select" on storage.objects;
create policy "daon_property_assets_storage_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'daon-property-assets'
  and public.daon_is_active_user()
);

drop policy if exists "daon_property_assets_storage_insert" on storage.objects;
create policy "daon_property_assets_storage_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'daon-property-assets'
  and public.daon_can_edit_data()
  and array_length(storage.foldername(name), 1) >= 3
);

drop policy if exists "daon_property_assets_storage_update" on storage.objects;
create policy "daon_property_assets_storage_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'daon-property-assets'
  and public.daon_can_edit_data()
)
with check (
  bucket_id = 'daon-property-assets'
  and public.daon_can_edit_data()
  and array_length(storage.foldername(name), 1) >= 3
);

drop policy if exists "daon_property_assets_storage_delete" on storage.objects;
create policy "daon_property_assets_storage_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'daon-property-assets'
  and public.daon_can_edit_data()
);

-- No anon policies are created. Bucket remains private.
-- Never persist Blob/base64/data-URL content inside metadata JSONB.

commit;
