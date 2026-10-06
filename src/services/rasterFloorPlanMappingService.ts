import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import type { SpatialSpaceType } from '../domain/propertyDataRoom/spatialMediaModel';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { spatialMediaRepository } from '../repositories/spatialMediaRepository';

export interface RasterSpaceMapping {
  id: string;
  spaceId: string;
  name: string;
  spaceType: SpatialSpaceType;
  floorId?: string;
  rect: { x: number; y: number; width: number; height: number };
  createdAt: string;
}

function mappingsFromAsset(asset: DigitalTwinAsset): RasterSpaceMapping[] {
  const raw = asset.metadata.rasterSpaceMappings;
  return Array.isArray(raw)
    ? raw.filter((item): item is RasterSpaceMapping => Boolean(
        item && typeof item === 'object' &&
        typeof (item as RasterSpaceMapping).id === 'string' &&
        typeof (item as RasterSpaceMapping).spaceId === 'string',
      ))
    : [];
}

export const rasterFloorPlanMappingService = {
  getMappings: mappingsFromAsset,

  async addMapping(
    asset: DigitalTwinAsset,
    input: {
      name: string;
      spaceType: SpatialSpaceType;
      rect: { x: number; y: number; width: number; height: number };
    },
  ) {
    const name = input.name.trim();
    if (!name) throw new Error('공간명이 필요합니다.');
    const { x, y, width, height } = input.rect;
    if (![x, y, width, height].every(Number.isFinite)) throw new Error('공간 좌표가 올바르지 않습니다.');
    if (width <= 0.01 || height <= 0.01) throw new Error('공간 영역을 조금 더 크게 지정하세요.');
    if (x < 0 || y < 0 || x + width > 1.001 || y + height > 1.001) throw new Error('공간 영역이 도면 범위를 벗어났습니다.');

    const now = new Date().toISOString();
    const spaceId = crypto.randomUUID();
    const mapping: RasterSpaceMapping = {
      id: crypto.randomUUID(),
      spaceId,
      name,
      spaceType: input.spaceType,
      floorId: asset.floor,
      rect: {
        x: Number(x.toFixed(6)),
        y: Number(y.toFixed(6)),
        width: Number(width.toFixed(6)),
        height: Number(height.toFixed(6)),
      },
      createdAt: now,
    };

    const mappings = [...mappingsFromAsset(asset), mapping];
    await propertyDataRoomRepository.saveDigitalTwinAsset({
      ...asset,
      metadata: {
        ...asset.metadata,
        rasterSpaceMappings: mappings,
        rasterMappingStatus: 'in_progress',
        rasterMappingUpdatedAt: now,
      },
      updatedAt: now,
    });

    await spatialMediaRepository.saveSpace({
      id: spaceId,
      propertyId: asset.propertyId,
      floorId: asset.floor,
      spaceName: name,
      spaceType: input.spaceType,
      geometry2d: {
        type: 'normalized_rect',
        coordinateSpace: 'floor_plan_image',
        sourceAssetId: asset.id,
        x: mapping.rect.x,
        y: mapping.rect.y,
        width: mapping.rect.width,
        height: mapping.rect.height,
      },
      estimatedGeometry3d: {},
      sourceType: 'manual',
      verificationStatus: 'estimated',
      createdAt: now,
      updatedAt: now,
    });

    return mapping;
  },

  async completeMapping(asset: DigitalTwinAsset) {
    const mappings = mappingsFromAsset(asset);
    if (!mappings.length) throw new Error('최소 1개 공간을 매핑한 뒤 완료할 수 있습니다.');
    const now = new Date().toISOString();

    await propertyDataRoomRepository.saveDigitalTwinAsset({
      ...asset,
      metadata: {
        ...asset.metadata,
        rasterMappingStatus: 'mapped',
        rasterMappingCompletedAt: now,
      },
      updatedAt: now,
    });

    const floorPlans = await spatialMediaRepository.getFloorPlans(asset.propertyId);
    const floorPlan = floorPlans.find((item) => item.id === asset.id);
    if (floorPlan) {
      await spatialMediaRepository.saveFloorPlan({
        ...floorPlan,
        extractionStatus: 'mapped',
        updatedAt: now,
      });
    }
  },
};
