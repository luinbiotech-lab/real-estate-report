import type { AgentJob, DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { floorPlanGeometryAgentPort } from '../agents/agentDataPorts';
import { agentExecutionService } from './agentExecutionService';
import { agentOrchestratorService } from './agentOrchestratorService';
import { floorPlanGeometryService } from './floorPlanGeometryService';

async function executeDigitalTwin(job: AgentJob, asset: DigitalTwinAsset) {
  let running = job;
  try {
    if (running.status !== 'running') running = await agentOrchestratorService.start(running);
    const floor = asset.floor;
    if (!floorPlanGeometryService.canExtract(asset)) {
      return agentOrchestratorService.complete(running, {
        resultType: 'floor_plan_intake_candidate',
        payload: {
          sourceDigitalTwinAssetId: asset.id,
          fileName: asset.fileName || '',
          mimeType: asset.mimeType || '',
          storagePath: asset.storagePath,
          assetType: asset.assetType,
          floor,
          geometryStatus: asset.assetType === 'dwg' ? 'converter_required' : 'not_available',
          geometryWarnings: asset.assetType === 'dwg' ? ['DWG는 브라우저에서 직접 파싱하지 않고 별도 변환기(DWG→DXF/IFC 등) 연결이 필요합니다.'] : [],
          nextAgent: 'digital_twin',
        },
        confidence: floor ? 0.82 : 0.7,
        requiresReview: true,
      });
    }
    const geometry = await floorPlanGeometryService.extract(asset);
    return agentOrchestratorService.complete(running, {
      resultType: 'floor_plan_intake_candidate',
      payload: {
        sourceDigitalTwinAssetId: asset.id,
        fileName: asset.fileName || '',
        mimeType: asset.mimeType || '',
        storagePath: asset.storagePath,
        assetType: asset.assetType,
        floor,
        geometryStatus: 'extracted_candidate',
        geometry,
        nextAgent: 'digital_twin',
      },
      confidence: geometry.lineCount || geometry.polylineCount ? 0.86 : 0.65,
      requiresReview: true,
    });
  } catch (error) {
    await agentOrchestratorService.fail(running, error);
    throw error;
  }
}

export const floorPlanExecutionService = {
  async execute(job: AgentJob) {
    if (job.agentType !== 'floor_plan' || job.resourceType !== 'digital_twin' || !job.resourceId) return agentExecutionService.execute(job);
    const asset = (await floorPlanGeometryAgentPort.getDigitalTwinAssets(job.propertyId)).find((item) => item.id === job.resourceId);
    if (!asset) return agentExecutionService.execute(job);
    return executeDigitalTwin(job, asset);
  },

  async applyApprovedGeometry(result: { propertyId: string; id: string; payload: Record<string, unknown> }) {
    const assetId = typeof result.payload.sourceDigitalTwinAssetId === 'string' ? result.payload.sourceDigitalTwinAssetId : '';
    if (!assetId) return;
    const assets = await floorPlanGeometryAgentPort.getDigitalTwinAssets(result.propertyId);
    const asset = assets.find((item) => item.id === assetId);
    if (!asset) return;
    const geometry = result.payload.geometry && typeof result.payload.geometry === 'object' ? result.payload.geometry as Record<string, unknown> : undefined;
    const geometryStatus = typeof result.payload.geometryStatus === 'string' ? result.payload.geometryStatus : undefined;
    await floorPlanGeometryAgentPort.saveDigitalTwinAsset({
      ...asset,
      processingStatus: geometry ? 'processing' : asset.processingStatus,
      metadata: { ...asset.metadata, geometryStatus, geometry, geometryAgentResultId: result.id },
      updatedAt: new Date().toISOString(),
    });
  },
};
