import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import type { DxfGeometrySummary } from './floorPlanGeometryService';
import { floorPlanSemanticReviewService } from './floorPlanSemanticReviewService';
import { readScaleCalibration } from './measurementCalibrationService';
import { readFloorPlacement } from './floorPlacementService';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';

export type VerticalCoreSemantic = 'stair' | 'elevator';

export interface VerticalCoreReview {
  coreId: string;
  semantic: VerticalCoreSemantic;
  layer: string;
  status: 'verified';
  sourceLabel: string;
  note?: string;
  verifiedAt: string;
  verifiedBy?: string;
}

export interface VerticalCoreNode {
  assetId: string;
  floorLabel: string;
  elevationM: number;
  coreId: string;
  semantic: VerticalCoreSemantic;
  layer: string;
  centerM: { x: number; y: number; z: number };
  status: 'reviewed_core_node';
}

export interface VerticalCoreConnection {
  coreId: string;
  semantic: VerticalCoreSemantic;
  floors: string[];
  nodes: VerticalCoreNode[];
  maxPlanDriftM: number;
  alignmentStatus: 'aligned' | 'review_required';
  productionConnectivityReady: false;
}

function geometryOf(asset: DigitalTwinAsset): DxfGeometrySummary | undefined {
  const value = asset.metadata.geometry;
  return value && typeof value === 'object' ? value as DxfGeometrySummary : undefined;
}

export function readVerticalCoreReviews(asset: DigitalTwinAsset): VerticalCoreReview[] {
  const raw = asset.metadata.verticalCoreReviews;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is VerticalCoreReview => Boolean(
    item && typeof item === 'object' && typeof item.coreId === 'string' && typeof item.layer === 'string' &&
    (item.semantic === 'stair' || item.semantic === 'elevator') && item.status === 'verified',
  ));
}

export function getApprovedCoreLayers(asset: DigitalTwinAsset) {
  return floorPlanSemanticReviewService.getReviews(asset)
    .filter((review) => review.decision === 'approved' && (review.semantic === 'stair' || review.semantic === 'elevator'))
    .map((review) => ({ layer: review.layer, semantic: review.semantic as VerticalCoreSemantic }));
}

function layerCentroid(asset: DigitalTwinAsset, layer: string) {
  const geometry = geometryOf(asset);
  const scale = readScaleCalibration(asset)?.metersPerDrawingUnit;
  if (!geometry || !(scale && scale > 0)) return undefined;
  const points = (geometry.previewSegments ?? []).filter((segment) => segment.layer === layer).flatMap((segment) => segment.points);
  if (!points.length) return undefined;
  const x = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const y = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  return { x: x * scale, y: y * scale };
}

export function buildVerticalCoreNodes(asset: DigitalTwinAsset): VerticalCoreNode[] {
  const placement = readFloorPlacement(asset);
  if (!placement) return [];
  const approved = new Map(getApprovedCoreLayers(asset).map((item) => [item.layer, item.semantic]));
  return readVerticalCoreReviews(asset).flatMap((review): VerticalCoreNode[] => {
    if (approved.get(review.layer) !== review.semantic) return [];
    const center = layerCentroid(asset, review.layer);
    if (!center) return [];
    return [{
      assetId: asset.id,
      floorLabel: placement.floorLabel,
      elevationM: placement.elevationM,
      coreId: review.coreId,
      semantic: review.semantic,
      layer: review.layer,
      centerM: { x: center.x, y: center.y, z: placement.elevationM },
      status: 'reviewed_core_node',
    }];
  });
}

export function buildVerticalCoreConnections(assets: DigitalTwinAsset[], toleranceM = 0.35): VerticalCoreConnection[] {
  const nodes = assets.flatMap(buildVerticalCoreNodes);
  const grouped = new Map<string, VerticalCoreNode[]>();
  for (const node of nodes) {
    const key = `${node.semantic}:${node.coreId}`;
    grouped.set(key, [...(grouped.get(key) ?? []), node]);
  }
  return [...grouped.values()].map((group) => {
    const sorted = [...group].sort((a, b) => a.elevationM - b.elevationM);
    let maxPlanDriftM = 0;
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        maxPlanDriftM = Math.max(maxPlanDriftM, Math.hypot(sorted[i].centerM.x - sorted[j].centerM.x, sorted[i].centerM.y - sorted[j].centerM.y));
      }
    }
    return {
      coreId: sorted[0].coreId,
      semantic: sorted[0].semantic,
      floors: sorted.map((node) => node.floorLabel),
      nodes: sorted,
      maxPlanDriftM,
      alignmentStatus: sorted.length >= 2 && maxPlanDriftM <= toleranceM ? 'aligned' : 'review_required',
      productionConnectivityReady: false,
    };
  });
}

export async function saveVerticalCoreReview(asset: DigitalTwinAsset, input: { coreId: string; semantic: VerticalCoreSemantic; layer: string; sourceLabel: string; note?: string; verifiedBy?: string }) {
  const approved = getApprovedCoreLayers(asset);
  if (!approved.some((item) => item.layer === input.layer && item.semantic === input.semantic)) throw new Error('승인된 stair/elevator layer만 vertical core로 연결할 수 있습니다.');
  if (!input.coreId.trim()) throw new Error('층간 연결에 사용할 Core ID를 입력하세요.');
  if (!input.sourceLabel.trim()) throw new Error('Core 연결 확인 근거를 입력하세요.');
  const now = new Date().toISOString();
  const reviews = readVerticalCoreReviews(asset).filter((item) => !(item.layer === input.layer && item.semantic === input.semantic));
  const review: VerticalCoreReview = {
    coreId: input.coreId.trim(), semantic: input.semantic, layer: input.layer, status: 'verified',
    sourceLabel: input.sourceLabel.trim(), note: input.note?.trim() || undefined,
    verifiedAt: now, verifiedBy: input.verifiedBy?.trim() || undefined,
  };
  reviews.push(review);
  const saved = await propertyDataRoomRepository.saveDigitalTwinAsset({
    ...asset,
    metadata: { ...asset.metadata, verticalCoreReviews: reviews, verticalCoreUpdatedAt: now },
    updatedAt: now,
  });
  await propertyDataRoomRepository.saveDataSource({
    id: crypto.randomUUID(), propertyId: asset.propertyId, resourceType: 'digital_twin_vertical_core', sourceType: 'manual',
    sourceName: review.sourceLabel, sourceReference: asset.id, collectedAt: now, verificationStatus: 'verified',
    metadata: { digitalTwinAssetId: asset.id, coreId: review.coreId, semantic: review.semantic, layer: review.layer, note: review.note }, createdAt: now,
  });
  return saved;
}

export const verticalCoreService = {
  approvedLayers: getApprovedCoreLayers,
  readReviews: readVerticalCoreReviews,
  buildNodes: buildVerticalCoreNodes,
  buildConnections: buildVerticalCoreConnections,
  saveReview: saveVerticalCoreReview,
};
