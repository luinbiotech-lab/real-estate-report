import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import type { GeometryMutationHistoryEntry } from './geometryMutationTransactionService';
import { geometryMutationTransactionService } from './geometryMutationTransactionService';

export interface GeometryPromotionAuditRow {
  promotionId: string;
  createdAt: string;
  sourceFingerprint?: string;
  rolledBack: boolean;
  stats: GeometryMutationHistoryEntry['result']['validation']['stats'];
}

export interface GeometryPromotionDiff {
  fromPromotionId?: string;
  toPromotionId?: string;
  sourceChanged: boolean;
  delta: Record<keyof GeometryMutationHistoryEntry['result']['validation']['stats'], number>;
}

export function buildGeometryPromotionAudit(asset: DigitalTwinAsset) {
  const history = geometryMutationTransactionService.getHistory(asset);
  const rolledBack = new Set(history.filter((item) => item.action === 'rollback' && item.targetPromotionId).map((item) => item.targetPromotionId));
  const promotions: GeometryPromotionAuditRow[] = history.filter((item) => item.action === 'production_candidate_promoted').map((item) => ({
    promotionId: item.id,
    createdAt: item.createdAt,
    sourceFingerprint: item.sourceFingerprint,
    rolledBack: rolledBack.has(item.id),
    stats: item.result.validation.stats,
  }));
  const [previous, latest] = promotions.slice(-2);
  const zero = { wallCount: 0, wallPartitionCount: 0, openingSubtractionCount: 0, junctionUnionCount: 0, slabCount: 0, slabCoreSubtractionCount: 0 };
  const from = previous?.stats ?? zero;
  const to = latest?.stats ?? previous?.stats ?? zero;
  const diff: GeometryPromotionDiff = {
    fromPromotionId: previous?.promotionId,
    toPromotionId: latest?.promotionId ?? previous?.promotionId,
    sourceChanged: Boolean(previous && latest && previous.sourceFingerprint !== latest.sourceFingerprint),
    delta: {
      wallCount: to.wallCount - from.wallCount,
      wallPartitionCount: to.wallPartitionCount - from.wallPartitionCount,
      openingSubtractionCount: to.openingSubtractionCount - from.openingSubtractionCount,
      junctionUnionCount: to.junctionUnionCount - from.junctionUnionCount,
      slabCount: to.slabCount - from.slabCount,
      slabCoreSubtractionCount: to.slabCoreSubtractionCount - from.slabCoreSubtractionCount,
    },
  };
  return { promotions, diff, rollbackCount: history.filter((item) => item.action === 'rollback').length };
}

export const geometryProductionAuditService = { build: buildGeometryPromotionAudit };
