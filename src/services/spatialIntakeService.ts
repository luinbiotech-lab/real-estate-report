import type { MediaCategory, PropertyMedia } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { agentExecutionService } from './agentExecutionService';
import { agentOrchestratorService } from './agentOrchestratorService';

const MAX_MEDIA_BYTES = 20 * 1024 * 1024;
const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const spatialIntakeService = {
  validate(file: File) {
    if (!ALLOWED_MEDIA_TYPES.includes(file.type)) return 'JPG, PNG, WEBP 이미지만 등록할 수 있습니다.';
    if (file.size > MAX_MEDIA_BYTES) return '파일은 20MB 이하만 등록할 수 있습니다.';
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
};
