import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';

export interface OpeningDimensionReview {
  candidateId: string;
  widthM: number;
  heightM: number;
  sillHeightM?: number;
  sourceLabel: string;
  note?: string;
  verifiedAt: string;
  verifiedBy?: string;
  status: 'verified';
}

function positive(value: number) { return Number.isFinite(value) && value > 0; }
function nonNegativeOptional(value: number | undefined) { return value == null || (Number.isFinite(value) && value >= 0); }

export function readOpeningDimensions(asset: DigitalTwinAsset): OpeningDimensionReview[] {
  const raw = asset.metadata.openingDimensions;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is OpeningDimensionReview => {
    if (!item || typeof item !== 'object') return false;
    const value = item as Partial<OpeningDimensionReview>;
    return typeof value.candidateId === 'string' && value.status === 'verified' && positive(Number(value.widthM)) && positive(Number(value.heightM)) && nonNegativeOptional(value.sillHeightM == null ? undefined : Number(value.sillHeightM));
  });
}

export const openingDimensionService = {
  getReviews: readOpeningDimensions,
  async save(asset: DigitalTwinAsset, input: { candidateId: string; widthM: number; heightM: number; sillHeightM?: number; sourceLabel?: string; note?: string; verifiedBy?: string }) {
    if (!input.candidateId.trim()) throw new Error('개구부 후보 ID가 필요합니다.');
    if (!positive(input.widthM) || !positive(input.heightM)) throw new Error('개구부 폭과 높이는 0보다 큰 숫자여야 합니다.');
    if (!nonNegativeOptional(input.sillHeightM)) throw new Error('창 하단 높이는 0 이상의 숫자여야 합니다.');
    const now = new Date().toISOString();
    const review: OpeningDimensionReview = {
      candidateId: input.candidateId,
      widthM: input.widthM,
      heightM: input.heightM,
      sillHeightM: input.sillHeightM,
      sourceLabel: input.sourceLabel?.trim() || '사용자 확인 개구부 치수',
      note: input.note?.trim() || undefined,
      verifiedAt: now,
      verifiedBy: input.verifiedBy?.trim() || undefined,
      status: 'verified',
    };
    const reviews = readOpeningDimensions(asset).filter((item) => item.candidateId !== input.candidateId);
    reviews.push(review);
    const saved = await propertyDataRoomRepository.saveDigitalTwinAsset({ ...asset, metadata: { ...asset.metadata, openingDimensions: reviews, openingDimensionsUpdatedAt: now }, updatedAt: now });
    await propertyDataRoomRepository.saveDataSource({
      id: crypto.randomUUID(), propertyId: asset.propertyId, resourceType: 'digital_twin_opening_dimension', sourceType: 'manual', sourceName: review.sourceLabel,
      sourceReference: asset.id, collectedAt: now, verificationStatus: 'verified', metadata: { candidateId: review.candidateId, widthM: review.widthM, heightM: review.heightM, sillHeightM: review.sillHeightM, note: review.note }, createdAt: now,
    });
    return saved;
  },
};
