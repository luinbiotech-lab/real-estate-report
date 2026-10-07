import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { spatialMediaRepository } from '../repositories/spatialMediaRepository';

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

    if (asset.metadata.raster && typeof asset.metadata.raster === 'object') {
      const floorPlans = await spatialMediaRepository.getFloorPlans(asset.propertyId);
      const floorPlan = floorPlans.find((item) => item.id === asset.id);
      if (floorPlan) {
        await spatialMediaRepository.saveFloorPlan({
          ...floorPlan,
          scaleStatus: 'verified',
          scaleValue: calibration.metersPerDrawingUnit,
          scaleUnit: 'm_per_px',
          updatedAt: now,
        });
      }

      const raster = asset.metadata.raster as Record<string, unknown>;
      const widthPx = Number(raster.widthPx);
      const heightPx = Number(raster.heightPx);
      if (Number.isFinite(widthPx) && widthPx > 0 && Number.isFinite(heightPx) && heightPx > 0) {
        const spaces = await spatialMediaRepository.getSpaces(asset.propertyId);
        for (const space of spaces) {
          const geometry = space.geometry2d;
          if (!geometry || geometry.type !== 'normalized_rect' || geometry.sourceAssetId !== asset.id) continue;
          const normalizedWidth = Number(geometry.width);
          const normalizedHeight = Number(geometry.height);
          if (!(normalizedWidth > 0) || !(normalizedHeight > 0)) continue;
          const estimatedWidthM = normalizedWidth * widthPx * calibration.metersPerDrawingUnit;
          const estimatedDepthM = normalizedHeight * heightPx * calibration.metersPerDrawingUnit;
          await spatialMediaRepository.saveSpace({
            ...space,
            estimatedGeometry3d: {
              ...space.estimatedGeometry3d,
              type: 'scaled_rect_prism_candidate',
              sourceAssetId: asset.id,
              widthM: Number(estimatedWidthM.toFixed(4)),
              depthM: Number(estimatedDepthM.toFixed(4)),
              areaEstimateM2: Number((estimatedWidthM * estimatedDepthM).toFixed(4)),
              heightStatus: 'unknown',
              scaleVerified: true,
              scaleReference: calibration.referenceLabel,
            },
            updatedAt: now,
          });
        }
      }
    }

    return saved;
  },
};
