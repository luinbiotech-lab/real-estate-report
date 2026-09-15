import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';

export interface ScaleCalibration {
  status: 'verified';
  method: 'known_distance';
  drawingLength: number;
  realLengthM: number;
  metersPerDrawingUnit: number;
  referenceLabel: string;
  note: string;
  verifiedAt: string;
  verifiedBy?: string;
}

export interface ScaleCalibrationInput {
  drawingLength: number;
  realLengthM: number;
  referenceLabel?: string;
  note?: string;
  verifiedBy?: string;
}

function positiveFinite(value: number) {
  return Number.isFinite(value) && value > 0;
}

export function readScaleCalibration(asset: DigitalTwinAsset): ScaleCalibration | undefined {
  const raw = asset.metadata.scaleCalibration;
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Partial<ScaleCalibration>;
  if (value.status !== 'verified' || value.method !== 'known_distance') return undefined;
  if (!positiveFinite(Number(value.drawingLength)) || !positiveFinite(Number(value.realLengthM)) || !positiveFinite(Number(value.metersPerDrawingUnit))) return undefined;
  return {
    status: 'verified', method: 'known_distance', drawingLength: Number(value.drawingLength), realLengthM: Number(value.realLengthM),
    metersPerDrawingUnit: Number(value.metersPerDrawingUnit), referenceLabel: String(value.referenceLabel || '기준 치수'), note: String(value.note || ''),
    verifiedAt: String(value.verifiedAt || ''), verifiedBy: value.verifiedBy ? String(value.verifiedBy) : undefined,
  };
}

export const measurementCalibrationService = {
  async save(asset: DigitalTwinAsset, input: ScaleCalibrationInput) {
    if (!positiveFinite(input.drawingLength)) throw new Error('도면상 기준 길이는 0보다 큰 숫자여야 합니다.');
    if (!positiveFinite(input.realLengthM)) throw new Error('실제 기준 길이(m)는 0보다 큰 숫자여야 합니다.');
    const now = new Date().toISOString();
    const calibration: ScaleCalibration = {
      status: 'verified', method: 'known_distance', drawingLength: input.drawingLength, realLengthM: input.realLengthM,
      metersPerDrawingUnit: input.realLengthM / input.drawingLength,
      referenceLabel: input.referenceLabel?.trim() || '사용자 확인 기준 치수', note: input.note?.trim() || '', verifiedAt: now,
      verifiedBy: input.verifiedBy?.trim() || undefined,
    };
    const saved = await propertyDataRoomRepository.saveDigitalTwinAsset({
      ...asset,
      metadata: { ...asset.metadata, scaleCalibration: calibration, measurementStatus: 'scale_verified' },
      updatedAt: now,
    });
    await propertyDataRoomRepository.saveDataSource({
      id: crypto.randomUUID(), propertyId: asset.propertyId, resourceType: 'digital_twin_scale', sourceType: 'manual',
      sourceName: calibration.referenceLabel, sourceReference: asset.id, collectedAt: now, verificationStatus: 'verified',
      metadata: { digitalTwinAssetId: asset.id, method: calibration.method, drawingLength: calibration.drawingLength, realLengthM: calibration.realLengthM, metersPerDrawingUnit: calibration.metersPerDrawingUnit, note: calibration.note },
      createdAt: now,
    });
    return saved;
  },
};
