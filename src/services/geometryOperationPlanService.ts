import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { buildingStackService } from './buildingStackService';
import { openingBooleanEligibilityService } from './openingBooleanEligibilityService';
import { slabCoreAlignmentService } from './slabCoreAlignmentService';
import { verticalCoreService } from './verticalCoreService';
import { wallGeometryMergeService } from './wallGeometryMergeService';

export type GeometryOperationType = 'wall_endpoint_snap' | 'wall_union_miter' | 'opening_boolean' | 'slab_core_boolean' | 'floor_stack_publish';
export type GeometryOperationStatus = 'eligible' | 'blocked' | 'not_applicable';

export interface GeometryOperationStep {
  id: string;
  assetId?: string;
  floorLabel?: string;
  type: GeometryOperationType;
  status: GeometryOperationStatus;
  dependencies: string[];
  targets: string[];
  blockers: string[];
  applied: false;
}

export interface GeometryOperationPlan {
  schemaVersion: 'daon-geometry-operation-plan-v1';
  propertyId?: string;
  generatedAt: string;
  steps: GeometryOperationStep[];
  summary: { eligible: number; blocked: number; notApplicable: number; executableNow: false };
  safety: string[];
}

function floorOf(asset: DigitalTwinAsset) {
  const raw = asset.metadata.floorPlacement;
  return raw && typeof raw === 'object' && typeof (raw as { floorLabel?: unknown }).floorLabel === 'string'
    ? String((raw as { floorLabel: string }).floorLabel)
    : asset.floor;
}

export function buildGeometryOperationPlan(assets: DigitalTwinAsset[]): GeometryOperationPlan {
  const steps: GeometryOperationStep[] = [];

  for (const asset of assets) {
    const floorLabel = floorOf(asset);
    const junctions = wallGeometryMergeService.build(asset);
    const eligibleJunctions = junctions.filter((item) => item.eligible);
    const blockedJunctions = junctions.filter((item) => !item.eligible);
    steps.push({
      id: `${asset.id}:wall_endpoint_snap`, assetId: asset.id, floorLabel, type: 'wall_endpoint_snap',
      status: junctions.length === 0 ? 'not_applicable' : blockedJunctions.length ? 'blocked' : 'eligible',
      dependencies: ['reviewed wall centerlines', 'verified wall thickness', 'junction endpoint tolerance'],
      targets: eligibleJunctions.map((item) => item.junctionId),
      blockers: blockedJunctions.flatMap((item) => item.reasons.map((reason) => `${item.junctionId}: ${reason}`)), applied: false,
    });
    steps.push({
      id: `${asset.id}:wall_union_miter`, assetId: asset.id, floorLabel, type: 'wall_union_miter',
      status: junctions.length === 0 ? 'not_applicable' : blockedJunctions.length ? 'blocked' : 'eligible',
      dependencies: [`${asset.id}:wall_endpoint_snap`, 'polygon offset/union engine'],
      targets: eligibleJunctions.map((item) => item.junctionId),
      blockers: blockedJunctions.length ? ['wall endpoint snap blockers가 해결되어야 합니다.'] : [], applied: false,
    });

    const openings = openingBooleanEligibilityService.build(asset);
    const eligibleOpenings = openings.filter((item) => item.eligible);
    const blockedOpenings = openings.filter((item) => !item.eligible);
    steps.push({
      id: `${asset.id}:opening_boolean`, assetId: asset.id, floorLabel, type: 'opening_boolean',
      status: openings.length === 0 ? 'not_applicable' : blockedOpenings.length ? 'blocked' : 'eligible',
      dependencies: [`${asset.id}:wall_union_miter`, 'reviewed opening topology', 'verified opening dimensions', '3D boolean engine'],
      targets: eligibleOpenings.map((item) => item.candidateId),
      blockers: blockedOpenings.flatMap((item) => item.reasons.map((reason) => `${item.candidateId}: ${reason}`)), applied: false,
    });

    const slabCores = slabCoreAlignmentService.build(asset);
    const alignedCores = slabCores.filter((item) => item.alignmentStatus === 'aligned');
    const blockedCores = slabCores.filter((item) => item.alignmentStatus !== 'aligned');
    steps.push({
      id: `${asset.id}:slab_core_boolean`, assetId: asset.id, floorLabel, type: 'slab_core_boolean',
      status: slabCores.length === 0 ? 'not_applicable' : blockedCores.length ? 'blocked' : 'eligible',
      dependencies: ['reviewed slab footprint', 'verified vertical core footprint', 'slab polygon union/boolean engine'],
      targets: alignedCores.map((item) => item.coreId),
      blockers: blockedCores.flatMap((item) => item.reasons.map((reason) => `${item.coreId}: ${reason}`)), applied: false,
    });
  }

  const stack = buildingStackService.build(assets);
  const verticalCores = verticalCoreService.buildConnections(assets);
  const verticalBlockers = verticalCores.filter((item) => item.alignmentStatus !== 'aligned');
  const prerequisiteBlockers = steps.filter((step) => step.status === 'blocked');
  steps.push({
    id: 'building:floor_stack_publish', type: 'floor_stack_publish',
    status: stack.floors.length === 0 ? 'not_applicable' : prerequisiteBlockers.length || verticalBlockers.length ? 'blocked' : 'eligible',
    dependencies: ['all floor placements reviewed', 'wall/opening/slab operations resolved', 'vertical core alignment reviewed'],
    targets: stack.floors.map((floor) => floor.floorLabel),
    blockers: [
      ...prerequisiteBlockers.map((step) => `${step.floorLabel || step.assetId || 'building'}: ${step.type}`),
      ...verticalBlockers.map((core) => `vertical core ${core.coreId}: ${core.alignmentStatus}`),
    ],
    applied: false,
  });

  const summary = {
    eligible: steps.filter((step) => step.status === 'eligible').length,
    blocked: steps.filter((step) => step.status === 'blocked').length,
    notApplicable: steps.filter((step) => step.status === 'not_applicable').length,
    executableNow: false as const,
  };

  return {
    schemaVersion: 'daon-geometry-operation-plan-v1',
    propertyId: assets[0]?.propertyId,
    generatedAt: new Date().toISOString(),
    steps,
    summary,
    safety: [
      '이 계획은 실제 geometry mutation 전의 실행 순서·의존성·blocker manifest입니다.',
      'eligible은 사전 조건 충족을 의미하며 geometry operation이 실행되었다는 뜻이 아닙니다.',
      '모든 step은 applied=false이며 polygon union/miter, 3D boolean, slab opening, production publish는 아직 수행하지 않습니다.',
      'production/시공/BIM 확정은 별도 geometry engine과 Human Review를 통과한 뒤에만 가능합니다.',
    ],
  };
}

export const geometryOperationPlanService = { build: buildGeometryOperationPlan };
