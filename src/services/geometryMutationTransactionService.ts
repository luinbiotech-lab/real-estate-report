import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { geometryMutationEngineService, type GeometryMutationResult } from './geometryMutationEngineService';

export const PRODUCTION_CANDIDATE_VERSION = 'daon-production-candidate-v1';

export interface GeometryMutationHistoryEntry {
  id: string;
  createdAt: string;
  action: 'mutation_preview_saved' | 'production_candidate_promoted' | 'rollback';
  engineId: string;
  result: GeometryMutationResult;
  previousProductionCandidate?: unknown;
}

function historyOf(asset: DigitalTwinAsset): GeometryMutationHistoryEntry[] {
  const raw = asset.metadata.geometryMutationHistory;
  return Array.isArray(raw) ? raw.filter((item): item is GeometryMutationHistoryEntry => Boolean(item && typeof item === 'object')) : [];
}

function nextId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getProductionCandidate(asset: DigitalTwinAsset) {
  const value = asset.metadata.productionGeometryCandidate;
  return value && typeof value === 'object' ? value as Record<string, unknown> : undefined;
}

export async function runAndSaveMutation(asset: DigitalTwinAsset) {
  const result = geometryMutationEngineService.mutate(asset);
  const now = new Date().toISOString();
  const entry: GeometryMutationHistoryEntry = {
    id: nextId('mutation'), createdAt: now, action: 'mutation_preview_saved', engineId: result.engineId, result,
    previousProductionCandidate: getProductionCandidate(asset),
  };
  const updated: DigitalTwinAsset = {
    ...asset,
    metadata: {
      ...asset.metadata,
      latestGeometryMutation: result,
      geometryMutationHistory: [...historyOf(asset), entry],
      geometryMutationUpdatedAt: now,
    },
    updatedAt: now,
  };
  await propertyDataRoomRepository.saveDigitalTwinAsset(updated);
  return { asset: updated, result };
}

export async function promoteProductionCandidate(asset: DigitalTwinAsset) {
  const result = geometryMutationEngineService.mutate(asset);
  if (!result.validation.valid || !result.productionCandidateEligible) {
    throw new Error(`Production candidate 승격 불가: ${result.validation.errors.join(' / ') || 'geometry validation failed'}`);
  }
  const now = new Date().toISOString();
  const candidate = {
    schemaVersion: PRODUCTION_CANDIDATE_VERSION,
    promotedAt: now,
    engineId: result.engineId,
    sourceAssetId: asset.id,
    status: 'production_candidate',
    geometry: result,
    validation: result.validation,
    constructionReady: false,
    legalBimReady: false,
    rollbackAvailable: true,
  } as const;
  const entry: GeometryMutationHistoryEntry = {
    id: nextId('promotion'), createdAt: now, action: 'production_candidate_promoted', engineId: result.engineId, result,
    previousProductionCandidate: getProductionCandidate(asset),
  };
  const updated: DigitalTwinAsset = {
    ...asset,
    metadata: {
      ...asset.metadata,
      latestGeometryMutation: result,
      productionGeometryCandidate: candidate,
      geometryMutationHistory: [...historyOf(asset), entry],
      productionCandidateUpdatedAt: now,
    },
    updatedAt: now,
  };
  await propertyDataRoomRepository.saveDigitalTwinAsset(updated);
  return { asset: updated, candidate };
}

export async function rollbackProductionCandidate(asset: DigitalTwinAsset) {
  const history = historyOf(asset);
  const lastPromotionIndex = [...history].map((item) => item.action).lastIndexOf('production_candidate_promoted');
  if (lastPromotionIndex < 0) throw new Error('Rollback 가능한 production candidate 이력이 없습니다.');
  const promotion = history[lastPromotionIndex];
  const now = new Date().toISOString();
  const rollbackEntry: GeometryMutationHistoryEntry = {
    id: nextId('rollback'), createdAt: now, action: 'rollback', engineId: promotion.engineId, result: promotion.result,
    previousProductionCandidate: getProductionCandidate(asset),
  };
  const metadata = { ...asset.metadata };
  if (promotion.previousProductionCandidate && typeof promotion.previousProductionCandidate === 'object') metadata.productionGeometryCandidate = promotion.previousProductionCandidate;
  else delete metadata.productionGeometryCandidate;
  metadata.geometryMutationHistory = [...history, rollbackEntry];
  metadata.productionCandidateRolledBackAt = now;
  const updated: DigitalTwinAsset = { ...asset, metadata, updatedAt: now };
  await propertyDataRoomRepository.saveDigitalTwinAsset(updated);
  return updated;
}

export const geometryMutationTransactionService = {
  getHistory: historyOf,
  getProductionCandidate,
  runAndSave: runAndSaveMutation,
  promote: promoteProductionCandidate,
  rollback: rollbackProductionCandidate,
};
