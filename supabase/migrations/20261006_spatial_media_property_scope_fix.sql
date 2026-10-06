-- DA:ON Real Estate Platform
-- Property-scope fix for spatial navigation rows.
-- Requires: 20261006_spatial_media_walkthrough_contract.sql

begin;

alter table public.viewer_edges
  add column if not exists property_id text references public.properties(id) on delete cascade;

alter table public.walkthrough_steps
  add column if not exists property_id text references public.properties(id) on delete cascade;

create index if not exists viewer_edges_property_idx on public.viewer_edges(property_id, scene_id, sequence_order);
create index if not exists walkthrough_steps_property_idx on public.walkthrough_steps(property_id, route_id, sequence_order);

commit;
