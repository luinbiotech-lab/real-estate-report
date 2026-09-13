import type { AgentJob, AgentResult, DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { agentOrchestratorService } from './agentOrchestratorService';
import { readScaleCalibration } from './measurementCalibrationService';
import { buildRoomBoundaryCandidates, readRoomTopologyReviews } from './roomTopologyService';
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
  if (!geometry) {
    return { assetId: asset.id, status: 'geometry_required', floor: asset.floor, sourceFormat: asset.fileFormat, warnings: ['승인된 geometry가 없어 Digital Twin 모델 후보를 생성할 수 없습니다.'] };
  }
  const labels = Array.isArray(geometry.labelCandidates) ? geometry.labelCandidates : [];
  const calibration = readScaleCalibration(asset);
  const vertical = readVerticalDimensions(asset);
  const roomCandidates = buildRoomBoundaryCandidates(asset);
  const roomReviews = readRoomTopologyReviews(asset);
  const approvedReviews = roomReviews.filter((review) => review.decision === 'approved');
  const approvedIds = new Set(approvedReviews.map((review) => review.candidateId));
  const approvedRooms = roomCandidates.filter((candidate) => approvedIds.has(candidate.id)).map((candidate) => {
    const review = approvedReviews.find((item) => item.candidateId === candidate.id);
    return {
      id: candidate.id,
      name: review?.name || '공간명 미지정',
      floor: candidate.floor,
      layer: candidate.layer,
      areaSqmCandidate: candidate.areaSqmCandidate,
      perimeterMCandidate: candidate.perimeterMCandidate,
      boundaryPointCount: candidate.points.length,
      reviewNote: review?.note,
    };
  });
  const topologyStatus = approvedRooms.length ? 'reviewed_boundary_candidates' : roomCandidates.length ? 'review_required' : 'boundary_candidates_missing';
  const extrusionHeightM = vertical?.ceilingHeightM ?? vertical?.floorHeightM;
  const extrusionStatus = calibration && approvedRooms.length && extrusionHeightM ? 'candidate_ready' : calibration && approvedRooms.length ? 'height_required' : 'blocked';
  const verifiedExtrusionHeightM = extrusionStatus === 'candidate_ready' ? extrusionHeightM as number : undefined;
  const extrusionCandidates = verifiedExtrusionHeightM ? approvedRooms.map((room) => ({
    roomId: room.id,
    name: room.name,
    floor: room.floor,
    heightM: verifiedExtrusionHeightM,
    areaSqmCandidate: room.areaSqmCandidate,
    volumeM3Candidate: room.areaSqmCandidate != null ? room.areaSqmCandidate * verifiedExtrusionHeightM : undefined,
    status: 'reviewed_inputs_candidate',
    note: '검증 축척·승인 공간 경계·확인 높이로 만든 3D extrusion 입력 후보이며 구조체/법정면적 확정값이 아닙니다.',
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
    topologyStatus,
    extrusionStatus,
    extrusionCandidates,
    verticalDimensions: vertical ? { floorHeightM: vertical.floorHeightM, ceilingHeightM: vertical.ceilingHeightM, sourceLabel: vertical.sourceLabel, verifiedAt: vertical.verifiedAt } : undefined,
    measurementStatus: calibration ? 'scale_verified' : geometry.unitStatus === 'drawing_units_unverified' ? 'scale_unverified' : 'unknown',
    scaleCalibration: calibration ? { method: calibration.method, metersPerDrawingUnit: calibration.metersPerDrawingUnit, referenceLabel: calibration.referenceLabel, verifiedAt: calibration.verifiedAt } : undefined,
    meshStatus: 'not_generated',
    warnings: [
      ...(calibration ? ['사용자가 확인한 기준 치수로 도면 좌표를 m 단위로 환산합니다.'] : ['도면 좌표의 실제 길이 단위·축척은 검증 전까지 거리/면적으로 확정하지 않습니다.']),
      ...(approvedRooms.length ? ['승인된 폐합 폴리라인은 공간 경계 후보로 사용하지만 공적 장부 면적을 대체하지 않습니다.'] : ['공간 경계 Human Review가 완료되지 않아 3D extrusion을 진행하지 않습니다.']),
      ...(vertical ? ['사용자가 확인한 층고·천장고를 3D 높이 입력 후보로 사용합니다.'] : ['3D 높이는 천장고·층고 검증 전까지 생성하지 않습니다.']),
      '3D extrusion 후보는 구조체·슬래브·벽 두께·개구부·법정면적의 확정 모델이 아닙니다.',
      '벽·문·창·기둥·계단·엘리베이터 의미는 Human Review 결과를 기준으로 사용해야 합니다.',
    ],
  };
}

export const digitalTwinExecutionService = {
  async execute(sourceJob: AgentJob) {
    let job = sourceJob;
    try {
      if (job.status !== 'running') job = await agentOrchestratorService.start(job);
      const assets = await propertyDataRoomRepository.getDigitalTwinAssets(job.propertyId);
      const targetIds = [job.input.sourceDigitalTwinAssetId, job.resourceId].filter((value): value is string => typeof value === 'string' && Boolean(value));
      const target = targetIds.length ? assets.filter((asset) => targetIds.includes(asset.id)) : assets.filter((asset) => asset.processingStatus !== 'ready');
      const models = target.map(modelFromAsset);
      const modelable = models.filter((model) => model.status === 'model_candidate').length;
      const scaleVerified = models.filter((model) => 'measurementStatus' in model && model.measurementStatus === 'scale_verified').length;
      const topologyReviewed = models.filter((model) => 'topologyStatus' in model && model.topologyStatus === 'reviewed_boundary_candidates').length;
      const extrusionReady = models.filter((model) => 'extrusionStatus' in model && model.extrusionStatus === 'candidate_ready').length;
      return agentOrchestratorService.complete(job, {
        resultType: 'digital_twin_model_candidate',
        payload: { models, adapterVersion: 'digital-twin-local-v4', mode: 'geometry_scale_topology_vertical', scaleVerified, topologyReviewed, extrusionReady, safetyNote: '축척·room topology·높이는 Human Review 후에만 사용하며 실제 mesh 생성 전에도 구조·개구부 검토가 필요합니다.' },
        confidence: models.length ? Math.min(0.97, (modelable / models.length) * 0.55 + (scaleVerified / models.length) * 0.15 + (topologyReviewed / models.length) * 0.15 + (extrusionReady / models.length) * 0.1) : 0,
        requiresReview: models.length > 0,
      });
    } catch (error) { await agentOrchestratorService.fail(job, error); throw error; }
  },

  async applyApproved(result: AgentResult) {
    if (result.resultType !== 'digital_twin_model_candidate') return;
    const models = Array.isArray(result.payload.models) ? result.payload.models as Array<Record<string, unknown>> : [];
    const assets = await propertyDataRoomRepository.getDigitalTwinAssets(result.propertyId);
    for (const model of models) {
      const assetId = typeof model.assetId === 'string' ? model.assetId : '';
      const asset = assets.find((item) => item.id === assetId);
      if (!asset) continue;
      const accepted = model.status === 'model_candidate';
      await propertyDataRoomRepository.saveDigitalTwinAsset({ ...asset, processingStatus: accepted ? 'ready' : asset.processingStatus, metadata: { ...asset.metadata, digitalTwinModel: model, digitalTwinAgentResultId: result.id }, updatedAt: new Date().toISOString() });
    }
  },
};
