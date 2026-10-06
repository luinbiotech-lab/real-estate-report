import type {
  MediaAssetRecord,
  SpatialMediaDataRoomBundle,
  SpatialVerificationStatus,
} from '../domain/propertyDataRoom/spatialMediaModel';
import { getSpatialVerificationLevel, isReportSafeMedia } from '../domain/propertyDataRoom/spatialMediaModel';

export interface SpatialMediaSummary {
  floorPlans: number;
  verifiedFloorPlans: number;
  spaces: number;
  verifiedSpaces: number;
  mediaAssets: number;
  reportSafeMedia: number;
  unmatchedMedia: number;
  mediaNeedsReview: number;
  viewerScenes: number;
  readyViewerScenes: number;
  walkthroughRoutes: number;
  verificationEvents: number;
  fieldCheckedOrHigher: number;
  conflictCount: number;
  minimumVerificationLevel: number;
  spatialReady: boolean;
  walkthroughReady: boolean;
  reportSpatialReady: boolean;
}

function isVerifiedStatus(status: SpatialVerificationStatus) {
  return getSpatialVerificationLevel(status) >= 3;
}

function active<T extends { deletedAt?: string }>(items: T[]) {
  return items.filter((item) => !item.deletedAt);
}

function reportSafeMediaCount(items: MediaAssetRecord[]) {
  return items.filter((item) => isReportSafeMedia(item)).length;
}

export const spatialMediaViewService = {
  summarize(bundle: SpatialMediaDataRoomBundle): SpatialMediaSummary {
    const floorPlans = active(bundle.floorPlans);
    const spaces = active(bundle.spaces);
    const mediaAssets = active(bundle.mediaAssets);
    const mediaSpaceLinks = active(bundle.mediaSpaceLinks);
    const viewerScenes = active(bundle.viewerScenes);
    const walkthroughRoutes = active(bundle.walkthroughRoutes);
    const walkthroughSteps = active(bundle.walkthroughSteps);

    const unmatchedMediaIds = new Set(
      mediaAssets
        .filter((asset) => !mediaSpaceLinks.some((link) => link.mediaAssetId === asset.id && ['matched', 'verified'].includes(link.matchStatus)))
        .map((asset) => asset.id),
    );

    const needsReviewIds = new Set(
      mediaSpaceLinks
        .filter((link) => link.matchStatus === 'needs_review' || link.matchStatus === 'suggested')
        .map((link) => link.mediaAssetId),
    );

    const fieldCheckedOrHigher = bundle.verificationEvents.filter((event) => event.verificationLevel >= 4).length;
    const conflictCount = [
      ...floorPlans.map((item) => item.verificationStatus),
      ...spaces.map((item) => item.verificationStatus),
      ...mediaAssets.map((item) => item.verificationStatus),
      ...mediaSpaceLinks.map((item) => item.verificationStatus),
      ...viewerScenes.map((item) => item.verificationStatus),
      ...walkthroughSteps.map((item) => item.verificationStatus),
    ].filter((status) => status === 'conflict').length;

    const verificationLevels = [
      ...floorPlans.map((item) => getSpatialVerificationLevel(item.verificationStatus)),
      ...spaces.map((item) => getSpatialVerificationLevel(item.verificationStatus)),
      ...mediaAssets.map((item) => getSpatialVerificationLevel(item.verificationStatus)),
    ];
    const minimumVerificationLevel = verificationLevels.length ? Math.min(...verificationLevels) : 0;

    const readyViewerScenes = viewerScenes.filter((scene) => scene.generationStatus === 'ready').length;
    const validWalkthroughRoutes = walkthroughRoutes.filter((route) =>
      walkthroughSteps.some((step) => step.routeId === route.id),
    ).length;

    const spatialReady = floorPlans.length > 0 && spaces.length > 0;
    const walkthroughReady = readyViewerScenes > 0 && validWalkthroughRoutes > 0;
    const reportSpatialReady = spatialReady && reportSafeMediaCount(mediaAssets) > 0 && conflictCount === 0;

    return {
      floorPlans: floorPlans.length,
      verifiedFloorPlans: floorPlans.filter((item) => isVerifiedStatus(item.verificationStatus)).length,
      spaces: spaces.length,
      verifiedSpaces: spaces.filter((item) => isVerifiedStatus(item.verificationStatus)).length,
      mediaAssets: mediaAssets.length,
      reportSafeMedia: reportSafeMediaCount(mediaAssets),
      unmatchedMedia: unmatchedMediaIds.size,
      mediaNeedsReview: needsReviewIds.size,
      viewerScenes: viewerScenes.length,
      readyViewerScenes,
      walkthroughRoutes: validWalkthroughRoutes,
      verificationEvents: bundle.verificationEvents.length,
      fieldCheckedOrHigher,
      conflictCount,
      minimumVerificationLevel,
      spatialReady,
      walkthroughReady,
      reportSpatialReady,
    };
  },

  buildReportSpatialSnapshot(bundle: SpatialMediaDataRoomBundle) {
    const summary = this.summarize(bundle);
    return {
      mediaPolicy: bundle.mediaPolicy,
      floorPlans: active(bundle.floorPlans).map((item) => ({
        id: item.id,
        floorId: item.floorId,
        floorLabel: item.floorLabel,
        extractionStatus: item.extractionStatus,
        verificationStatus: item.verificationStatus,
      })),
      spaces: active(bundle.spaces).map((item) => ({
        id: item.id,
        floorId: item.floorId,
        spaceCode: item.spaceCode,
        spaceName: item.spaceName,
        spaceType: item.spaceType,
        areaM2: item.areaM2,
        areaPy: item.areaPy,
        verificationStatus: item.verificationStatus,
      })),
      media: active(bundle.mediaAssets)
        .filter((item) => isReportSafeMedia(item))
        .map((item) => ({
          id: item.id,
          mediaType: item.mediaType,
          originalFilename: item.originalFilename,
          sourceOrigin: item.sourceOrigin,
          visibilityScope: item.visibilityScope,
          verificationStatus: item.verificationStatus,
          caption: item.caption,
        })),
      viewer: {
        scenes: active(bundle.viewerScenes).map((scene) => ({
          id: scene.id,
          sceneType: scene.sceneType,
          title: scene.title,
          generationStatus: scene.generationStatus,
          verificationStatus: scene.verificationStatus,
        })),
        walkthroughRoutes: active(bundle.walkthroughRoutes).map((route) => ({
          id: route.id,
          title: route.title,
          routeType: route.routeType,
          isDefault: route.isDefault,
          stepCount: active(bundle.walkthroughSteps).filter((step) => step.routeId === route.id).length,
        })),
      },
      verification: {
        eventCount: bundle.verificationEvents.length,
        fieldCheckedOrHigher: summary.fieldCheckedOrHigher,
        conflictCount: summary.conflictCount,
        minimumVerificationLevel: summary.minimumVerificationLevel,
      },
      readiness: {
        spatialReady: summary.spatialReady,
        walkthroughReady: summary.walkthroughReady,
        reportSpatialReady: summary.reportSpatialReady,
      },
    };
  },
};
