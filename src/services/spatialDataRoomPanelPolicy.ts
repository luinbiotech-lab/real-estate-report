import type { DataRoomBundle } from '../domain/propertyDataRoom/types';
import { BANGBAE_815_11_MEDIA_POLICY, type PropertyMediaPolicy, type SpatialMediaDataRoomBundle } from '../domain/propertyDataRoom/spatialMediaModel';
import { isBangbae81511 } from '../domain/professionalReport/reportAccessPolicy';
import { scopeDataRoomBundle } from './propertyReadinessService';
import { scopeReportSpatialBundle } from './reportEngine/reportSpatialPropertyScope';
import { spatialMediaCompatibilityService } from './spatialMediaCompatibilityService';

/** Filter typed and legacy evidence by Property before merging, then remove dangling spatial references. */
export function prepareSpatialPanelBundle(
  typed: SpatialMediaDataRoomBundle, legacy: DataRoomBundle | undefined, propertyId: string,
): SpatialMediaDataRoomBundle {
  const scopedTyped = scopeReportSpatialBundle(typed, propertyId);
  const scopedLegacy = legacy ? scopeDataRoomBundle(legacy, propertyId) : undefined;
  const merged = scopedLegacy
    ? spatialMediaCompatibilityService.mergePreferTyped(scopedTyped, scopedLegacy)
    : scopedTyped;
  return scopeReportSpatialBundle(merged, propertyId);
}

/** Viewer must not read the raw legacy bundle: it may contain another Property's GLB assets. */
export function getSpatialPanelLegacyTwinAssets(
  legacy: DataRoomBundle | undefined, propertyId: string,
): DataRoomBundle['digitalTwinAssets'] {
  return legacy ? scopeDataRoomBundle(legacy, propertyId).digitalTwinAssets : [];
}

/**
 * A connected GLB URL is only a renderable model, not evidence of measured geometry.
 * Never label a scene verified without report-grade scaled floor evidence AND
 * a verified, ready model record. This is a display-only guard, not an approval.
 */
export function assessSpatialPanelModelEvidence(
  scenes: SpatialMediaDataRoomBundle['viewerScenes'],
  reportSpatialReady: boolean,
): { modelCount: number; verifiedModelCount: number } {
  const models = scenes.filter((scene) => !scene.deletedAt &&
    (scene.modelSourceType === 'glb' || scene.modelSourceType === 'gltf') &&
    typeof scene.modelUrl === 'string' && scene.modelUrl.trim().length > 0);
  const verifiedStatuses = new Set(['document_verified', 'field_checked', 'owner_confirmed', 'agent_verified']);
  return {
    modelCount: models.length,
    verifiedModelCount: reportSpatialReady
      ? models.filter((scene) => scene.generationStatus === 'ready' && verifiedStatuses.has(scene.verificationStatus)).length
      : 0,
  };
}

/** A stale/editable media preference cannot override Bangbae 815-11's locked no-interior rule. */
export function getSpatialPanelPolicy(
  bundle: SpatialMediaDataRoomBundle, propertyId: string, propertyAddress?: string,
): PropertyMediaPolicy | undefined {
  const stored = bundle.mediaPolicy?.propertyId === propertyId ? bundle.mediaPolicy : undefined;
  const restricted = isBangbae81511({ id: propertyId, address: propertyAddress ?? '', detailAddress: '' });
  if (!restricted) return stored;
  return { ...BANGBAE_815_11_MEDIA_POLICY, ...stored, propertyId, allowInteriorPhotos: false };
}
