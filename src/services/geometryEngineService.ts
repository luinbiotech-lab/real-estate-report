import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { geometryOperationPlanService, type GeometryOperationType } from './geometryOperationPlanService';
import { geometryOperationPreviewService } from './geometryOperationPreviewService';

export interface GeometryEngineCapabilities {
  endpointSnap: boolean;
  wallUnionMiter: boolean;
  openingBoolean: boolean;
  slabCoreBoolean: boolean;
  productionExport: boolean;
}

export interface GeometryEngineDescriptor {
  id: string;
  label: string;
  mode: 'preview_only' | 'mutation_capable';
  capabilities: GeometryEngineCapabilities;
}

export interface GeometryDryRunResult {
  engine: GeometryEngineDescriptor;
  operationPlan: ReturnType<typeof geometryOperationPlanService.build>;
  preview: ReturnType<typeof geometryOperationPreviewService.build>;
  unsupportedEligibleOperations: GeometryOperationType[];
  mutationApplied: false;
}

const previewOnlyEngine: GeometryEngineDescriptor = {
  id: 'daon-preview-only-v1',
  label: 'DA:ON Local Preview Engine',
  mode: 'preview_only',
  capabilities: {
    endpointSnap: true,
    wallUnionMiter: false,
    openingBoolean: false,
    slabCoreBoolean: false,
    productionExport: false,
  },
};

function supports(type: GeometryOperationType, capabilities: GeometryEngineCapabilities) {
  if (type === 'wall_endpoint_snap') return capabilities.endpointSnap;
  if (type === 'wall_union_miter') return capabilities.wallUnionMiter;
  if (type === 'opening_boolean') return capabilities.openingBoolean;
  if (type === 'slab_core_boolean') return capabilities.slabCoreBoolean;
  if (type === 'floor_stack_publish') return capabilities.productionExport;
  return false;
}

export function getGeometryEngineDescriptor(): GeometryEngineDescriptor {
  return previewOnlyEngine;
}

export function dryRunGeometryOperations(assets: DigitalTwinAsset[]): GeometryDryRunResult {
  const operationPlan = geometryOperationPlanService.build(assets);
  const preview = geometryOperationPreviewService.build(assets);
  const unsupportedEligibleOperations = Array.from(new Set(
    operationPlan.steps
      .filter((step) => step.status === 'eligible' && !supports(step.type, previewOnlyEngine.capabilities))
      .map((step) => step.type),
  ));
  return {
    engine: previewOnlyEngine,
    operationPlan,
    preview,
    unsupportedEligibleOperations,
    mutationApplied: false,
  };
}

export function assertMutationEngineConfigured() {
  if (previewOnlyEngine.mode !== 'mutation_capable') {
    throw new Error('실제 geometry mutation engine이 구성되지 않았습니다. 현재 DA:ON Local Preview Engine은 비파괴 preview만 지원합니다.');
  }
}

export const geometryEngineService = {
  getDescriptor: getGeometryEngineDescriptor,
  dryRun: dryRunGeometryOperations,
  assertMutationEngineConfigured,
};
