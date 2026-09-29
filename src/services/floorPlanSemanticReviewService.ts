import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import type { DxfSemanticKind } from './floorPlanGeometryService';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';

export type ReviewedSemanticKind = Exclude<DxfSemanticKind, 'room_label'>;

export interface SemanticLayerReview {
  layer: string;
  semantic: ReviewedSemanticKind;
  decision: 'approved' | 'held' | 'rejected';
  reviewedAt: string;
  reviewedBy?: string;
  note?: string;
}

const ALLOWED: ReviewedSemanticKind[] = ['wall', 'door', 'window', 'column', 'stair', 'elevator', 'unknown'];

function readReviews(asset: DigitalTwinAsset): SemanticLayerReview[] {
  const raw = asset.metadata.semanticLayerReviews;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is SemanticLayerReview => Boolean(item && typeof item === 'object' && typeof item.layer === 'string' && ALLOWED.includes(item.semantic)));
}

export const floorPlanSemanticReviewService = {
  allowedSemantics: ALLOWED,
  getReviews: readReviews,

  async review(asset: DigitalTwinAsset, input: { layer: string; semantic: ReviewedSemanticKind; decision: SemanticLayerReview['decision']; note?: string; reviewedBy?: string }) {
    if (!input.layer.trim()) throw new Error('검토할 DXF layer가 필요합니다.');
    if (!ALLOWED.includes(input.semantic)) throw new Error('지원하지 않는 DXF 의미 분류입니다.');
    const now = new Date().toISOString();
    const reviews = readReviews(asset).filter((item) => item.layer !== input.layer);
    const review: SemanticLayerReview = { layer: input.layer, semantic: input.semantic, decision: input.decision, reviewedAt: now, reviewedBy: input.reviewedBy, note: input.note?.trim() || undefined };
    reviews.push(review);
    const updated = {
      ...asset,
      metadata: { ...asset.metadata, semanticLayerReviews: reviews, semanticReviewUpdatedAt: now },
      updatedAt: now,
    };
    await propertyDataRoomRepository.saveDigitalTwinAsset(updated);
    return { asset: updated, review };
  },
};
