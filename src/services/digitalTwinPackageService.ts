import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { extrusionGeometryService } from './extrusionGeometryService';
import { readScaleCalibration } from './measurementCalibrationService';
import { openingCutService } from './openingCutService';
import { readOpeningDimensions } from './openingDimensionService';
import { buildOpeningAdjacencyCandidates, readOpeningAdjacencyReviews } from './openingTopologyService';
import { buildRoomBoundaryCandidates, readRoomTopologyReviews } from './roomTopologyService';
import { spatialGraphService } from './spatialGraphService';
import { readVerticalDimensions } from './verticalDimensionService';
import { wallModelService } from './wallModelService';

export const DIGITAL_TWIN_PACKAGE_VERSION = 'daon-twin-package-v1';

export function buildDigitalTwinPackage(asset: DigitalTwinAsset) {
  const scale = readScaleCalibration(asset);
  const vertical = readVerticalDimensions(asset);
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
  const openingCuts = openingCutService.build(asset);
  const graph = spatialGraphService.build(asset);
  const extrusion = extrusionGeometryService.build(asset);
  const readiness = {
    geometry: Boolean(asset.metadata.geometry && typeof asset.metadata.geometry === 'object'),
    scaleVerified: Boolean(scale),
    verticalVerified: Boolean(vertical),
    roomTopologyReviewed: rooms.length > 0,
    wallThicknessReviewed: walls.length > 0,
    openingTopologyReviewed: openings.length > 0,
    allReviewedOpeningsDimensioned: openings.length === 0 || openings.every((item) => Boolean(item.dimensions)),
    openingCutsPrepared: openings.length === 0 || openingCuts.length === openings.filter((item) => Boolean(item.dimensions)).length,
    graphStatus: graph.status,
    extrusionStatus: extrusion.status,
    productionMeshReady: false,
  };

  return {
    schemaVersion: DIGITAL_TWIN_PACKAGE_VERSION,
    generatedAt: new Date().toISOString(),
    propertyId: asset.propertyId,
    sourceAsset: { id: asset.id, fileName: asset.fileName, fileFormat: asset.fileFormat, assetType: asset.assetType, floor: asset.floor, version: asset.version },
    measurement: { scale, vertical },
    rooms,
    walls,
    openings,
    openingCuts,
    graph,
    extrusion,
    readiness,
    safety: {
      status: 'reviewed_candidate_package',
      statements: [
        '이 패키지는 Human Review를 통과한 후보 데이터만 묶어 후속 3D/원격검토 모듈에 전달하기 위한 자료입니다.',
        '벽체는 승인된 DXF wall layer 중심선과 사람이 확인한 두께·높이를 결합한 후보이며 구조벽/비구조벽을 자동 확정하지 않습니다.',
        'openingCuts는 승인된 문·창 연결과 확인 치수를 벽체에 대응시킨 절삭 후보이며 실제 mesh boolean은 아직 실행하지 않습니다.',
        '공적 장부 면적, 구조 안전성, 피난 적합성, 인허가 적합성, 실시설계 치수를 확정하지 않습니다.',
        'productionMeshReady는 벽체 접합·개구부 boolean·슬래브·구조체·층간 정합성 검토 전까지 false입니다.',
      ],
    },
  };
}

export const digitalTwinPackageService = { build: buildDigitalTwinPackage };
