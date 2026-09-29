import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { buildOpeningAdjacencyCandidates, readOpeningAdjacencyReviews } from './openingTopologyService';
import { readOpeningDimensions } from './openingDimensionService';
import { buildReviewedWallModel } from './wallModelService';
import { readScaleCalibration } from './measurementCalibrationService';

export interface OpeningCutCandidate {
  candidateId: string;
  semantic: 'door' | 'window';
  wallLayer: string;
  wallSegmentIndex: number;
  centerM: { x: number; y: number };
  widthM: number;
  heightM: number;
  sillHeightM: number;
  status: 'reviewed_cut_candidate';
  booleanApplied: false;
}

function pointSegmentDistance(point: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (!lengthSq) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

export function buildOpeningCutCandidates(asset: DigitalTwinAsset): OpeningCutCandidate[] {
  const scale = readScaleCalibration(asset)?.metersPerDrawingUnit;
  if (!(scale && scale > 0)) return [];

  const approvedIds = new Set(readOpeningAdjacencyReviews(asset).filter((item) => item.decision === 'approved').map((item) => item.candidateId));
  const dimensions = new Map(readOpeningDimensions(asset).map((item) => [item.candidateId, item]));
  const walls = buildReviewedWallModel(asset);
  if (!walls.length) return [];

  return buildOpeningAdjacencyCandidates(asset).flatMap((opening): OpeningCutCandidate[] => {
    if (!approvedIds.has(opening.id)) return [];
    const dimension = dimensions.get(opening.id);
    if (!dimension) return [];
    const centerM = { x: opening.centroid.x * scale, y: opening.centroid.y * scale };
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    walls.forEach((wall, index) => {
      const distance = pointSegmentDistance(centerM, wall.start, wall.end);
      if (distance < bestDistance) { bestDistance = distance; bestIndex = index; }
    });
    if (bestIndex < 0) return [];
    const wall = walls[bestIndex];
    const acceptanceDistance = Math.max(0.4, wall.thicknessM * 1.5);
    if (bestDistance > acceptanceDistance) return [];
    const sillHeightM = opening.semantic === 'door' ? 0 : (dimension.sillHeightM ?? 0);
    if (sillHeightM + dimension.heightM > wall.heightM + 0.02) return [];
    return [{
      candidateId: opening.id,
      semantic: opening.semantic,
      wallLayer: wall.layer,
      wallSegmentIndex: bestIndex,
      centerM,
      widthM: dimension.widthM,
      heightM: dimension.heightM,
      sillHeightM,
      status: 'reviewed_cut_candidate',
      booleanApplied: false,
    }];
  });
}

export const openingCutService = { build: buildOpeningCutCandidates };
