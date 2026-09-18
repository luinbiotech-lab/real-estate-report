import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { geometryOperationPlanService } from './geometryOperationPlanService';
import { openingBooleanEligibilityService } from './openingBooleanEligibilityService';
import { openingCutService } from './openingCutService';
import { readFloorPlacement } from './floorPlacementService';
import { slabCoreAlignmentService } from './slabCoreAlignmentService';
import { wallGeometryMergeService } from './wallGeometryMergeService';
import { wallModelService, type ReviewedWallSegment } from './wallModelService';

export interface SnappedWallPreview extends ReviewedWallSegment {
  sourceSegmentIndex: number;
  snapAppliedInPreview: boolean;
  previewOnly: true;
}

export interface OpeningCutterPreview {
  candidateId: string;
  semantic: 'door' | 'window';
  wallSegmentIndex: number;
  center: { x: number; y: number; z: number };
  widthM: number;
  heightM: number;
  depthM: number;
  yawRad: number;
  booleanApplied: false;
  previewOnly: true;
}

export interface SlabCoreCutterPreview {
  coreId: string;
  semantic: 'stair' | 'elevator';
  floorLabel: string;
  center: { x: number; y: number; z: number };
  widthM: number;
  depthM: number;
  heightM: number;
  booleanApplied: false;
  previewOnly: true;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function buildSnappedWallPreview(asset: DigitalTwinAsset): SnappedWallPreview[] {
  const walls = wallModelService.build(asset);
  const preview = walls.map((wall, sourceSegmentIndex) => ({ ...wall, sourceSegmentIndex, snapAppliedInPreview: false, previewOnly: true as const }));
  const eligible = wallGeometryMergeService.build(asset).filter((item) => item.eligible);
  for (const junction of eligible) {
    for (const segmentIndex of junction.segmentIndexes) {
      const segment = preview[segmentIndex];
      if (!segment) continue;
      const startDistance = distance(segment.start, junction.pointM);
      const endDistance = distance(segment.end, junction.pointM);
      if (startDistance <= endDistance) segment.start = { ...junction.pointM };
      else segment.end = { ...junction.pointM };
      segment.snapAppliedInPreview = true;
    }
  }
  return preview;
}

export function buildOpeningCutterPreviews(asset: DigitalTwinAsset): OpeningCutterPreview[] {
  const walls = wallModelService.build(asset);
  const cutById = new Map(openingCutService.build(asset).map((item) => [item.candidateId, item]));
  return openingBooleanEligibilityService.build(asset).flatMap((eligibility): OpeningCutterPreview[] => {
    if (!eligibility.eligible) return [];
    const cut = cutById.get(eligibility.candidateId);
    const wall = walls[eligibility.wallSegmentIndex];
    if (!cut || !wall) return [];
    const yawRad = Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x);
    return [{
      candidateId: cut.candidateId,
      semantic: cut.semantic,
      wallSegmentIndex: cut.wallSegmentIndex,
      center: { x: cut.centerM.x, y: cut.centerM.y, z: cut.sillHeightM + cut.heightM / 2 },
      widthM: cut.widthM,
      heightM: cut.heightM,
      depthM: wall.thicknessM + 0.04,
      yawRad,
      booleanApplied: false,
      previewOnly: true,
    }];
  });
}

export function buildSlabCoreCutterPreviews(asset: DigitalTwinAsset): SlabCoreCutterPreview[] {
  const placement = readFloorPlacement(asset);
  if (!placement) return [];
  return slabCoreAlignmentService.build(asset).flatMap((core): SlabCoreCutterPreview[] => {
    if (core.alignmentStatus !== 'aligned' || !core.footprint.length) return [];
    const xs = core.footprint.map((point) => point.x);
    const ys = core.footprint.map((point) => point.y);
    const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
    return [{
      coreId: core.coreId,
      semantic: core.semantic,
      floorLabel: core.floorLabel,
      center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: placement.elevationM - placement.slabThicknessM / 2 },
      widthM: maxX - minX,
      depthM: maxY - minY,
      heightM: placement.slabThicknessM + 0.04,
      booleanApplied: false,
      previewOnly: true,
    }];
  });
}

export function buildGeometryOperationPreview(assets: DigitalTwinAsset[]) {
  const operationPlan = geometryOperationPlanService.build(assets);
  const byAsset = assets.map((asset) => ({
    assetId: asset.id,
    floorLabel: readFloorPlacement(asset)?.floorLabel ?? asset.floor,
    snappedWalls: buildSnappedWallPreview(asset),
    openingCutters: buildOpeningCutterPreviews(asset),
    slabCoreCutters: buildSlabCoreCutterPreviews(asset),
  }));
  const snapCount = byAsset.reduce((sum, item) => sum + item.snappedWalls.filter((wall) => wall.snapAppliedInPreview).length, 0);
  const openingCutterCount = byAsset.reduce((sum, item) => sum + item.openingCutters.length, 0);
  const slabCoreCutterCount = byAsset.reduce((sum, item) => sum + item.slabCoreCutters.length, 0);
  return {
    schemaVersion: 'daon-geometry-operation-preview-v1' as const,
    generatedAt: new Date().toISOString(),
    propertyId: assets[0]?.propertyId,
    operationPlan,
    byAsset,
    summary: { snapCount, openingCutterCount, slabCoreCutterCount, geometryMutated: false as const },
    safety: [
      'endpoint snap은 preview 객체에만 반영되고 원본 Digital Twin asset을 변경하지 않습니다.',
      'opening/slab-core cutter는 boolean 입력용 volume 후보이며 booleanApplied=false입니다.',
      'wall polygon union/miter, opening subtraction, slab subtraction은 geometry engine 연결 전까지 실행하지 않습니다.',
    ],
  };
}

export const geometryOperationPreviewService = {
  build: buildGeometryOperationPreview,
  buildSnappedWalls: buildSnappedWallPreview,
  buildOpeningCutters: buildOpeningCutterPreviews,
  buildSlabCoreCutters: buildSlabCoreCutterPreviews,
};
