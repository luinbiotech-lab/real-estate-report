import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { wallModelService, type ReviewedWallSegment } from './wallModelService';

export interface WallJunctionCandidate {
  junctionId: string;
  pointM: { x: number; y: number; z: 0 };
  segmentIndexes: number[];
  degree: number;
  maxEndpointDriftM: number;
  status: 'reviewed_wall_junction_candidate';
  geometryMerged: false;
}

function endpoints(segment: ReviewedWallSegment) { return [segment.start, segment.end]; }
function distance(a: { x: number; y: number }, b: { x: number; y: number }) { return Math.hypot(a.x - b.x, a.y - b.y); }

export function buildWallJunctionCandidates(asset: DigitalTwinAsset, toleranceM = 0.05): WallJunctionCandidate[] {
  const walls = wallModelService.build(asset);
  const endpointRecords = walls.flatMap((wall, segmentIndex) => endpoints(wall).map((point, endpointIndex) => ({ segmentIndex, endpointIndex, point })));
  const visited = new Set<number>();
  const result: WallJunctionCandidate[] = [];

  for (let i = 0; i < endpointRecords.length; i += 1) {
    if (visited.has(i)) continue;
    const group = [i];
    visited.add(i);
    for (let j = i + 1; j < endpointRecords.length; j += 1) {
      if (visited.has(j)) continue;
      if (distance(endpointRecords[i].point, endpointRecords[j].point) <= toleranceM) { group.push(j); visited.add(j); }
    }
    const segmentIndexes = [...new Set(group.map((index) => endpointRecords[index].segmentIndex))];
    if (segmentIndexes.length < 2) continue;
    const points = group.map((index) => endpointRecords[index].point);
    const center = {
      x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
      z: 0 as const,
    };
    const maxEndpointDriftM = Math.max(...points.map((point) => distance(point, center)));
    result.push({
      junctionId: `junction-${result.length + 1}`,
      pointM: center,
      segmentIndexes,
      degree: segmentIndexes.length,
      maxEndpointDriftM,
      status: 'reviewed_wall_junction_candidate',
      geometryMerged: false,
    });
  }
  return result;
}

export const wallJunctionService = { build: buildWallJunctionCandidates };
