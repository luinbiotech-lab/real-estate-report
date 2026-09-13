import type { AgentJob, AgentResult, DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { agentOrchestratorService } from './agentOrchestratorService';

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

function modelFromAsset(asset: DigitalTwinAsset) {
  const geometry = asset.metadata.geometry && typeof asset.metadata.geometry === 'object' ? asset.metadata.geometry as GeometrySummary : undefined;
  if (!geometry) {
    return {
      assetId: asset.id,
      status: 'geometry_required',
      floor: asset.floor,
      sourceFormat: asset.fileFormat,
      warnings: ['승인된 geometry가 없어 Digital Twin 모델 후보를 생성할 수 없습니다.'],
    };
  }
  const labels = Array.isArray(geometry.labelCandidates) ? geometry.labelCandidates : [];
  return {
    assetId: asset.id,
    status: 'model_candidate',
    floor: asset.floor,
    sourceFormat: asset.fileFormat,
    coordinateBounds: geometry.bounds,
    drawingLayers: Array.isArray(geometry.layers) ? geometry.layers : [],
    geometryStats: { lines: geometry.lineCount ?? 0, polylines: geometry.polylineCount ?? 0, texts: geometry.textCount ?? 0 },
    roomLabelCandidates: labels,
    measurementStatus: geometry.unitStatus === 'drawing_units_unverified' ? 'scale_unverified' : 'unknown',
    meshStatus: 'not_generated',
    warnings: [
      '도면 좌표의 실제 길이 단위·축척은 검증 전까지 거리/면적으로 확정하지 않습니다.',
      '벽·문·창·기둥·계단·엘리베이터 의미 분리는 후속 layer/entity 매핑과 Human Review가 필요합니다.',
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
      return agentOrchestratorService.complete(job, {
        resultType: 'digital_twin_model_candidate',
        payload: { models, adapterVersion: 'digital-twin-local-v1', mode: 'geometry_metadata', safetyNote: '축척·실측·구조 의미 검증 전에는 3D 치수나 면적을 확정하지 않습니다.' },
        confidence: models.length ? (modelable / models.length) * 0.8 : 0,
        requiresReview: models.length > 0,
      });
    } catch (error) {
      await agentOrchestratorService.fail(job, error);
      throw error;
    }
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
      await propertyDataRoomRepository.saveDigitalTwinAsset({
        ...asset,
        processingStatus: accepted ? 'ready' : asset.processingStatus,
        metadata: { ...asset.metadata, digitalTwinModel: model, digitalTwinAgentResultId: result.id },
        updatedAt: new Date().toISOString(),
      });
    }
  },
};
