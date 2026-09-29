import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import type { DxfGeometrySummary } from './floorPlanGeometryService';
import { floorPlanSemanticReviewService } from './floorPlanSemanticReviewService';
import { readScaleCalibration } from './measurementCalibrationService';
import { readVerticalDimensions } from './verticalDimensionService';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';

export interface WallThicknessReview {
  layer: string;
  thicknessM: number;
  sourceLabel: string;
  verifiedAt: string;
  verifiedBy?: string;
  note?: string;
  status: 'verified';
}

export interface ReviewedWallSegment {
  layer: string;
  thicknessM: number;
  heightM: number;
  start: { x: number; y: number; z: 0 };
  end: { x: number; y: number; z: 0 };
  status: 'reviewed_wall_centerline_candidate';
}

function geometryOf(asset: DigitalTwinAsset): DxfGeometrySummary | undefined {
  const value = asset.metadata.geometry;
  return value && typeof value === 'object' ? value as DxfGeometrySummary : undefined;
}

export function readWallThicknessReviews(asset: DigitalTwinAsset): WallThicknessReview[] {
  const raw = asset.metadata.wallThicknessReviews;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is WallThicknessReview => Boolean(
    item && typeof item === 'object' && typeof item.layer === 'string' &&
    Number.isFinite((item as { thicknessM?: number }).thicknessM) && (item as { thicknessM: number }).thicknessM > 0,
  ));
}

export function getApprovedWallLayers(asset: DigitalTwinAsset) {
  return floorPlanSemanticReviewService.getReviews(asset)
    .filter((review) => review.decision === 'approved' && review.semantic === 'wall')
    .map((review) => review.layer);
}

export function buildReviewedWallModel(asset: DigitalTwinAsset): ReviewedWallSegment[] {
  const geometry = geometryOf(asset);
  const scale = readScaleCalibration(asset);
  const vertical = readVerticalDimensions(asset);
  if (!geometry || !scale || !vertical) return [];

  const approvedLayers = new Set(getApprovedWallLayers(asset));
  const thicknessByLayer = new Map(readWallThicknessReviews(asset).map((item) => [item.layer, item]));
  const heightM = vertical.ceilingHeightM ?? vertical.floorHeightM;
  if (!(heightM && heightM > 0)) return [];

  const segments: ReviewedWallSegment[] = [];
  for (const segment of geometry.previewSegments ?? []) {
    if (!segment.layer || !approvedLayers.has(segment.layer)) continue;
    const thickness = thicknessByLayer.get(segment.layer);
    if (!thickness) continue;
    for (let index = 0; index + 1 < segment.points.length; index += 1) {
      const a = segment.points[index];
      const b = segment.points[index + 1];
      if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) continue;
      segments.push({
        layer: segment.layer,
        thicknessM: thickness.thicknessM,
        heightM,
        start: { x: a.x * scale.metersPerDrawingUnit, y: a.y * scale.metersPerDrawingUnit, z: 0 },
        end: { x: b.x * scale.metersPerDrawingUnit, y: b.y * scale.metersPerDrawingUnit, z: 0 },
        status: 'reviewed_wall_centerline_candidate',
      });
    }
  }
  return segments;
}

export async function saveWallThicknessReview(asset: DigitalTwinAsset, input: { layer: string; thicknessM: number; sourceLabel: string; verifiedBy?: string; note?: string }) {
  if (!getApprovedWallLayers(asset).includes(input.layer)) throw new Error('승인된 wall layer만 두께를 확정할 수 있습니다.');
  if (!(Number.isFinite(input.thicknessM) && input.thicknessM > 0 && input.thicknessM <= 2)) throw new Error('벽 두께는 0보다 크고 2m 이하여야 합니다.');
  if (!input.sourceLabel.trim()) throw new Error('벽 두께 확인 근거를 입력하세요.');

  const now = new Date().toISOString();
  const reviews = readWallThicknessReviews(asset).filter((item) => item.layer !== input.layer);
  reviews.push({
    layer: input.layer,
    thicknessM: input.thicknessM,
    sourceLabel: input.sourceLabel.trim(),
    verifiedAt: now,
    verifiedBy: input.verifiedBy?.trim() || undefined,
    note: input.note?.trim() || undefined,
    status: 'verified',
  });
  const updated = { ...asset, metadata: { ...asset.metadata, wallThicknessReviews: reviews, wallThicknessUpdatedAt: now }, updatedAt: now };
  await propertyDataRoomRepository.saveDigitalTwinAsset(updated);
  return updated;
}

export const wallModelService = {
  getApprovedWallLayers,
  readThicknessReviews: readWallThicknessReviews,
  build: buildReviewedWallModel,
  saveThicknessReview: saveWallThicknessReview,
};
