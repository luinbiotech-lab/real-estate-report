create index if not exists property_spaces_spatial_parent_space_id_idx
  on public.property_spaces_spatial(parent_space_id);

create index if not exists media_space_links_space_id_idx
  on public.media_space_links(space_id);

create index if not exists viewer_scenes_floor_plan_id_idx
  on public.viewer_scenes(floor_plan_id);

create index if not exists viewer_nodes_space_id_idx
  on public.viewer_nodes(space_id);

create index if not exists viewer_nodes_linked_media_asset_id_idx
  on public.viewer_nodes(linked_media_asset_id);

create index if not exists viewer_nodes_linked_viewer_node_id_idx
  on public.viewer_nodes(linked_viewer_node_id);

create index if not exists viewer_edges_from_node_id_idx
  on public.viewer_edges(from_node_id);

create index if not exists viewer_edges_to_node_id_idx
  on public.viewer_edges(to_node_id);

create index if not exists walkthrough_steps_space_id_idx
  on public.walkthrough_steps(space_id);

create index if not exists walkthrough_steps_media_asset_id_idx
  on public.walkthrough_steps(media_asset_id);

create index if not exists walkthrough_steps_viewer_node_id_idx
  on public.walkthrough_steps(viewer_node_id);
