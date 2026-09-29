import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import type { DxfGeometrySummary } from './floorPlanGeometryService';
import { readFloorPlacement } from './floorPlacementService';
import { readScaleCalibration } from './measurementCalibrationService';
import { slabGeometryService } from './slabGeometryService';
import { verticalCoreService } from './verticalCoreService';

export interface SlabCoreOpeningCandidate {
  coreId: string;
  semantic: 'stair' | 'elevator';
  floorLabel: string;
  layer: string;
  elevationM: number;
  footprint: Array<{ x: number; y: number; z: number }>;
  widthM: number;
  depthM: number;
  intersectsReviewedSlab: boolean;
  alignmentStatus: 'aligned' | 'review_required';
  openingApplied: false;
  reasons: string[];
}

function geometryOf(asset: DigitalTwinAsset): DxfGeometrySummary | undefined {
  const value = asset.metadata.geometry;
  return value && typeof value === 'object' ? value as DxfGeometrySummary : undefined;
}

function pointInPolygon(point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]; const b = polygon[j];
    const intersects = ((a.y > point.y) !== (b.y > point.y)) && (point.x < (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || Number.EPSILON) + a.x);
    if (intersects) inside = !inside;
  }
  return inside;
}

function layerBounds(asset: DigitalTwinAsset, layer: string) {
  const geometry = geometryOf(asset);
  const scale = readScaleCalibration(asset)?.metersPerDrawingUnit;
  if (!geometry || !(scale && scale > 0)) return undefined;
  const points = (geometry.previewSegments ?? []).filter((segment) => segment.layer === layer).flatMap((segment) => segment.points);
  if (!points.length) return undefined;
  const xs = points.map((point) => point.x * scale); const ys = points.map((point) => point.y * scale);
  const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
  return { minX, maxX, minY, maxY, widthM: maxX - minX, depthM: maxY - minY };
}

export function buildSlabCoreOpeningAlignment(asset: DigitalTwinAsset): SlabCoreOpeningCandidate[] {
  const placement = readFloorPlacement(asset);
  if (!placement) return [];
  const slab = slabGeometryService.build(asset);
  if (slab.status !== 'ready') return [];

  return verticalCoreService.buildNodes(asset).flatMap((node): SlabCoreOpeningCandidate[] => {
    const bounds = layerBounds(asset, node.layer);
    if (!bounds || bounds.widthM <= 0 || bounds.depthM <= 0) return [];
    const z = placement.elevationM - placement.slabThicknessM;
    const footprint = [
      { x: bounds.minX, y: bounds.minY, z }, { x: bounds.maxX, y: bounds.minY, z },
      { x: bounds.maxX, y: bounds.maxY, z }, { x: bounds.minX, y: bounds.maxY, z },
    ];
    const center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
    const intersectsReviewedSlab = slab.polygons.some((polygon) => pointInPolygon(center, polygon.polygon));
    const reasons = intersectsReviewedSlab
      ? ['검증된 core layer footprint 중심이 reviewed slab footprint 안에 있습니다. 실제 slab boolean opening은 아직 적용하지 않습니다.']
      : ['core footprint가 reviewed slab footprint와 정합되지 않습니다. room boundary/slab 범위 또는 core layer를 재검토해야 합니다.'];
    return [{
      coreId: node.coreId,
      semantic: node.semantic,
      floorLabel: node.floorLabel,
      layer: node.layer,
      elevationM: node.elevationM,
      footprint,
      widthM: bounds.widthM,
      depthM: bounds.depthM,
      intersectsReviewedSlab,
      alignmentStatus: intersectsReviewedSlab ? 'aligned' : 'review_required',
      openingApplied: false,
      reasons,
    }];
  });
}

export const slabCoreAlignmentService = { build: buildSlabCoreOpeningAlignment };
