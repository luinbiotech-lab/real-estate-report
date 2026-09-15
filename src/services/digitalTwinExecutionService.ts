import type { AgentJob, AgentResult, DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { digitalTwinAgentPort } from '../agents/agentDataPorts';
import { agentOrchestratorService } from './agentOrchestratorService';
import { readScaleCalibration } from './measurementCalibrationService';
import { readOpeningDimensions } from './openingDimensionService';
import { buildOpeningAdjacencyCandidates, readOpeningAdjacencyReviews } from './openingTopologyService';
import { buildRoomBoundaryCandidates, readRoomTopologyReviews } from './roomTopologyService';
import { spatialGraphService } from './spatialGraphService';
import { readVerticalDimensions } from './verticalDimensionService';

type GeometrySummary = {
  parser?: string;
  lineCount?: number;
  polylineCount?: number;
  textCount?: number;
  layers?: string[];
  bounds?: { minX?: number; minY?: number; maxX?: number; maxY?: number; width?: number; height?: number };
  labelCandidates?: string[];
  unitStatus?: string;
};

function calibratedBounds(geometry: GeometrySummary, metersPerDrawingUnit: number) {
  const bounds = geometry.bounds;
  if (!bounds) return undefined;
  const width = typeof bounds.width === 'number' ? bounds.width * metersPerDrawingUnit : undefined;
  const height = typeof bounds.height === 'number' ? bounds.height * metersPerDrawingUnit : undefined;
  if (width == null || height == null) return undefined;
  return { widthM: width, heightM: height, note: '도면 전체 bounds 환산값이며 건축면적·전용면적이 아닙니다.' };
}

function modelFromAsset(asset: DigitalTwinAsset) {
  const geometry = asset.metadata.geometry && typeof asset.metadata.geometry === 'object' ? asset.metadata.geometry as GeometrySummary : undefined;
  if (!geometry) return { assetId: asset.id, status: 'geometry_required', floor: asset.floor, sourceFormat: asset.fileFormat, warnings: ['승인된 geometry가 없어 Digital Twin 모델 후보를 생성할 수 없습니다.'] };

  const labels = Array.isArray(geometry.labelCandidates) ? geometry.labelCandidates : [];
  const calibration = readScaleCalibration(asset);
  const vertical = readVerticalDimensions(asset);
  const roomCandidates = buildRoomBoundaryCandidates(asset);
  const roomReviews = readRoomTopologyReviews(asset);
  const approvedReviews = roomReviews.filter((review) => review.decision === 'approved');
  const approvedIds = new Set(approvedReviews.map((review) => review.candidateId));
  const approvedRooms = roomCandidates.filter((candidate) => approvedIds.has(candidate.id)).map((candidate) => {
    const review = approvedReviews.find((item) => item.candidateId === candidate.id);
    return { id: candidate.id, name: review?.name || '공간명 미지정', floor: candidate.floor, layer: candidate.layer, areaSqmCandidate: candidate.areaSqmCandidate, perimeterMCandidate: candidate.perimeterMCandidate, boundaryPointCount: candidate.points.length, reviewNote: review?.note };
  });

  const openingCandidates = buildOpeningAdjacencyCandidates(asset);
  const openingReviews = readOpeningAdjacencyReviews(asset).filter((review) => review.decision === 'approved');
  const approvedOpeningIds = new Set(openingReviews.map((review) => review.candidateId));
  const dimensions = readOpeningDimensions(asset);
  const dimensionById = new Map(dimensions.map((item) => [item.candidateId, item]));
  const approvedOpenings = openingCandidates.filter((candidate) => approvedOpeningIds.has(candidate.id)).map((candidate) => {
    const dimension = dimensionById.get(candidate.id);
    return {
      id: candidate.id,
      semantic: candidate.semantic,
      layer: candidate.layer,
      nearbyRoomIds: candidate.nearbyRoomIds,
      connectionStatus: candidate.nearbyRoomIds.length >= 1 ? 'reviewed_adjacency_candidate' : 'unresolved',
      dimensionStatus: dimension ? 'verified' : 'missing',
      dimensions: dimension ? { widthM: dimension.widthM, heightM: dimension.heightM, sillHeightM: dimension.sillHeightM, sourceLabel: dimension.sourceLabel, verifiedAt: dimension.verifiedAt } : undefined,
    };
  });
  const spatialGraph = spatialGraphService.build(asset);

  const topologyStatus = approvedRooms.length ? 'reviewed_boundary_candidates' : roomCandidates.length ? 'review_required' : 'boundary_candidates_missing';
  const openingTopologyStatus = approvedOpenings.length ? 'reviewed_opening_candidates' : openingCandidates.length ? 'review_required' : 'opening_candidates_missing';
  const dimensionedOpenings = approvedOpenings.filter((opening) => opening.dimensionStatus === 'verified').length;
  const openingDimensionStatus = !approvedOpenings.length ? 'not_applicable' : dimensionedOpenings === approvedOpenings.length ? 'verified' : dimensionedOpenings ? 'partial' : 'review_required';
  const openingCutStatus = openingDimensionStatus === 'verified' ? 'dimensions_ready' : 'blocked';
  const extrusionHeightM = vertical?.ceilingHeightM ?? vertical?.floorHeightM;
  const extrusionStatus = calibration && approvedRooms.length && extrusionHeightM ? 'candidate_ready' : calibration && approvedRooms.length ? 'height_required' : 'blocked';
  const verifiedExtrusionHeightM = extrusionStatus === 'candidate_ready' ? extrusionHeightM as number : undefined;
  const extrusionCandidates = verifiedExtrusionHeightM ? approvedRooms.map((room) => ({
    roomId: room.id, name: room.name, floor: room.floor, heightM: verifiedExtrusionHeightM, areaSqmCandidate: room.areaSqmCandidate,
    volumeM3Candidate: room.areaSqmCandidate != null ? room.areaSqmCandidate * verifiedExtrusionHeightM : undefined,
    status: 'reviewed_inputs_candidate', note: '검증 축척·승인 공간 경계·확인 높이로 만든 3D extrusion 입력 후보이며 구조체/법정면적 확정값이 아닙니다.',
  })) : [];

  return {
    assetId: asset.id,
    status: 'model_candidate',
    floor: asset.floor,
    sourceFormat: asset.fileFormat,
    coordinateBounds: geometry.bounds,
    calibratedBounds: calibration ? calibratedBounds(geometry, calibration.metersPerDrawingUnit) : undefined,
    drawingLayers: Array.isArray(geometry.layers) ? geometry.layers : [],
    geometryStats: { lines: geometry.lineCount ?? 0, polylines: geometry.polylineCount ?? 0, texts: geometry.textCount ?? 0 },
    roomLabelCandidates: labels,
    roomTopology: { status: topologyStatus, candidateCount: roomCandidates.length, approvedCount: approvedRooms.length, approvedRooms },
    openingTopology: { status: openingTopologyStatus, candidateCount: openingCandidates.length, approvedCount: approvedOpenings.length, dimensionedCount: dimensionedOpenings, approvedOpenings },
    spatialConnectivityGraph: spatialGraph,
    topologyStatus,
    openingTopologyStatus,
    openingDimensionStatus,
    openingCutStatus,
    graphStatus: spatialGraph.status,
    extrusionStatus,
    extrusionCandidates,
    verticalDimensions: vertical ? { floorHeightM: vertical.floorHeightM, ceilingHeightM: vertical.ceilingHeightM, sourceLabel: vertical.sourceLabel, verifiedAt: vertical.verifiedAt } : undefined,
    measurementStatus: calibration ? 'scale_verified' : geometry.unitStatus === 'drawing_units_unverified' ? 'scale_unverified' : 'unknown',
    scaleCalibration: calibration ? { method: calibration.method, metersPerDrawingUnit: calibration.metersPerDrawingUnit, referenceLabel: calibration.referenceLabel, verifiedAt: calibration.verifiedAt } : undefined,
    meshStatus: 'not_generated',
    warnings: [
      ...(calibration ? ['사용자가 확인한 기준 치수로 도면 좌표를 m 단위로 환산합니다.'] : ['도면 좌표의 실제 길이 단위·축척은 검증 전까지 거리/면적으로 확정하지 않습니다.']),
      ...(approvedRooms.length ? ['승인된 폐합 폴리라인은 공간 경계 후보로 사용하지만 공적 장부 면적을 대체하지 않습니다.'] : ['공간 경계 Human Review가 완료되지 않아 3D extrusion을 진행하지 않습니다.']),
      ...(approvedOpenings.length ? ['승인된 문·창 인접관계는 연결 그래프 후보로만 사용하며 실제 개구부 폭·높이는 별도 검증값만 사용합니다.'] : ['문·창 개구부 연결은 Human Review 전까지 모델에 확정 반영하지 않습니다.']),
      ...(openingDimensionStatus === 'verified' ? ['승인된 개구부의 확인 치수가 연결됐지만 실제 mesh 절삭은 아직 생성하지 않습니다.'] : ['개구부 폭·높이는 확인 치수가 모두 준비되기 전까지 3D cut 후보로 사용하지 않습니다.']),
      ...(vertical ? ['사용자가 확인한 층고·천장고를 3D 높이 입력 후보로 사용합니다.'] : ['3D 높이는 천장고·층고 검증 전까지 생성하지 않습니다.']),
      '공간 연결 그래프는 통행·피난·접근성 적합성의 확정 판정이 아닙니다.',
      '3D extrusion 후보는 구조체·슬래브·벽 두께·개구부·법정면적의 확정 모델이 아닙니다.',
    ],
  };
}

export const digitalTwinExecutionService = {
  async execute(sourceJob: AgentJob) {
    let job = sourceJob;
    try {
      if (job.status !== 'running') job = await agentOrchestratorService.start(job);
      const assets = await digitalTwinAgentPort.getDigitalTwinAssets(job.propertyId);
      const targetIds = [job.input.sourceDigitalTwinAssetId, job.resourceId].filter((value): value is string => typeof value === 'string' && Boolean(value));
      const target = targetIds.length
        ? assets.filter((asset) => targetIds.includes(asset.id))
        : sourceJob.trigger === 'refresh'
          ? assets
          : assets.filter((asset) => asset.processingStatus !== 'ready');
      const models = target.map(modelFromAsset);
      const modelable = models.filter((model) => model.status === 'model_candidate').length;
      const scaleVerified = models.filter((model) => 'measurementStatus' in model && model.measurementStatus === 'scale_verified').length;
      const topologyReviewed = models.filter((model) => 'topologyStatus' in model && model.topologyStatus === 'reviewed_boundary_candidates').length;
      const openingsReviewed = models.filter((model) => 'openingTopologyStatus' in model && model.openingTopologyStatus === 'reviewed_opening_candidates').length;
      const openingDimensionsVerified = models.filter((model) => 'openingDimensionStatus' in model && (model.openingDimensionStatus === 'verified' || model.openingDimensionStatus === 'not_applicable')).length;
      const graphReady = models.filter((model) => 'graphStatus' in model && model.graphStatus === 'ready').length;
      const extrusionReady = models.filter((model) => 'extrusionStatus' in model && model.extrusionStatus === 'candidate_ready').length;
      return agentOrchestratorService.complete(job, {
        resultType: 'digital_twin_model_candidate',
        payload: { models, adapterVersion: 'digital-twin-local-v7', mode: 'geometry_scale_topology_graph_opening_dimensions_vertical', scaleVerified, topologyReviewed, openingsReviewed, openingDimensionsVerified, graphReady, extrusionReady, safetyNote: '축척·room topology·문창 연결·개구부 치수·높이는 Human Review 후에만 사용하며 공간 그래프와 3D 후보는 피난·구조·법정면적 판단을 대체하지 않습니다.' },
        confidence: models.length ? Math.min(0.99, (modelable / models.length) * 0.42 + (scaleVerified / models.length) * 0.14 + (topologyReviewed / models.length) * 0.14 + (openingsReviewed / models.length) * 0.05 + (openingDimensionsVerified / models.length) * 0.05 + (graphReady / models.length) * 0.05 + (extrusionReady / models.length) * 0.1) : 0,
        requiresReview: models.length > 0,
      });
    } catch (error) { await agentOrchestratorService.fail(job, error); throw error; }
  },

  async applyApproved(result: AgentResult) {
    if (result.resultType !== 'digital_twin_model_candidate') return;
    const models = Array.isArray(result.payload.models) ? result.payload.models as Array<Record<string, unknown>> : [];
    const assets = await digitalTwinAgentPort.getDigitalTwinAssets(result.propertyId);
    for (const model of models) {
      const assetId = typeof model.assetId === 'string' ? model.assetId : '';
      const asset = assets.find((item) => item.id === assetId);
      if (!asset) continue;
      const accepted = model.status === 'model_candidate';
      await digitalTwinAgentPort.saveDigitalTwinAsset({ ...asset, processingStatus: accepted ? 'ready' : asset.processingStatus, metadata: { ...asset.metadata, digitalTwinModel: model, digitalTwinAgentResultId: result.id }, updatedAt: new Date().toISOString() });
    }
  },
};
