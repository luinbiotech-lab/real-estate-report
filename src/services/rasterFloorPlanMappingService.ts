import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import type { SpatialSpaceType } from '../domain/propertyDataRoom/spatialMediaModel';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { spatialMediaRepository } from '../repositories/spatialMediaRepository';
import { readScaleCalibration } from './measurementCalibrationService';

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

    const calibration = readScaleCalibration(asset);
    const raster = asset.metadata.raster && typeof asset.metadata.raster === 'object'
      ? asset.metadata.raster as Record<string, unknown>
      : undefined;
    const widthPx = Number(raster?.widthPx);
    const heightPx = Number(raster?.heightPx);
    const canScale = Boolean(
      calibration &&
      Number.isFinite(widthPx) && widthPx > 0 &&
      Number.isFinite(heightPx) && heightPx > 0,
    );
    const estimatedWidthM = canScale ? mapping.rect.width * widthPx * calibration!.metersPerDrawingUnit : undefined;
    const estimatedDepthM = canScale ? mapping.rect.height * heightPx * calibration!.metersPerDrawingUnit : undefined;

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
      estimatedGeometry3d: canScale
        ? {
            type: 'scaled_rect_prism_candidate',
            sourceAssetId: asset.id,
            widthM: Number(estimatedWidthM!.toFixed(4)),
            depthM: Number(estimatedDepthM!.toFixed(4)),
            areaEstimateM2: Number((estimatedWidthM! * estimatedDepthM!).toFixed(4)),
            heightStatus: 'unknown',
            scaleVerified: true,
            scaleReference: calibration!.referenceLabel,
          }
        : {
            type: 'unitless_prism',
            coordinateSpace: 'floor_plan_image_normalized',
            sourceAssetId: asset.id,
            extrusionHeight: 0.12,
            unit: 'normalized',
            scaleVerified: false,
          },
      sourceType: 'manual',
      verificationStatus: 'estimated',
      createdAt: now,
      updatedAt: now,
    });

    await spatialMediaRepository.appendVerificationEvent({
      id: crypto.randomUUID(),
      propertyId: asset.propertyId,
      targetType: 'space',
      targetId: spaceId,
      newStatus: 'estimated',
      verificationLevel: 1,
      evidenceSourceId: asset.id,
      verificationMethod: 'manual',
      confidenceScore: 1,
      note: 'Raster floor plan manual box mapping. Scale and dimensions are not verified.',
      createdAt: now,
    });

    return mapping;
  },

  async removeMapping(asset: DigitalTwinAsset, mappingId: string) {
    const mappings = mappingsFromAsset(asset);
    const target = mappings.find((item) => item.id === mappingId);
    if (!target) throw new Error('삭제할 공간 매핑을 찾을 수 없습니다.');
    const now = new Date().toISOString();
    const nextMappings = mappings.filter((item) => item.id !== mappingId);

    await propertyDataRoomRepository.saveDigitalTwinAsset({
      ...asset,
      metadata: {
        ...asset.metadata,
        rasterSpaceMappings: nextMappings,
        rasterMappingStatus: nextMappings.length ? 'in_progress' : 'not_started',
        rasterMappingUpdatedAt: now,
        rasterMappingCompletedAt: undefined,
      },
      updatedAt: now,
    });

    const spaces = await spatialMediaRepository.getSpaces(asset.propertyId);
    const space = spaces.find((item) => item.id === target.spaceId);
    if (space) {
      await spatialMediaRepository.saveSpace({
        ...space,
        deletedAt: now,
        updatedAt: now,
      });
    }

    const viewerNodes = await spatialMediaRepository.getViewerNodes(asset.propertyId);
    for (const node of viewerNodes.filter((item) => item.spaceId === target.spaceId && !item.deletedAt)) {
      await spatialMediaRepository.saveViewerNode({ ...node, deletedAt: now, updatedAt: now });
    }

    const walkthroughSteps = await spatialMediaRepository.getWalkthroughSteps(asset.propertyId);
    for (const step of walkthroughSteps.filter((item) => item.spaceId === target.spaceId && !item.deletedAt)) {
      await spatialMediaRepository.saveWalkthroughStep({ ...step, propertyId: asset.propertyId, deletedAt: now, updatedAt: now });
    }

    const sceneId = 'raster-space-scene:' + asset.id;
    const routeId = 'raster-walkthrough:' + asset.id;
    if (!nextMappings.length) {
      const scenes = await spatialMediaRepository.getViewerScenes(asset.propertyId);
      const scene = scenes.find((item) => item.id === sceneId);
      if (scene) await spatialMediaRepository.saveViewerScene({ ...scene, generationStatus: 'archived', updatedAt: now });
      const routes = await spatialMediaRepository.getWalkthroughRoutes(asset.propertyId);
      const route = routes.find((item) => item.id === routeId);
      if (route) await spatialMediaRepository.saveWalkthroughRoute({ ...route, deletedAt: now, updatedAt: now });
    }

    const floorPlans = await spatialMediaRepository.getFloorPlans(asset.propertyId);
    const floorPlan = floorPlans.find((item) => item.id === asset.id);
    if (floorPlan) {
      await spatialMediaRepository.saveFloorPlan({
        ...floorPlan,
        extractionStatus: nextMappings.length ? 'manual_mapping_required' : 'manual_mapping_required',
        updatedAt: now,
      });
    }
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

    const sceneId = 'raster-space-scene:' + asset.id;
    await spatialMediaRepository.saveViewerScene({
      id: sceneId,
      propertyId: asset.propertyId,
      sceneType: 'space_model',
      title: (asset.floor ? asset.floor + ' · ' : '') + (asset.fileName || 'Raster floor plan') + ' 공간 모델',
      description: 'Raster floor plan manual mapping 기반 unitless schematic 3D. Scale/height/wall thickness are not verified.',
      modelSourceType: 'metadata',
      floorPlanId: asset.id,
      generationStatus: 'ready',
      verificationStatus: 'estimated',
      createdAt: now,
      updatedAt: now,
    });

    for (const mapping of mappings) {
      await spatialMediaRepository.saveViewerNode({
        id: 'raster-space-node:' + mapping.spaceId,
        sceneId,
        propertyId: asset.propertyId,
        floorId: mapping.floorId,
        spaceId: mapping.spaceId,
        nodeType: 'space',
        label: mapping.name,
        positionX: mapping.rect.x + mapping.rect.width / 2,
        positionY: 0.12,
        positionZ: mapping.rect.y + mapping.rect.height / 2,
        verificationStatus: 'estimated',
        createdAt: now,
        updatedAt: now,
      });
    }

    const routeId = 'raster-walkthrough:' + asset.id;
    await spatialMediaRepository.saveWalkthroughRoute({
      id: routeId,
      propertyId: asset.propertyId,
      title: (asset.floor ? asset.floor + ' · ' : '') + 'Raster 공간 검토 경로',
      description: '수동 공간 박스를 순서대로 확인하는 schematic walkthrough. 실제 현장 동선으로 확정하지 않음.',
      routeType: 'floor',
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    });

    for (const [index, mapping] of mappings.entries()) {
      await spatialMediaRepository.saveWalkthroughStep({
        id: 'raster-walkthrough-step:' + mapping.spaceId,
        routeId,
        propertyId: asset.propertyId,
        sequenceOrder: index + 1,
        spaceId: mapping.spaceId,
        viewerNodeId: 'raster-space-node:' + mapping.spaceId,
        title: mapping.name,
        description: 'Raster manual mapping 기반 공간 검토 단계',
        transitionType: index === 0 ? 'cut' : 'pan',
        verificationStatus: 'estimated',
        createdAt: now,
        updatedAt: now,
      });
    }

    await spatialMediaRepository.appendVerificationEvent({
      id: crypto.randomUUID(),
      propertyId: asset.propertyId,
      targetType: 'viewer_scene',
      targetId: sceneId,
      newStatus: 'estimated',
      verificationLevel: 1,
      evidenceSourceId: asset.id,
      verificationMethod: 'manual',
      confidenceScore: 1,
      note: 'Generated from approved raster manual mappings. Unitless schematic viewer only.',
      createdAt: now,
    });
  },
};
