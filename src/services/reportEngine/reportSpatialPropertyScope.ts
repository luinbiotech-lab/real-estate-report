import type { SpatialMediaDataRoomBundle } from '../../domain/propertyDataRoom/spatialMediaModel';

/** Report-only boundary: a mixed/stale spatial repository response is never evidence for another Property. */
export function scopeReportSpatialBundle(bundle: SpatialMediaDataRoomBundle, propertyId: string): SpatialMediaDataRoomBundle {
  const floorPlans = bundle.floorPlans.filter((row) => row.propertyId === propertyId);
  const spaces = bundle.spaces.filter((row) => row.propertyId === propertyId);
  const mediaAssets = bundle.mediaAssets.filter((row) => row.propertyId === propertyId);
  const planIds = new Set(floorPlans.map((row) => row.id));
  const spaceIds = new Set(spaces.map((row) => row.id));
  const mediaIds = new Set(mediaAssets.map((row) => row.id));

  const mediaSpaceLinks = bundle.mediaSpaceLinks.filter((row) =>
    row.propertyId === propertyId && mediaIds.has(row.mediaAssetId) &&
    (!row.spaceId || spaceIds.has(row.spaceId)));
  const viewerScenes = bundle.viewerScenes.filter((row) =>
    row.propertyId === propertyId && (!row.floorPlanId || planIds.has(row.floorPlanId)));
  const sceneIds = new Set(viewerScenes.map((row) => row.id));
  let viewerNodes = bundle.viewerNodes.filter((row) =>
    row.propertyId === propertyId && sceneIds.has(row.sceneId) &&
    (!row.spaceId || spaceIds.has(row.spaceId)) &&
    (!row.linkedMediaAssetId || mediaIds.has(row.linkedMediaAssetId)));
  // Resolve chained node links to a fixed point; never retain a dangling foreign reference.
  for (;;) {
    const nodeIds = new Set(viewerNodes.map((row) => row.id));
    const valid = viewerNodes.filter((row) => !row.linkedViewerNodeId || nodeIds.has(row.linkedViewerNodeId));
    if (valid.length === viewerNodes.length) break;
    viewerNodes = valid;
  }
  const nodeScene = new Map(viewerNodes.map((row) => [row.id, row.sceneId]));
  const viewerEdges = bundle.viewerEdges.filter((row) =>
    sceneIds.has(row.sceneId) && nodeScene.get(row.fromNodeId) === row.sceneId &&
    nodeScene.get(row.toNodeId) === row.sceneId);
  const walkthroughRoutes = bundle.walkthroughRoutes.filter((row) => row.propertyId === propertyId);
  const routeIds = new Set(walkthroughRoutes.map((row) => row.id));
  const walkthroughSteps = bundle.walkthroughSteps.filter((row) =>
    routeIds.has(row.routeId) && (!row.spaceId || spaceIds.has(row.spaceId)) &&
    (!row.mediaAssetId || mediaIds.has(row.mediaAssetId)) &&
    (!row.viewerNodeId || nodeScene.has(row.viewerNodeId)));
  const stepIds = new Set(walkthroughSteps.map((row) => row.id));
  const verificationEvents = bundle.verificationEvents.filter((row) => {
    if (row.propertyId !== propertyId) return false;
    if (row.targetType === 'floor_plan') return planIds.has(row.targetId);
    if (row.targetType === 'space') return spaceIds.has(row.targetId);
    if (row.targetType === 'media') return mediaIds.has(row.targetId);
    if (row.targetType === 'viewer_scene') return sceneIds.has(row.targetId);
    if (row.targetType === 'walkthrough_step') return stepIds.has(row.targetId);
    return true;
  });

  return {
    mediaPolicy: bundle.mediaPolicy?.propertyId === propertyId ? bundle.mediaPolicy : undefined,
    floorPlans, spaces, mediaAssets, mediaSpaceLinks, viewerScenes, viewerNodes, viewerEdges,
    walkthroughRoutes, walkthroughSteps, verificationEvents,
  };
}
