import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';

export interface FloorPlacementReview {
  status: 'verified';
  floorLabel: string;
  elevationM: number;
  slabThicknessM: number;
  sourceLabel: string;
  note?: string;
  verifiedAt: string;
  verifiedBy?: string;
}

function finite(value: unknown) { return typeof value === 'number' && Number.isFinite(value); }

export function readFloorPlacement(asset: DigitalTwinAsset): FloorPlacementReview | undefined {
  const raw = asset.metadata.floorPlacement;
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Partial<FloorPlacementReview>;
  if (value.status !== 'verified' || typeof value.floorLabel !== 'string' || !finite(value.elevationM) || !finite(value.slabThicknessM) || Number(value.slabThicknessM) <= 0) return undefined;
  return {
    status: 'verified',
    floorLabel: value.floorLabel,
    elevationM: Number(value.elevationM),
    slabThicknessM: Number(value.slabThicknessM),
    sourceLabel: String(value.sourceLabel || '사용자 확인 층 배치'),
    note: value.note ? String(value.note) : undefined,
    verifiedAt: String(value.verifiedAt || ''),
    verifiedBy: value.verifiedBy ? String(value.verifiedBy) : undefined,
  };
}

export const floorPlacementService = {
  read: readFloorPlacement,
  async save(asset: DigitalTwinAsset, input: { floorLabel?: string; elevationM: number; slabThicknessM: number; sourceLabel?: string; note?: string; verifiedBy?: string }) {
    if (!Number.isFinite(input.elevationM)) throw new Error('층 기준고는 유효한 숫자여야 합니다.');
    if (!(Number.isFinite(input.slabThicknessM) && input.slabThicknessM > 0 && input.slabThicknessM <= 1.5)) throw new Error('슬래브 두께는 0보다 크고 1.5m 이하여야 합니다.');
    const now = new Date().toISOString();
    const review: FloorPlacementReview = {
      status: 'verified',
      floorLabel: input.floorLabel?.trim() || asset.floor || '층 미지정',
      elevationM: input.elevationM,
      slabThicknessM: input.slabThicknessM,
      sourceLabel: input.sourceLabel?.trim() || '사용자 확인 층 기준고/슬래브',
      note: input.note?.trim() || undefined,
      verifiedAt: now,
      verifiedBy: input.verifiedBy?.trim() || undefined,
    };
    const saved = await propertyDataRoomRepository.saveDigitalTwinAsset({
      ...asset,
      floor: review.floorLabel,
      metadata: { ...asset.metadata, floorPlacement: review, floorPlacementUpdatedAt: now },
      updatedAt: now,
    });
    await propertyDataRoomRepository.saveDataSource({
      id: crypto.randomUUID(), propertyId: asset.propertyId, resourceType: 'digital_twin_floor_placement', sourceType: 'manual',
      sourceName: review.sourceLabel, sourceReference: asset.id, collectedAt: now, verificationStatus: 'verified',
      metadata: { digitalTwinAssetId: asset.id, floorLabel: review.floorLabel, elevationM: review.elevationM, slabThicknessM: review.slabThicknessM, note: review.note }, createdAt: now,
    });
    return saved;
  },
};
