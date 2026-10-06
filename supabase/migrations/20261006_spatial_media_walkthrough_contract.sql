-- DA:ON Real Estate Platform
-- Spatial media, floor-plan, viewer, walkthrough, and verification event contract.
-- PREPARED ONLY. Apply only to the dedicated real-estate Supabase project.
-- Do not apply this migration to GPS Tracker, Sports AI, or unrelated Supabase projects.
-- Requires: 20260916_auth_profiles_rls.sql and 20260916_property_data_rls.sql

begin;

-- This migration intentionally keeps the existing property_objects JSON contract intact.
-- The tables below add a typed operational layer for floor-plan based 3D, media-to-space
-- matching, walkthrough routing, and explicit verification audit events.

create table if not exists public.property_media_policies (
  property_id text primary key references public.properties(id) on delete cascade,
  allow_interior_photos boolean not null default true,
  allow_exterior_photos boolean not null default true,
  allow_roadview boolean not null default true,
  allow_public_map boolean not null default true,
  allow_ai_visualization boolean not null default false,
  restriction_note text,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.floor_plans (
  id text primary key,
  property_id text not null references public.properties(id) on delete cascade,
  floor_id text,
  floor_label text,
  source_file_id text,
  storage_path text,
  file_type text not null check (file_type in ('pdf', 'image', 'dwg', 'dxf', 'scan', 'unknown')),
  original_filename text not null,
  page_number integer,
  image_url text,
  width_px integer check (width_px is null or width_px > 0),
  height_px integer check (height_px is null or height_px > 0),
  scale_status text not null default 'unknown' check (scale_status in ('unknown', 'unscaled', 'estimated', 'verified')),
  scale_value numeric,
  scale_unit text,
  orientation text,
  extraction_status text not null default 'uploaded' check (extraction_status in (
    'not_started',
    'uploaded',
    'image_converted',
    'space_candidate_detected',
    'manual_mapping_required',
    'mapped',
    'verified',
    'rejected'
  )),
  verification_status text not null default 'unknown' check (verification_status in (
    'unknown',
    'estimated',
    'ai_estimated',
    'source_provided',
    'document_verified',
    'field_checked',
    'owner_confirmed',
    'agent_verified',
    'conflict',
    'rejected'
  )),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists floor_plans_property_idx on public.floor_plans(property_id, floor_label);
create index if not exists floor_plans_status_idx on public.floor_plans(property_id, extraction_status, verification_status);

create table if not exists public.property_spaces_spatial (
  id text primary key,
  property_id text not null references public.properties(id) on delete cascade,
  floor_id text,
  parent_space_id text references public.property_spaces_spatial(id) on delete set null,
  space_code text,
  space_name text not null,
  space_type text not null default 'unknown' check (space_type in (
    'retail',
    'office',
    'residential',
    'storage',
    'parking',
    'common_area',
    'stair',
    'elevator',
    'mechanical',
    'roof',
    'exterior',
    'roadside',
    'unknown'
  )),
  area_m2 numeric,
  area_py numeric,
  ceiling_height_m numeric,
  geometry_2d jsonb not null default '{}'::jsonb,
  estimated_geometry_3d jsonb not null default '{}'::jsonb,
  confidence_score numeric check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)),
  source_type text not null default 'manual' check (source_type in ('manual', 'floor_plan', 'document', 'field', 'agent', 'ai')),
  verification_status text not null default 'unknown' check (verification_status in (
    'unknown',
    'estimated',
    'ai_estimated',
    'source_provided',
    'document_verified',
    'field_checked',
    'owner_confirmed',
    'agent_verified',
    'conflict',
    'rejected'
  )),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists property_spaces_spatial_property_idx on public.property_spaces_spatial(property_id, floor_id, space_type);
create index if not exists property_spaces_spatial_verification_idx on public.property_spaces_spatial(property_id, verification_status);

create table if not exists public.media_assets (
  id text primary key,
  property_id text not null references public.properties(id) on delete cascade,
  uploaded_by uuid references auth.users(id),
  source_file_id text,
  media_type text not null check (media_type in (
    'photo',
    'video',
    'floorplan_image',
    'roadview_capture',
    'map_capture',
    'drone_image',
    'document_scan',
    '360_image',
    '360_video'
  )),
  mime_type text,
  original_filename text not null,
  storage_path text not null,
  thumbnail_path text,
  duration_sec numeric,
  width_px integer check (width_px is null or width_px > 0),
  height_px integer check (height_px is null or height_px > 0),
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  captured_at timestamptz,
  uploaded_at timestamptz not null default now(),
  source_origin text not null default 'unknown' check (source_origin in (
    'owner_provided',
    'agent_uploaded',
    'field_captured',
    'public_source',
    'roadview',
    'map_provider',
    'ai_generated',
    'sample',
    'unknown'
  )),
  visibility_scope text not null default 'private' check (visibility_scope in ('private', 'data_room', 'report', 'public_share')),
  processing_status text not null default 'uploaded' check (processing_status in (
    'uploaded',
    'virus_checked',
    'metadata_extracted',
    'thumbnail_generated',
    'awaiting_space_match',
    'matched',
    'processing_failed',
    'archived',
    'deleted'
  )),
  verification_status text not null default 'unknown' check (verification_status in (
    'unknown',
    'estimated',
    'ai_estimated',
    'source_provided',
    'document_verified',
    'field_checked',
    'owner_confirmed',
    'agent_verified',
    'conflict',
    'rejected'
  )),
  ai_analysis_status text not null default 'not_started' check (ai_analysis_status in ('not_started', 'queued', 'running', 'review_required', 'completed', 'failed')),
  caption text,
  notes text,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists media_assets_property_idx on public.media_assets(property_id, media_type, processing_status);
create index if not exists media_assets_report_idx on public.media_assets(property_id, visibility_scope, verification_status);

create table if not exists public.media_space_links (
  id text primary key,
  media_asset_id text not null references public.media_assets(id) on delete cascade,
  property_id text not null references public.properties(id) on delete cascade,
  floor_id text,
  space_id text references public.property_spaces_spatial(id) on delete set null,
  match_type text not null default 'manual' check (match_type in (
    'manual',
    'filename_rule',
    'gps_exif',
    'timestamp_session',
    'ai_visual_match',
    'roadview_position',
    'unknown'
  )),
  match_status text not null default 'matched' check (match_status in ('unmatched', 'suggested', 'matched', 'needs_review', 'verified', 'rejected')),
  match_confidence numeric check (match_confidence is null or (match_confidence >= 0 and match_confidence <= 1)),
  match_source text,
  camera_position jsonb not null default '{}'::jsonb,
  camera_direction jsonb not null default '{}'::jsonb,
  display_priority integer not null default 100,
  is_representative boolean not null default false,
  verification_status text not null default 'unknown' check (verification_status in (
    'unknown',
    'estimated',
    'ai_estimated',
    'source_provided',
    'document_verified',
    'field_checked',
    'owner_confirmed',
    'agent_verified',
    'conflict',
    'rejected'
  )),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists media_space_links_media_idx on public.media_space_links(media_asset_id);
create index if not exists media_space_links_space_idx on public.media_space_links(property_id, floor_id, space_id, match_status);

create table if not exists public.viewer_scenes (
  id text primary key,
  property_id text not null references public.properties(id) on delete cascade,
  scene_type text not null check (scene_type in ('floor_stack', 'space_model', 'photo_walkthrough', 'roadview_context', 'digital_twin')),
  title text not null,
  description text,
  model_source_type text not null default 'metadata' check (model_source_type in ('metadata', 'floor_plan', 'media', 'glb', 'gltf', 'external', 'none')),
  model_url text,
  floor_plan_id text references public.floor_plans(id) on delete set null,
  generation_status text not null default 'draft' check (generation_status in ('draft', 'queued', 'generating', 'ready', 'failed', 'archived')),
  verification_status text not null default 'unknown' check (verification_status in (
    'unknown',
    'estimated',
    'ai_estimated',
    'source_provided',
    'document_verified',
    'field_checked',
    'owner_confirmed',
    'agent_verified',
    'conflict',
    'rejected'
  )),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists viewer_scenes_property_idx on public.viewer_scenes(property_id, scene_type, generation_status);

create table if not exists public.viewer_nodes (
  id text primary key,
  scene_id text not null references public.viewer_scenes(id) on delete cascade,
  property_id text not null references public.properties(id) on delete cascade,
  floor_id text,
  space_id text references public.property_spaces_spatial(id) on delete set null,
  node_type text not null default 'space' check (node_type in ('space', 'photo', 'video', 'transition', 'roadview', 'annotation')),
  label text not null,
  position_x numeric,
  position_y numeric,
  position_z numeric,
  rotation_yaw numeric,
  linked_media_asset_id text references public.media_assets(id) on delete set null,
  linked_viewer_node_id text references public.viewer_nodes(id) on delete set null,
  verification_status text not null default 'unknown' check (verification_status in (
    'unknown',
    'estimated',
    'ai_estimated',
    'source_provided',
    'document_verified',
    'field_checked',
    'owner_confirmed',
    'agent_verified',
    'conflict',
    'rejected'
  )),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists viewer_nodes_scene_idx on public.viewer_nodes(scene_id, node_type);
create index if not exists viewer_nodes_space_idx on public.viewer_nodes(property_id, floor_id, space_id);

create table if not exists public.viewer_edges (
  id text primary key,
  scene_id text not null references public.viewer_scenes(id) on delete cascade,
  from_node_id text not null references public.viewer_nodes(id) on delete cascade,
  to_node_id text not null references public.viewer_nodes(id) on delete cascade,
  edge_type text not null default 'walk' check (edge_type in ('walk', 'jump', 'stairs', 'elevator', 'context')),
  sequence_order integer not null default 0,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (scene_id, from_node_id, to_node_id, edge_type)
);

create index if not exists viewer_edges_scene_idx on public.viewer_edges(scene_id, sequence_order);

create table if not exists public.walkthrough_routes (
  id text primary key,
  property_id text not null references public.properties(id) on delete cascade,
  title text not null,
  description text,
  route_type text not null default 'default' check (route_type in ('default', 'exterior', 'floor', 'investment', 'due_diligence', 'custom')),
  is_default boolean not null default false,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists walkthrough_routes_one_default_idx
on public.walkthrough_routes(property_id)
where is_default = true and deleted_at is null;

create table if not exists public.walkthrough_steps (
  id text primary key,
  route_id text not null references public.walkthrough_routes(id) on delete cascade,
  sequence_order integer not null,
  space_id text references public.property_spaces_spatial(id) on delete set null,
  media_asset_id text references public.media_assets(id) on delete set null,
  viewer_node_id text references public.viewer_nodes(id) on delete set null,
  title text not null,
  description text,
  transition_type text not null default 'cut' check (transition_type in ('cut', 'fade', 'pan', 'walk', 'jump')),
  verification_status text not null default 'unknown' check (verification_status in (
    'unknown',
    'estimated',
    'ai_estimated',
    'source_provided',
    'document_verified',
    'field_checked',
    'owner_confirmed',
    'agent_verified',
    'conflict',
    'rejected'
  )),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (route_id, sequence_order)
);

create index if not exists walkthrough_steps_route_idx on public.walkthrough_steps(route_id, sequence_order);

create table if not exists public.verification_events (
  id text primary key,
  property_id text not null references public.properties(id) on delete cascade,
  target_type text not null check (target_type in (
    'property',
    'floor',
    'space',
    'media',
    'floor_plan',
    'report_section',
    'viewer_scene',
    'walkthrough_step',
    'public_record',
    'comparable_transaction'
  )),
  target_id text not null,
  previous_status text,
  new_status text not null check (new_status in (
    'unknown',
    'estimated',
    'ai_estimated',
    'source_provided',
    'document_verified',
    'field_checked',
    'owner_confirmed',
    'agent_verified',
    'conflict',
    'rejected'
  )),
  verification_level integer not null check (verification_level between 0 and 5),
  evidence_source_id text,
  verified_by uuid references auth.users(id),
  verification_method text not null default 'manual' check (verification_method in ('manual', 'official_document', 'field_visit', 'owner_confirmation', 'agent_review', 'ai_review', 'system')),
  confidence_score numeric check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)),
  note text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists verification_events_property_idx on public.verification_events(property_id, target_type, target_id, created_at desc);
create index if not exists verification_events_status_idx on public.verification_events(property_id, new_status, verification_level);

-- updated_at trigger coverage

drop trigger if exists property_media_policies_touch_updated_at on public.property_media_policies;
create trigger property_media_policies_touch_updated_at before update on public.property_media_policies
for each row execute function public.daon_touch_updated_at();

drop trigger if exists floor_plans_touch_updated_at on public.floor_plans;
create trigger floor_plans_touch_updated_at before update on public.floor_plans
for each row execute function public.daon_touch_updated_at();

drop trigger if exists property_spaces_spatial_touch_updated_at on public.property_spaces_spatial;
create trigger property_spaces_spatial_touch_updated_at before update on public.property_spaces_spatial
for each row execute function public.daon_touch_updated_at();

drop trigger if exists media_assets_touch_updated_at on public.media_assets;
create trigger media_assets_touch_updated_at before update on public.media_assets
for each row execute function public.daon_touch_updated_at();

drop trigger if exists media_space_links_touch_updated_at on public.media_space_links;
create trigger media_space_links_touch_updated_at before update on public.media_space_links
for each row execute function public.daon_touch_updated_at();

drop trigger if exists viewer_scenes_touch_updated_at on public.viewer_scenes;
create trigger viewer_scenes_touch_updated_at before update on public.viewer_scenes
for each row execute function public.daon_touch_updated_at();

drop trigger if exists viewer_nodes_touch_updated_at on public.viewer_nodes;
create trigger viewer_nodes_touch_updated_at before update on public.viewer_nodes
for each row execute function public.daon_touch_updated_at();

drop trigger if exists walkthrough_routes_touch_updated_at on public.walkthrough_routes;
create trigger walkthrough_routes_touch_updated_at before update on public.walkthrough_routes
for each row execute function public.daon_touch_updated_at();

drop trigger if exists walkthrough_steps_touch_updated_at on public.walkthrough_steps;
create trigger walkthrough_steps_touch_updated_at before update on public.walkthrough_steps
for each row execute function public.daon_touch_updated_at();

alter table public.property_media_policies enable row level security;
alter table public.floor_plans enable row level security;
alter table public.property_spaces_spatial enable row level security;
alter table public.media_assets enable row level security;
alter table public.media_space_links enable row level security;
alter table public.viewer_scenes enable row level security;
alter table public.viewer_nodes enable row level security;
alter table public.viewer_edges enable row level security;
alter table public.walkthrough_routes enable row level security;
alter table public.walkthrough_steps enable row level security;
alter table public.verification_events enable row level security;

revoke all on public.property_media_policies from anon;
revoke all on public.floor_plans from anon;
revoke all on public.property_spaces_spatial from anon;
revoke all on public.media_assets from anon;
revoke all on public.media_space_links from anon;
revoke all on public.viewer_scenes from anon;
revoke all on public.viewer_nodes from anon;
revoke all on public.viewer_edges from anon;
revoke all on public.walkthrough_routes from anon;
revoke all on public.walkthrough_steps from anon;
revoke all on public.verification_events from anon;

revoke all on public.property_media_policies from authenticated;
revoke all on public.floor_plans from authenticated;
revoke all on public.property_spaces_spatial from authenticated;
revoke all on public.media_assets from authenticated;
revoke all on public.media_space_links from authenticated;
revoke all on public.viewer_scenes from authenticated;
revoke all on public.viewer_nodes from authenticated;
revoke all on public.viewer_edges from authenticated;
revoke all on public.walkthrough_routes from authenticated;
revoke all on public.walkthrough_steps from authenticated;
revoke all on public.verification_events from authenticated;

grant select, insert, update, delete on public.property_media_policies to authenticated;
grant select, insert, update, delete on public.floor_plans to authenticated;
grant select, insert, update, delete on public.property_spaces_spatial to authenticated;
grant select, insert, update, delete on public.media_assets to authenticated;
grant select, insert, update, delete on public.media_space_links to authenticated;
grant select, insert, update, delete on public.viewer_scenes to authenticated;
grant select, insert, update, delete on public.viewer_nodes to authenticated;
grant select, insert, update, delete on public.viewer_edges to authenticated;
grant select, insert, update, delete on public.walkthrough_routes to authenticated;
grant select, insert, update, delete on public.walkthrough_steps to authenticated;
grant select, insert, delete on public.verification_events to authenticated;

-- Shared active-user read policy.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'property_media_policies',
    'floor_plans',
    'property_spaces_spatial',
    'media_assets',
    'media_space_links',
    'viewer_scenes',
    'viewer_nodes',
    'viewer_edges',
    'walkthrough_routes',
    'walkthrough_steps',
    'verification_events'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select_active', table_name);
    execute format('create policy %I on public.%I for select to authenticated using (private.daon_is_active_user())', table_name || '_select_active', table_name);
  end loop;
end $$;

-- Editor+ may write operational objects. OWNER only may hard delete.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'property_media_policies',
    'floor_plans',
    'property_spaces_spatial',
    'media_assets',
    'media_space_links',
    'viewer_scenes',
    'viewer_nodes',
    'walkthrough_routes',
    'walkthrough_steps'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_editor_plus', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.daon_can_edit_data() and created_by = auth.uid() and updated_by = auth.uid())', table_name || '_insert_editor_plus', table_name);

    execute format('drop policy if exists %I on public.%I', table_name || '_update_editor_plus', table_name);
    execute format('create policy %I on public.%I for update to authenticated using (private.daon_can_edit_data()) with check (private.daon_can_edit_data() and updated_by = auth.uid())', table_name || '_update_editor_plus', table_name);

    execute format('drop policy if exists %I on public.%I', table_name || '_delete_owner_only', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using (private.daon_is_owner())', table_name || '_delete_owner_only', table_name);
  end loop;
end $$;

-- Viewer edges do not have updated_by; still require editor+ for creation and OWNER for hard deletion.

drop policy if exists "viewer_edges_insert_editor_plus" on public.viewer_edges;
create policy "viewer_edges_insert_editor_plus" on public.viewer_edges
for insert to authenticated
with check (private.daon_can_edit_data() and created_by = auth.uid());

drop policy if exists "viewer_edges_delete_owner_only" on public.viewer_edges;
create policy "viewer_edges_delete_owner_only" on public.viewer_edges
for delete to authenticated using (private.daon_is_owner());

-- Verification events are append-only for verifier roles. OWNER may delete only for exceptional remediation.

drop policy if exists "verification_events_insert_verifier" on public.verification_events;
create policy "verification_events_insert_verifier" on public.verification_events
for insert to authenticated
with check (private.daon_can_verify_data() and created_by = auth.uid());

drop policy if exists "verification_events_delete_owner_only" on public.verification_events;
create policy "verification_events_delete_owner_only" on public.verification_events
for delete to authenticated using (private.daon_is_owner());

commit;
