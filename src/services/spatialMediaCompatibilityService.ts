import type { DataRoomBundle, VerificationStatus } from '../domain/propertyDataRoom/types';
import type {
  MediaAssetRecord,
  SpatialMediaDataRoomBundle,
  SpatialVerificationStatus,
} from '../domain/propertyDataRoom/spatialMediaModel';

function mapVerification(status: VerificationStatus): SpatialVerificationStatus {
  if (status === 'verified') return 'document_verified';
  if (status === 'confirmed' || status === 'imported') return 'source_provided';
  if (status === 'estimated' || status === 'calculated') return 'estimated';
  if (status === 'ai_analysis') return 'ai_estimated';
  return 'unknown';
}

function mapMediaType(mediaType: 'image' | 'video' | 'document'): MediaAssetRecord['mediaType'] {
  if (mediaType === 'video') return 'video';
  if (mediaType === 'document') return 'document_scan';
  return 'photo';
}

export const spatialMediaCompatibilityService = {
  fromLegacyBundle(bundle: DataRoomBundle): SpatialMediaDataRoomBundle {
    const floorPlans = bundle.digitalTwinAssets
      .filter((asset) => asset.assetType === 'floor_plan' || asset.assetType === 'scanned_plan' || asset.assetType === 'dwg' || asset.assetType === 'dxf')
      .map((asset) => ({
        id: 'legacy-floor-plan-' + asset.id,
        propertyId: asset.propertyId,
        floorId: asset.floor,
        floorLabel: asset.floor,
        sourceFileId: asset.sourceDocumentId,
        storagePath: asset.storagePath,
        fileType: asset.assetType === 'dwg' || asset.assetType === 'dxf'
          ? asset.assetType
          : asset.assetType === 'scanned_plan'
            ? 'scan' as const
            : 'image' as const,
        originalFilename: asset.fileName || asset.storagePath,
        scaleStatus: 'unknown' as const,
        extractionStatus: asset.processingStatus === 'ready' ? 'mapped' as const : 'uploaded' as const,
        verificationStatus: 'source_provided' as const,
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
        deletedAt: asset.deletedAt,
      }));

    const spaces = (bundle.spaces ?? []).map((space) => ({
      id: 'legacy-space-' + space.id,
      propertyId: space.propertyId,
      floorId: space.floor,
      spaceCode: space.roomCode,
      spaceName: space.name,
      spaceType: space.spaceType === 'lobby' || space.spaceType === 'corridor' || space.spaceType === 'restroom'
        ? 'common_area' as const
        : space.spaceType === 'basement'
          ? 'storage' as const
          : space.spaceType === 'rooftop'
            ? 'roof' as const
            : space.spaceType === 'other'
              ? 'unknown' as const
              : space.spaceType,
      areaM2: space.areaSqm,
      ceilingHeightM: space.ceilingHeightM,
      geometry2d: {},
      estimatedGeometry3d: {},
      sourceType: space.sourceType === 'agent' ? 'agent' as const : 'manual' as const,
      verificationStatus: mapVerification(space.verificationStatus),
      createdAt: space.createdAt,
      updatedAt: space.updatedAt,
      deletedAt: space.deletedAt,
    }));

    const mediaAssets = bundle.media.map((media) => ({
      id: 'legacy-media-' + media.id,
      propertyId: media.propertyId,
      mediaType: mapMediaType(media.mediaType),
      mimeType: media.mimeType,
      originalFilename: media.fileName,
      storagePath: media.storagePath,
      fileSizeBytes: media.fileSize,
      capturedAt: media.captureDate,
      uploadedAt: media.createdAt,
      sourceOrigin: 'agent_uploaded' as const,
      visibilityScope: 'report' as const,
      processingStatus: 'matched' as const,
      verificationStatus: mapVerification(media.verificationStatus),
      aiAnalysisStatus: media.aiTags.length ? 'completed' as const : 'not_started' as const,
      caption: media.caption,
      notes: media.direction,
      createdAt: media.createdAt,
      updatedAt: media.updatedAt,
      deletedAt: media.deletedAt,
    }));

    const mediaSpaceLinks = (bundle.spaceMediaLinks ?? []).map((link) => ({
      id: 'legacy-media-space-' + link.id,
      mediaAssetId: 'legacy-media-' + link.mediaId,
      propertyId: link.propertyId,
      spaceId: 'legacy-space-' + link.spaceId,
      matchType: link.sourceAgentResultId ? 'ai_visual_match' as const : 'manual' as const,
      matchStatus: typeof link.confidence === 'number' && link.confidence < 0.8 ? 'suggested' as const : 'matched' as const,
      matchConfidence: link.confidence,
      matchSource: link.sourceAgentResultId,
      cameraPosition: {},
      cameraDirection: {},
      displayPriority: 100,
      isRepresentative: false,
      verificationStatus: 'unknown' as const,
      createdAt: link.createdAt,
      updatedAt: link.createdAt,
      deletedAt: link.deletedAt,
    }));

    return {
      floorPlans,
      spaces,
      mediaAssets,
      mediaSpaceLinks,
      viewerScenes: [],
      viewerNodes: [],
      viewerEdges: [],
      walkthroughRoutes: [],
      walkthroughSteps: [],
      verificationEvents: [],
    };
  },

  mergePreferTyped(typed: SpatialMediaDataRoomBundle, legacy: DataRoomBundle): SpatialMediaDataRoomBundle {
    const fallback = this.fromLegacyBundle(legacy);
    return {
      mediaPolicy: typed.mediaPolicy,
      floorPlans: typed.floorPlans.length ? typed.floorPlans : fallback.floorPlans,
      spaces: typed.spaces.length ? typed.spaces : fallback.spaces,
      mediaAssets: typed.mediaAssets.length ? typed.mediaAssets : fallback.mediaAssets,
      mediaSpaceLinks: typed.mediaSpaceLinks.length ? typed.mediaSpaceLinks : fallback.mediaSpaceLinks,
      viewerScenes: typed.viewerScenes,
      viewerNodes: typed.viewerNodes,
      viewerEdges: typed.viewerEdges,
      walkthroughRoutes: typed.walkthroughRoutes,
      walkthroughSteps: typed.walkthroughSteps,
      verificationEvents: typed.verificationEvents,
    };
  },
};
