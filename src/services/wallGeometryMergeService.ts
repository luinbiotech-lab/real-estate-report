import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { wallJunctionService } from './wallJunctionService';
import { wallModelService } from './wallModelService';

export interface WallGeometryMergeEligibility {
  junctionId: string;
  segmentIndexes: number[];
  pointM: { x: number; y: number; z: 0 };
  degree: number;
  maxEndpointDriftM: number;
  maxThicknessDeltaM: number;
  eligible: boolean;
  strategy: 'endpoint_snap_candidate' | 'review_required';
  mergeApplied: false;
  reasons: string[];
}

export function buildWallGeometryMergeEligibility(asset: DigitalTwinAsset, toleranceM = 0.05, thicknessToleranceM = 0.08): WallGeometryMergeEligibility[] {
  const walls = wallModelService.build(asset);
  return wallJunctionService.build(asset, toleranceM).map((junction) => {
    const thicknesses = junction.segmentIndexes.map((index) => walls[index]?.thicknessM).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    const maxThicknessDeltaM = thicknesses.length > 1 ? Math.max(...thicknesses) - Math.min(...thicknesses) : 0;
    const reasons: string[] = [];
    if (junction.maxEndpointDriftM > toleranceM) reasons.push(`endpoint drift ${junction.maxEndpointDriftM.toFixed(3)}m > ${toleranceM.toFixed(3)}m`);
    if (maxThicknessDeltaM > thicknessToleranceM) reasons.push(`wall thickness delta ${maxThicknessDeltaM.toFixed(3)}m > ${thicknessToleranceM.toFixed(3)}m`);
    if (junction.degree < 2) reasons.push('junction degree < 2');
    const eligible = reasons.length === 0;
    return {
      junctionId: junction.junctionId,
      segmentIndexes: junction.segmentIndexes,
      pointM: junction.pointM,
      degree: junction.degree,
      maxEndpointDriftM: junction.maxEndpointDriftM,
      maxThicknessDeltaM,
      eligible,
      strategy: eligible ? 'endpoint_snap_candidate' : 'review_required',
      mergeApplied: false,
      reasons: eligible ? ['endpoint와 벽 두께 편차가 허용범위 안에 있습니다. 실제 polygon union/miter는 아직 적용하지 않습니다.'] : reasons,
    };
  });
}

export const wallGeometryMergeService = { build: buildWallGeometryMergeEligibility };
