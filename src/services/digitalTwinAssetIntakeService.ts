import type { DigitalTwinAsset, DigitalTwinAssetType } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { agentOrchestratorService } from './agentOrchestratorService';

const MAX_ASSET_BYTES = 50 * 1024 * 1024;

const EXTENSION_ASSET_TYPE: Record<string, DigitalTwinAssetType> = {
  dxf: 'dxf',
  dwg: 'dwg',
  glb: 'glb',
  gltf: 'gltf',
  las: 'lidar',
  laz: 'lidar',
  ply: 'point_cloud',
  pcd: 'point_cloud',
  obj: 'mesh',
  stl: 'mesh',
  jpg: 'scanned_plan',
  jpeg: 'scanned_plan',
  png: 'scanned_plan',
  webp: 'scanned_plan',
  pdf: 'floor_plan',
  json: 'measurement_data',
  csv: 'measurement_data',
};

const SUPPORTED_EXTENSIONS = new Set(Object.keys(EXTENSION_ASSET_TYPE));

function extension(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase().trim() || '';
}

function normalizeFloor(value?: string) {
  const floor = value?.trim().toUpperCase();
  return floor || undefined;
}

async function nextVersion(propertyId: string, assetType: DigitalTwinAssetType, floor?: string) {
  const assets = await propertyDataRoomRepository.getDigitalTwinAssets(propertyId);
  const sameScope = assets.filter((item) => item.assetType === assetType && (item.floor || '') === (floor || ''));
  return Math.max(0, ...sameScope.map((item) => item.version || 0)) + 1;
}

export const digitalTwinAssetIntakeService = {
  supportedExtensions: [...SUPPORTED_EXTENSIONS],

  detectAssetType(fileName: string): DigitalTwinAssetType | undefined {
    return EXTENSION_ASSET_TYPE[extension(fileName)];
  },

  validate(file: File) {
    const ext = extension(file.name);
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      return `지원하지 않는 3D/도면 파일입니다. 지원 형식: ${[...SUPPORTED_EXTENSIONS].map((item) => `.${item}`).join(', ')}`;
    }
    if (file.size <= 0) return '빈 파일은 등록할 수 없습니다.';
    if (file.size > MAX_ASSET_BYTES) return 'Digital Twin 자산은 Production Storage 기준 50MiB 이하만 등록할 수 있습니다.';
    return '';
  },

  async upload(propertyId: string, file: File, input: { assetType?: DigitalTwinAssetType; floor?: string; sourceDocumentId?: string; queueAgent?: boolean } = {}): Promise<{ asset: DigitalTwinAsset; jobId?: string }> {
    const error = this.validate(file);
    if (error) throw new Error(error);
    const detectedType = this.detectAssetType(file.name);
    const assetType = input.assetType || detectedType;
    if (!assetType) throw new Error('Digital Twin 자산 유형을 판별할 수 없습니다.');
    const floor = normalizeFloor(input.floor);
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const fileFormat = extension(file.name);
    const version = await nextVersion(propertyId, assetType, floor);
    const asset: DigitalTwinAsset = {
      id,
      propertyId,
      assetType,
      fileFormat,
      storagePath: `properties/${propertyId}/digital-twin/${id}-${file.name}`,
      fileName: file.name,
      mimeType: file.type || undefined,
      fileData: file,
      sourceDocumentId: input.sourceDocumentId,
      floor,
      version,
      processingStatus: 'uploaded',
      metadata: {
        intakeSource: 'manual_upload',
        originalFileName: file.name,
        fileSize: file.size,
        detectedAssetType: detectedType,
        agentQueueRequested: input.queueAgent !== false,
      },
      createdAt: now,
      updatedAt: now,
    };
    const saved = await propertyDataRoomRepository.saveDigitalTwinAsset(asset);
    await propertyDataRoomRepository.saveDataSource({
      id: `digital-twin-source:${id}`,
      propertyId,
      resourceType: 'digital_twin_asset',
      sourceType: 'manual',
      sourceName: saved.fileName || saved.assetType,
      sourceReference: saved.id,
      collectedAt: now,
      verificationStatus: 'unverified',
      metadata: { assetId: saved.id, assetType: saved.assetType, fileFormat: saved.fileFormat, floor: saved.floor, version: saved.version, fileSize: file.size },
      createdAt: now,
    });
    if (input.queueAgent === false) return { asset: saved };
    const job = await agentOrchestratorService.queueDigitalTwin(saved, 'upload');
    return { asset: saved, jobId: job.id };
  },
};
