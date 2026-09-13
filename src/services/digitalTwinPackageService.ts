import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { extrusionGeometryService } from './extrusionGeometryService';
import { readFloorPlacement } from './floorPlacementService';
import { readScaleCalibration } from './measurementCalibrationService';
import { openingBooleanEligibilityService } from './openingBooleanEligibilityService';
import { openingCutService } from './openingCutService';
import { readOpeningDimensions } from './openingDimensionService';
import { buildOpeningAdjacencyCandidates, readOpeningAdjacencyReviews } from './openingTopologyService';
import { buildRoomBoundaryCandidates, readRoomTopologyReviews } from './roomTopologyService';
import { slabCoreAlignmentService } from './slabCoreAlignmentService';
import { slabGeometryService } from './slabGeometryService';
import { spatialGraphService } from './spatialGraphService';
import { verticalCoreService } from './verticalCoreService';
import { readVerticalDimensions } from './verticalDimensionService';
import { wallGeometryMergeService } from './wallGeometryMergeService';
import { wallJunctionService } from './wallJunctionService';
import { wallModelService } from './wallModelService';

export const DIGITAL_TWIN_PACKAGE_VERSION = 'daon-twin-package-v1';

export function buildDigitalTwinPackage(asset: DigitalTwinAsset) {
  const scale = readScaleCalibration(asset);
  const vertical = readVerticalDimensions(asset);
  const floorPlacement = readFloorPlacement(asset);
  const roomReviews = readRoomTopologyReviews(asset).filter((item) => item.decision === 'approved');
  const roomReviewById = new Map(roomReviews.map((item) => [item.candidateId, item]));
  const rooms = buildRoomBoundaryCandidates(asset).filter((item) => roomReviewById.has(item.id)).map((item) => ({
    id: item.id,
    name: roomReviewById.get(item.id)?.name || '공간명 미지정',
    floor: item.floor,
    layer: item.layer,
    boundaryDrawingUnits: item.points,
    areaSqmCandidate: item.areaSqmCandidate,
    perimeterMCandidate: item.perimeterMCandidate,
    reviewedAt: roomReviewById.get(item.id)?.reviewedAt,
  }));

  const openingReviews = readOpeningAdjacencyReviews(asset).filter((item) => item.decision === 'approved');
  const openingReviewIds = new Set(openingReviews.map((item) => item.candidateId));
  const dimensionById = new Map(readOpeningDimensions(asset).map((item) => [item.candidateId, item]));
  const openings = buildOpeningAdjacencyCandidates(asset).filter((item) => openingReviewIds.has(item.id)).map((item) => ({
    id: item.id,
    semantic: item.semantic,
    layer: item.layer,
    centroidDrawingUnits: item.centroid,
    nearbyRoomIds: item.nearbyRoomIds,
    dimensions: dimensionById.get(item.id) ? {
      widthM: dimensionById.get(item.id)!.widthM,
      heightM: dimensionById.get(item.id)!.heightM,
      sillHeightM: dimensionById.get(item.id)!.sillHeightM,
      sourceLabel: dimensionById.get(item.id)!.sourceLabel,
      verifiedAt: dimensionById.get(item.id)!.verifiedAt,
    } : undefined,
  }));

  const walls = wallModelService.build(asset);
  const wallJunctions = wallJunctionService.build(asset);
  const wallMergeEligibility = wallGeometryMergeService.build(asset);
  const openingCuts = openingCutService.build(asset);
  const openingBooleanEligibility = openingBooleanEligibilityService.build(asset);
  const slabGeometry = slabGeometryService.build(asset);
  const slabCoreAlignment = slabCoreAlignmentService.build(asset);
  const verticalCoreNodes = verticalCoreService.buildNodes(asset);
  const graph = spatialGraphService.build(asset);
  const extrusion = extrusionGeometryService.build(asset);
  const readiness = {
    geometry: Boolean(asset.metadata.geometry && typeof asset.metadata.geometry === 'object'),
    scaleVerified: Boolean(scale),
    verticalVerified: Boolean(vertical),
    floorPlacementVerified: Boolean(floorPlacement),
    roomTopologyReviewed: rooms.length > 0,
    wallThicknessReviewed: walls.length > 0,
    wallJunctionsPrepared: walls.length === 0 || wallJunctions.length > 0,
    wallGeometryMergeEligible: wallMergeEligibility.length === 0 || wallMergeEligibility.every((item) => item.eligible),
    slabGeometryPrepared: slabGeometry.status === 'ready',
    slabCoreAligned: slabCoreAlignment.length === 0 || slabCoreAlignment.every((item) => item.alignmentStatus === 'aligned'),
    openingTopologyReviewed: openings.length > 0,
    allReviewedOpeningsDimensioned: openings.length === 0 || openings.every((item) => Boolean(item.dimensions)),
    openingCutsPrepared: openings.length === 0 || openingCuts.length === openings.filter((item) => Boolean(item.dimensions)).length,
    openingBooleanEligible: openingBooleanEligibility.length === 0 || openingBooleanEligibility.every((item) => item.eligible),
    verticalCoreReviewed: verticalCoreNodes.length > 0,
    graphStatus: graph.status,
    extrusionStatus: extrusion.status,
    productionMeshReady: false,
  };

  return {
    schemaVersion: DIGITAL_TWIN_PACKAGE_VERSION,
    generatedAt: new Date().toISOString(),
    propertyId: asset.propertyId,
    sourceAsset: { id: asset.id, fileName: asset.fileName, fileFormat: asset.fileFormat, assetType: asset.assetType, floor: asset.floor, version: asset.version },
    measurement: { scale, vertical, floorPlacement },
    rooms,
    walls,
    wallJunctions,
    wallMergeEligibility,
    slabGeometry,
    slabCoreAlignment,
    openings,
    openingCuts,
    openingBooleanEligibility,
    verticalCoreNodes,
    graph,
    extrusion,
    readiness,
    safety: {
      status: 'reviewed_candidate_package',
      statements: [
        '이 패키지는 Human Review를 통과한 후보 데이터만 묶어 후속 3D/원격검토 모듈에 전달하기 위한 자료입니다.',
        'wallMergeEligibility는 endpoint drift와 벽 두께 편차를 이용한 geometry merge 준비 판정이며 실제 union/miter는 적용하지 않습니다.',
        'openingBooleanEligibility는 검증 벽체·개구부 치수·junction 상태를 이용한 절삭 가능성 gate이며 실제 boolean은 적용하지 않습니다.',
        'slabCoreAlignment는 검증된 stair/elevator layer footprint와 reviewed slab footprint의 정합 후보이며 실제 slab opening boolean은 적용하지 않습니다.',
        '공적 장부 면적, 구조 안전성, 피난 적합성, 인허가 적합성, 실시설계 치수를 확정하지 않습니다.',
        'productionMeshReady는 실제 wall merge·opening boolean·slab/core opening·구조체 정합성 검증 전까지 false입니다.',
      ],
    },
  };
}

export const digitalTwinPackageService = { build: buildDigitalTwinPackage };
