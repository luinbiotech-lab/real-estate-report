import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { openingBooleanEligibilityService } from './openingBooleanEligibilityService';
import { openingCutService } from './openingCutService';
import { slabCoreAlignmentService } from './slabCoreAlignmentService';
import { slabGeometryService } from './slabGeometryService';
import { wallGeometryMergeService } from './wallGeometryMergeService';
import { wallModelService } from './wallModelService';

export const GEOMETRY_MUTATION_ENGINE_ID = 'daon-solid-partition-v1';
export const GEOMETRY_MUTATION_SCHEMA_VERSION = 'daon-geometry-mutation-v1';

type Point2 = { x: number; y: number };
type Point3 = { x: number; y: number; z: number };

export interface WallPartition {
  u0: number;
  u1: number;
  z0: number;
  z1: number;
}

export interface MutatedWallSolid {
  wallSegmentIndex: number;
  layer: string;
  start: Point3;
  end: Point3;
  thicknessM: number;
  heightM: number;
  lengthM: number;
  partitions: WallPartition[];
  openingIds: string[];
  unionApplied: boolean;
  miterStrategy: 'endpoint_snap_plus_junction_fill';
}

export interface JunctionFillSolid {
  junctionId: string;
  center: Point3;
  sizeM: number;
  heightM: number;
  segmentIndexes: number[];
  unionApplied: true;
}

export interface SlabSolidWithOpenings {
  roomId: string;
  elevationM: number;
  thicknessM: number;
  shell: Point2[];
  holes: Array<{ coreId: string; semantic: 'stair' | 'elevator'; ring: Point2[] }>;
  subtractionApplied: boolean;
}

export interface GeometryMutationValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    wallCount: number;
    wallPartitionCount: number;
    openingSubtractionCount: number;
    junctionUnionCount: number;
    slabCount: number;
    slabCoreSubtractionCount: number;
  };
}

export interface GeometryMutationResult {
  schemaVersion: typeof GEOMETRY_MUTATION_SCHEMA_VERSION;
  engineId: typeof GEOMETRY_MUTATION_ENGINE_ID;
  sourceAssetId: string;
  generatedAt: string;
  status: 'mutated_candidate' | 'blocked';
  operations: {
    wallUnionMiterApplied: boolean;
    openingSubtractionApplied: boolean;
    slabCoreSubtractionApplied: boolean;
  };
  walls: MutatedWallSolid[];
  junctionFills: JunctionFillSolid[];
  slabs: SlabSolidWithOpenings[];
  validation: GeometryMutationValidation;
  productionCandidateEligible: boolean;
  constructionReady: false;
}

function dist(a: Point2, b: Point2) { return Math.hypot(b.x - a.x, b.y - a.y); }
function finite(value: number) { return Number.isFinite(value); }

function pointInPolygon(point: Point2, polygon: Point2[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]; const b = polygon[j];
    const hit = ((a.y > point.y) !== (b.y > point.y)) && point.x < (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || Number.EPSILON) + a.x;
    if (hit) inside = !inside;
  }
  return inside;
}

function splitPartition(partition: WallPartition, cut: { u0: number; u1: number; z0: number; z1: number }) {
  const iu0 = Math.max(partition.u0, cut.u0); const iu1 = Math.min(partition.u1, cut.u1);
  const iz0 = Math.max(partition.z0, cut.z0); const iz1 = Math.min(partition.z1, cut.z1);
  if (iu1 <= iu0 || iz1 <= iz0) return [partition];
  const pieces: WallPartition[] = [];
  if (partition.u0 < iu0) pieces.push({ u0: partition.u0, u1: iu0, z0: partition.z0, z1: partition.z1 });
  if (iu1 < partition.u1) pieces.push({ u0: iu1, u1: partition.u1, z0: partition.z0, z1: partition.z1 });
  if (partition.z0 < iz0) pieces.push({ u0: iu0, u1: iu1, z0: partition.z0, z1: iz0 });
  if (iz1 < partition.z1) pieces.push({ u0: iu0, u1: iu1, z0: iz1, z1: partition.z1 });
  return pieces.filter((item) => item.u1 - item.u0 > 1e-5 && item.z1 - item.z0 > 1e-5);
}

function snapWalls(asset: DigitalTwinAsset) {
  const original = wallModelService.build(asset);
  const snapped = original.map((wall) => ({ ...wall, start: { ...wall.start }, end: { ...wall.end } }));
  const eligible = wallGeometryMergeService.build(asset).filter((item) => item.eligible);
  for (const junction of eligible) {
    for (const segmentIndex of junction.segmentIndexes) {
      const wall = snapped[segmentIndex];
      if (!wall) continue;
      const startDistance = dist(wall.start, junction.pointM);
      const endDistance = dist(wall.end, junction.pointM);
      if (startDistance <= endDistance) wall.start = { ...junction.pointM };
      else wall.end = { ...junction.pointM };
    }
  }
  return { original, snapped, eligible };
}

export function mutateGeometry(asset: DigitalTwinAsset): GeometryMutationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { snapped, eligible: eligibleJunctions } = snapWalls(asset);
  const openingEligibility = openingBooleanEligibilityService.build(asset);
  const openingCuts = new Map(openingCutService.build(asset).map((item) => [item.candidateId, item]));
  const blockedJunctions = wallGeometryMergeService.build(asset).filter((item) => !item.eligible);
  if (blockedJunctions.length) errors.push(`${blockedJunctions.length}개 wall junction이 merge eligibility를 통과하지 못했습니다.`);
  const blockedOpenings = openingEligibility.filter((item) => !item.eligible);
  if (blockedOpenings.length) errors.push(`${blockedOpenings.length}개 opening이 boolean eligibility를 통과하지 못했습니다.`);

  const walls: MutatedWallSolid[] = snapped.map((wall, wallSegmentIndex) => {
    const lengthM = dist(wall.start, wall.end);
    let partitions: WallPartition[] = lengthM > 0 ? [{ u0: 0, u1: lengthM, z0: 0, z1: wall.heightM }] : [];
    const openingIds: string[] = [];
    for (const eligibility of openingEligibility.filter((item) => item.eligible && item.wallSegmentIndex === wallSegmentIndex)) {
      const cut = openingCuts.get(eligibility.candidateId);
      if (!cut) continue;
      // openingCutService maps the reviewed opening to this segment. Its center candidate is represented
      // conservatively at the segment midpoint until along-wall station review is introduced.
      const centerU = lengthM / 2;
      const cutBox = { u0: Math.max(0, centerU - cut.widthM / 2), u1: Math.min(lengthM, centerU + cut.widthM / 2), z0: cut.sillHeightM, z1: cut.sillHeightM + cut.heightM };
      partitions = partitions.flatMap((partition) => splitPartition(partition, cutBox));
      openingIds.push(cut.candidateId);
    }
    return {
      wallSegmentIndex, layer: wall.layer, start: wall.start, end: wall.end, thicknessM: wall.thicknessM,
      heightM: wall.heightM, lengthM, partitions, openingIds,
      unionApplied: eligibleJunctions.some((item) => item.segmentIndexes.includes(wallSegmentIndex)),
      miterStrategy: 'endpoint_snap_plus_junction_fill' as const,
    };
  });

  const junctionFills: JunctionFillSolid[] = eligibleJunctions.flatMap((junction): JunctionFillSolid[] => {
    const participating = junction.segmentIndexes.map((index) => snapped[index]).filter(Boolean);
    if (!participating.length) return [];
    return [{
      junctionId: junction.junctionId,
      center: junction.pointM,
      sizeM: Math.max(...participating.map((item) => item.thicknessM)),
      heightM: Math.min(...participating.map((item) => item.heightM)),
      segmentIndexes: junction.segmentIndexes,
      unionApplied: true,
    }];
  });

  const slab = slabGeometryService.build(asset);
  const coreAlignment = slabCoreAlignmentService.build(asset);
  const blockedCores = coreAlignment.filter((item) => item.alignmentStatus !== 'aligned');
  if (blockedCores.length) errors.push(`${blockedCores.length}개 slab/core opening이 alignment를 통과하지 못했습니다.`);
  const slabs: SlabSolidWithOpenings[] = slab.status === 'ready' ? slab.polygons.map((polygon) => {
    const holes = coreAlignment.filter((item) => item.alignmentStatus === 'aligned').flatMap((core) => {
      const ring = core.footprint.map((point) => ({ x: point.x, y: point.y }));
      const allInside = ring.every((point) => pointInPolygon(point, polygon.polygon));
      if (!allInside) return [];
      return [{ coreId: core.coreId, semantic: core.semantic, ring }];
    });
    return { roomId: polygon.roomId, elevationM: polygon.elevationM, thicknessM: polygon.thicknessM, shell: polygon.polygon, holes, subtractionApplied: holes.length > 0 };
  }) : [];
  if (slab.status !== 'ready') warnings.push('검증된 slab geometry가 없어 slab/core subtraction 결과를 만들지 못했습니다.');

  for (const wall of walls) {
    if (!(wall.lengthM > 0 && wall.thicknessM > 0 && wall.heightM > 0)) errors.push(`wall ${wall.wallSegmentIndex} 치수가 유효하지 않습니다.`);
    if (![wall.start.x, wall.start.y, wall.end.x, wall.end.y, ...wall.partitions.flatMap((p) => [p.u0, p.u1, p.z0, p.z1])].every(finite)) errors.push(`wall ${wall.wallSegmentIndex}에 비정상 좌표가 있습니다.`);
  }
  for (const item of slabs) if (item.shell.length < 3) errors.push(`slab ${item.roomId} shell이 유효하지 않습니다.`);
  if (!walls.length) errors.push('검증된 wall solid가 없습니다.');

  const stats = {
    wallCount: walls.length,
    wallPartitionCount: walls.reduce((sum, item) => sum + item.partitions.length, 0),
    openingSubtractionCount: walls.reduce((sum, item) => sum + item.openingIds.length, 0),
    junctionUnionCount: junctionFills.length,
    slabCount: slabs.length,
    slabCoreSubtractionCount: slabs.reduce((sum, item) => sum + item.holes.length, 0),
  };
  const validation: GeometryMutationValidation = { valid: errors.length === 0, errors, warnings, stats };
  return {
    schemaVersion: GEOMETRY_MUTATION_SCHEMA_VERSION,
    engineId: GEOMETRY_MUTATION_ENGINE_ID,
    sourceAssetId: asset.id,
    generatedAt: new Date().toISOString(),
    status: validation.valid ? 'mutated_candidate' : 'blocked',
    operations: {
      wallUnionMiterApplied: eligibleJunctions.length > 0,
      openingSubtractionApplied: stats.openingSubtractionCount > 0,
      slabCoreSubtractionApplied: stats.slabCoreSubtractionCount > 0,
    },
    walls, junctionFills, slabs, validation,
    productionCandidateEligible: validation.valid,
    constructionReady: false,
  };
}

export const geometryMutationEngineService = {
  engineId: GEOMETRY_MUTATION_ENGINE_ID,
  mutate: mutateGeometry,
};
