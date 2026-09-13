import type { DigitalTwinAsset, MediaCategory, PropertyMedia } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { agentExecutionService } from './agentExecutionService';
import { agentOrchestratorService } from './agentOrchestratorService';

const MAX_MEDIA_BYTES = 20 * 1024 * 1024;
const MAX_PLAN_BYTES = 50 * 1024 * 1024;
const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PLAN_EXTENSIONS = ['pdf', 'dwg', 'dxf', 'jpg', 'jpeg', 'png', 'webp'];

function planAssetType(file: File): DigitalTwinAsset['assetType'] {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (extension === 'dwg') return 'dwg';
  if (extension === 'dxf') return 'dxf';
  if (file.type.startsWith('image/')) return 'scanned_plan';
  return 'floor_plan';
}

export const spatialIntakeService = {
  validate(file: File) {
    if (!ALLOWED_MEDIA_TYPES.includes(file.type)) return 'JPG, PNG, WEBP 이미지만 등록할 수 있습니다.';
    if (file.size > MAX_MEDIA_BYTES) return '파일은 20MB 이하만 등록할 수 있습니다.';
    return '';
  },

  validatePlan(file: File) {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    if (!PLAN_EXTENSIONS.includes(extension)) return '도면은 PDF, DWG, DXF, JPG, PNG, WEBP 형식만 등록할 수 있습니다.';
    if (file.size > MAX_PLAN_BYTES) return '도면 파일은 50MB 이하만 등록할 수 있습니다.';
    return '';
  },

  async upload(propertyId: string, file: File, category: MediaCategory = 'interior'): Promise<PropertyMedia> {
    const error = this.validate(file);
    if (error) throw new Error(error);
    const now = new Date().toISOString();
    const media: PropertyMedia = {
      id: crypto.randomUUID(),
      propertyId,
      mediaType: 'image',
      category,
      storagePath: `properties/${propertyId}/media/${crypto.randomUUID()}-${file.name}`,
      fileData: file,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      caption: file.name.replace(/\.[^.]+$/, ''),
      aiTags: [],
      verificationStatus: 'unverified',
      sortOrder: Date.now(),
      isPrimary: false,
      createdAt: now,
      updatedAt: now,
    };
    const saved = await propertyDataRoomRepository.createMedia(media);
    await propertyDataRoomRepository.saveDataSource({
      id: crypto.randomUUID(), propertyId, resourceType: 'media', sourceType: 'manual', sourceName: file.name,
      sourceReference: saved.id, collectedAt: now, verificationStatus: 'unverified', metadata: { mediaId: saved.id, category, mimeType: file.type, fileSize: file.size }, createdAt: now,
    });
    const job = await agentOrchestratorService.queueMedia(saved, 'upload');
    if (job.status === 'queued') {
      try { await agentExecutionService.execute(job); }
      catch { /* Failed jobs remain visible and retryable in Agent Operations. */ }
    }
    return saved;
  },

  async uploadPlanAsset(propertyId: string, file: File, floor?: string): Promise<DigitalTwinAsset> {
    const error = this.validatePlan(file);
    if (error) throw new Error(error);
    const now = new Date().toISOString();
    const extension = file.name.split('.').pop()?.toLowerCase() || 'unknown';
    const asset: DigitalTwinAsset = {
      id: crypto.randomUUID(), propertyId, assetType: planAssetType(file), fileFormat: extension,
      storagePath: `properties/${propertyId}/digital-twin/${crypto.randomUUID()}-${file.name}`,
      fileName: file.name, mimeType: file.type || 'application/octet-stream', fileData: file, floor: floor?.trim() || undefined,
      version: 1, processingStatus: 'uploaded', metadata: { intake: 'spatial_workspace', originalFileName: file.name, fileSize: file.size }, createdAt: now, updatedAt: now,
    };
    const saved = await propertyDataRoomRepository.saveDigitalTwinAsset(asset);
    await propertyDataRoomRepository.saveDataSource({
      id: crypto.randomUUID(), propertyId, resourceType: 'digital_twin', sourceType: 'manual', sourceName: file.name,
      sourceReference: saved.id, collectedAt: now, verificationStatus: 'unverified', metadata: { digitalTwinAssetId: saved.id, assetType: saved.assetType, fileFormat: extension, fileSize: file.size, floor: saved.floor }, createdAt: now,
    });
    const job = await agentOrchestratorService.queueDigitalTwin(saved, 'upload');
    if (job.status === 'queued') {
      try { await agentExecutionService.execute(job); }
      catch { /* Failed jobs remain visible and retryable in Agent Operations. */ }
    }
    return saved;
  },
};
