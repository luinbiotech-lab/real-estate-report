import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';

export interface VerticalDimensionReview {
  status: 'verified';
  floorHeightM?: number;
  ceilingHeightM?: number;
  sourceLabel: string;
  note: string;
  verifiedAt: string;
  verifiedBy?: string;
}

export interface VerticalDimensionInput {
  floorHeightM?: number;
  ceilingHeightM?: number;
  sourceLabel?: string;
  note?: string;
  verifiedBy?: string;
}

function positiveOptional(value: number | undefined) {
  return value == null || (Number.isFinite(value) && value > 0);
}

export function readVerticalDimensions(asset: DigitalTwinAsset): VerticalDimensionReview | undefined {
  const raw = asset.metadata.verticalDimensions;
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Partial<VerticalDimensionReview>;
  const floorHeightM = value.floorHeightM == null ? undefined : Number(value.floorHeightM);
  const ceilingHeightM = value.ceilingHeightM == null ? undefined : Number(value.ceilingHeightM);
  if (value.status !== 'verified' || !positiveOptional(floorHeightM) || !positiveOptional(ceilingHeightM) || (!floorHeightM && !ceilingHeightM)) return undefined;
  return {
    status: 'verified', floorHeightM, ceilingHeightM,
    sourceLabel: String(value.sourceLabel || '사용자 확인 높이'), note: String(value.note || ''),
    verifiedAt: String(value.verifiedAt || ''), verifiedBy: value.verifiedBy ? String(value.verifiedBy) : undefined,
  };
}

export const verticalDimensionService = {
  async save(asset: DigitalTwinAsset, input: VerticalDimensionInput) {
    if (!positiveOptional(input.floorHeightM) || !positiveOptional(input.ceilingHeightM)) throw new Error('층고·천장고는 0보다 큰 숫자여야 합니다.');
    if (!input.floorHeightM && !input.ceilingHeightM) throw new Error('층고 또는 천장고 중 하나는 입력해야 합니다.');
    const now = new Date().toISOString();
    const review: VerticalDimensionReview = {
      status: 'verified', floorHeightM: input.floorHeightM, ceilingHeightM: input.ceilingHeightM,
      sourceLabel: input.sourceLabel?.trim() || '사용자 확인 높이', note: input.note?.trim() || '', verifiedAt: now,
      verifiedBy: input.verifiedBy?.trim() || undefined,
    };
    const saved = await propertyDataRoomRepository.saveDigitalTwinAsset({
      ...asset,
      metadata: { ...asset.metadata, verticalDimensions: review },
      updatedAt: now,
    });
    await propertyDataRoomRepository.saveDataSource({
      id: crypto.randomUUID(), propertyId: asset.propertyId, resourceType: 'digital_twin_vertical_dimension', sourceType: 'manual',
      sourceName: review.sourceLabel, sourceReference: asset.id, collectedAt: now, verificationStatus: 'verified',
      metadata: { digitalTwinAssetId: asset.id, floorHeightM: review.floorHeightM, ceilingHeightM: review.ceilingHeightM, note: review.note }, createdAt: now,
    });
    return saved;
  },
};
