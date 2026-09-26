import type { AgentJob, AgentResult, AgentReview, DataRoomBundle, DigitalTwinAsset, PropertyDataSource, PropertyDocument, PropertyFacility, PropertyMedia, PropertyRiskAssessment, PropertySpace, PropertyVerification, PropertyVerificationCandidate, RenovationAssessment, ReportSnapshot, RoomConditionHistoryEntry, RoomEvidencePosition, RoomRenovationAssessment, RoomRenovationHistoryEntry, SpaceMediaLink, SpaceRoomLink } from '../domain/propertyDataRoom/types';
import type { Property } from '../types';
import { REMOTE_OPERATIONAL_MODE } from '../services/operationalDataMode';
import { remoteAssetStorageGateway, remoteDataGateway, type RemoteAssetResourceType, type RemotePropertyObjectType } from '../services/remoteDataGateway';
import { database } from './database';

type StoreName = 'propertyDocuments' | 'propertyMedia' | 'propertyVerifications' | 'propertyVerificationCandidates' | 'propertyDataSources' | 'reportSnapshots' | 'digitalTwinAssets' | 'agentJobs' | 'agentResults' | 'agentReviews' | 'propertySpaces' | 'spaceMediaLinks' | 'spaceRoomLinks' | 'propertyFacilities' | 'roomEvidencePositions' | 'roomConditionHistory' | 'renovationAssessments' | 'roomRenovationAssessments' | 'roomRenovationHistory' | 'riskAssessments' | 'buildingReleaseSnapshots';

const REMOTE_OBJECT_STORES = new Set<RemotePropertyObjectType>([
  'propertyDataSources',
  'agentJobs',
  'agentResults',
  'agentReviews',
  'propertySpaces',
  'spaceMediaLinks',
  'spaceRoomLinks',
  'propertyFacilities',
  'roomEvidencePositions',
  'roomConditionHistory',
  'renovationAssessments',
  'roomRenovationAssessments',
  'roomRenovationHistory',
  'riskAssessments',
  'buildingReleaseSnapshots',
]);

function isRemoteObjectStore(storeName: StoreName): storeName is RemotePropertyObjectType {
  return REMOTE_OBJECT_STORES.has(storeName as RemotePropertyObjectType);
}

async function localByProperty<T>(storeName: StoreName, propertyId: string): Promise<T[]> {
  const values = await (await database).getAllFromIndex(storeName, 'propertyId', propertyId) as T[];
  return values.filter((value) => !(value as { deletedAt?: string }).deletedAt);
}

async function remoteObjectByProperty<T>(storeName: RemotePropertyObjectType, propertyId: string): Promise<T[]> {
  return (await remoteDataGateway.listObjects(propertyId, storeName))
    .map((item) => item.payload as T)
    .filter((value) => !(value as { deletedAt?: string }).deletedAt);
}

async function byProperty<T>(storeName: StoreName, propertyId: string): Promise<T[]> {
  if (REMOTE_OPERATIONAL_MODE && isRemoteObjectStore(storeName)) return remoteObjectByProperty<T>(storeName, propertyId);
  return localByProperty<T>(storeName, propertyId);
}

async function put<T extends { id: string; propertyId: string }>(storeName: StoreName, value: T): Promise<T> {
  if (REMOTE_OPERATIONAL_MODE) {
    if (!isRemoteObjectStore(storeName)) throw new Error(`${storeName}는 remote object 저장 경로가 아닙니다.`);
    await remoteDataGateway.upsertObject({
      objectType: storeName,
      id: value.id,
      propertyId: value.propertyId,
      payload: value as unknown as Record<string, unknown>,
    });
    return value;
  }
  await (await database).put(storeName, value);
  return value;
}

const REPORT_MEDIA_PRIORITY: Partial<Record<PropertyMedia['category'], number>> = {
  exterior: 0,
  road: 1,
  surroundings: 2,
  entrance: 3,
  facade_detail: 4,
  aerial: 5,
  parking: 6,
};

function sortReportMedia(items: PropertyMedia[]) {
  return [...items].sort((left, right) => {
    if (left.isPrimary !== right.isPrimary) return left.isPrimary ? -1 : 1;
    const categoryOrder = (REPORT_MEDIA_PRIORITY[left.category] ?? 50) - (REPORT_MEDIA_PRIORITY[right.category] ?? 50);
    if (categoryOrder !== 0) return categoryOrder;
    return left.sortOrder - right.sortOrder || left.createdAt.localeCompare(right.createdAt);
  });
}

function sanitizedFileName(value: string) {
  return (value || 'asset').replace(/[^A-Za-z0-9._-]+/g, '_');
}

function assetFileName(value: Record<string, unknown>) {
  return String(value.originalFileName || value.fileName || `${String(value.id || 'asset')}.bin`);
}

function assetMetadataPayload(value: Record<string, unknown>) {
  const metadata = { ...value };
  delete metadata.fileData;
  delete metadata.url;
  delete metadata.fileUrl;
  delete metadata.storagePath;
  return metadata;
}

async function saveRemoteAsset<T extends { id: string; propertyId: string }>(
  resourceType: RemoteAssetResourceType,
  value: T,
): Promise<T> {
  const record = value as unknown as Record<string, unknown>;
  const fileName = assetFileName(record);
  const existing = (await remoteDataGateway.listAssets(value.propertyId, resourceType)).find((item) => item.id === value.id);
  const storagePath = existing?.storagePath || `${value.propertyId}/${resourceType}/${value.id}/${sanitizedFileName(fileName)}`;
  const blob = record.fileData;
  const mimeType = typeof record.mimeType === 'string' ? record.mimeType : existing?.mimeType;
  const fileSize = typeof record.fileSize === 'number' ? record.fileSize : blob instanceof Blob ? blob.size : existing?.fileSize;

  if (blob instanceof Blob) await remoteAssetStorageGateway.upload(storagePath, blob, mimeType, true);
  else if (!existing) throw new Error(`${resourceType}/${value.id}: remote 저장에 필요한 binary가 없습니다.`);

  const saved = { ...record, storagePath } as unknown as T;
  await remoteDataGateway.upsertAssetMetadata({
    resourceType,
    id: value.id,
    propertyId: value.propertyId,
    storagePath,
    originalFileName: fileName,
    mimeType,
    fileSize,
    metadata: assetMetadataPayload(saved as unknown as Record<string, unknown>),
  });
  return saved;
}

async function loadRemoteAsset<T>(resourceType: RemoteAssetResourceType, propertyId: string): Promise<T[]> {
  const assets = await remoteDataGateway.listAssets(propertyId, resourceType);
  return Promise.all(assets.map(async (asset) => {
    const blob = await remoteAssetStorageGateway.download(asset.storagePath);
    const row: Record<string, unknown> = {
      ...asset.metadata,
      id: asset.id,
      propertyId: asset.propertyId,
      storagePath: asset.storagePath,
      mimeType: asset.mimeType ?? (asset.metadata.mimeType as string | undefined),
      fileSize: asset.fileSize ?? blob.size,
      fileData: blob,
    };
    if (resourceType === 'document') row.originalFileName = asset.originalFileName || row.originalFileName;
    else row.fileName = asset.originalFileName || row.fileName;
    if (resourceType === 'media') row.url = URL.createObjectURL(blob);
    return row as T;
  }));
}

async function findRemoteAsset<T>(resourceType: RemoteAssetResourceType, id: string): Promise<T | undefined> {
  const properties = await remoteDataGateway.listProperties();
  for (const property of properties) {
    const rows = await loadRemoteAsset<T>(resourceType, property.id);
    const found = rows.find((row) => (row as { id?: string }).id === id);
    if (found) return found;
  }
  return undefined;
}

async function deleteRemoteAsset(resourceType: RemoteAssetResourceType, id: string) {
  const properties = await remoteDataGateway.listProperties();
  for (const property of properties) {
    const asset = (await remoteDataGateway.listAssets(property.id, resourceType)).find((item) => item.id === id);
    if (!asset) continue;
    await remoteAssetStorageGateway.remove([asset.storagePath]);
    await remoteDataGateway.deleteAssetMetadata(resourceType, id);
    return;
  }
}

function remoteSnapshotStatus(snapshot: ReportSnapshot): 'draft' | 'final' {
  return snapshot.status === 'ready' || snapshot.status === 'archived' ? 'final' : 'draft';
}

async function findRemoteSnapshot(id: string): Promise<ReportSnapshot | undefined> {
  const properties = await remoteDataGateway.listProperties();
  for (const property of properties) {
    const snapshot = (await remoteDataGateway.listReportSnapshots(property.id)).find((item) => item.id === id);
    if (snapshot) return snapshot;
  }
  return undefined;
}

export const propertyDataRoomRepository = {
  getDocuments: (propertyId: string) => REMOTE_OPERATIONAL_MODE
    ? loadRemoteAsset<PropertyDocument>('document', propertyId)
    : localByProperty<PropertyDocument>('propertyDocuments', propertyId),

  async getDocument(id: string) {
    if (REMOTE_OPERATIONAL_MODE) return findRemoteAsset<PropertyDocument>('document', id);
    return (await database).get('propertyDocuments', id) as Promise<PropertyDocument | undefined>;
  },

  createDocument: (value: PropertyDocument) => REMOTE_OPERATIONAL_MODE
    ? saveRemoteAsset<PropertyDocument>('document', value)
    : (async () => { await (await database).put('propertyDocuments', value); return value; })(),

  updateDocument: (value: PropertyDocument) => REMOTE_OPERATIONAL_MODE
    ? saveRemoteAsset<PropertyDocument>('document', value)
    : (async () => { await (await database).put('propertyDocuments', value); return value; })(),

  async deleteDocument(id: string) {
    if (REMOTE_OPERATIONAL_MODE) return deleteRemoteAsset('document', id);
    const db = await database;
    const value = await db.get('propertyDocuments', id) as PropertyDocument | undefined;
    if (value) await db.put('propertyDocuments', { ...value, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), fileData: undefined });
  },

  async getMedia(propertyId: string) {
    const items = REMOTE_OPERATIONAL_MODE
      ? await loadRemoteAsset<PropertyMedia>('media', propertyId)
      : await localByProperty<PropertyMedia>('propertyMedia', propertyId);
    return sortReportMedia(items);
  },

  async getMediaItem(id: string) {
    if (REMOTE_OPERATIONAL_MODE) return findRemoteAsset<PropertyMedia>('media', id);
    return (await database).get('propertyMedia', id) as Promise<PropertyMedia | undefined>;
  },

  createMedia: (value: PropertyMedia) => REMOTE_OPERATIONAL_MODE
    ? saveRemoteAsset<PropertyMedia>('media', value)
    : (async () => { await (await database).put('propertyMedia', value); return value; })(),

  updateMedia: (value: PropertyMedia) => REMOTE_OPERATIONAL_MODE
    ? saveRemoteAsset<PropertyMedia>('media', value)
    : (async () => { await (await database).put('propertyMedia', value); return value; })(),

  async deleteMedia(id: string) {
    if (REMOTE_OPERATIONAL_MODE) return deleteRemoteAsset('media', id);
    const db = await database;
    const value = await db.get('propertyMedia', id) as PropertyMedia | undefined;
    if (value) await db.put('propertyMedia', { ...value, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), fileData: undefined });
  },

  getSpaces: (propertyId: string) => byProperty<PropertySpace>('propertySpaces', propertyId),
  saveSpace: (value: PropertySpace) => put('propertySpaces', value),
  getSpaceMediaLinks: (propertyId: string) => byProperty<SpaceMediaLink>('spaceMediaLinks', propertyId),
  saveSpaceMediaLink: (value: SpaceMediaLink) => put('spaceMediaLinks', value),
  getSpaceRoomLinks: (propertyId: string) => byProperty<SpaceRoomLink>('spaceRoomLinks', propertyId),
  saveSpaceRoomLink: (value: SpaceRoomLink) => put('spaceRoomLinks', value),
  getFacilities: (propertyId: string) => byProperty<PropertyFacility>('propertyFacilities', propertyId),
  saveFacility: (value: PropertyFacility) => put('propertyFacilities', value),
  getRoomEvidencePositions: (propertyId: string) => byProperty<RoomEvidencePosition>('roomEvidencePositions', propertyId),
  saveRoomEvidencePosition: (value: RoomEvidencePosition) => put('roomEvidencePositions', value),
  getRoomConditionHistory: (propertyId: string) => byProperty<RoomConditionHistoryEntry>('roomConditionHistory', propertyId),
  saveRoomConditionHistory: (value: RoomConditionHistoryEntry) => put('roomConditionHistory', value),
  getRenovationAssessments: (propertyId: string) => byProperty<RenovationAssessment>('renovationAssessments', propertyId),
  saveRenovationAssessment: (value: RenovationAssessment) => put('renovationAssessments', value),
  getRoomRenovationAssessments: (propertyId: string) => byProperty<RoomRenovationAssessment>('roomRenovationAssessments', propertyId),
  saveRoomRenovationAssessment: (value: RoomRenovationAssessment) => put('roomRenovationAssessments', value),
  getRoomRenovationHistory: (propertyId: string) => byProperty<RoomRenovationHistoryEntry>('roomRenovationHistory', propertyId),
  saveRoomRenovationHistory: (value: RoomRenovationHistoryEntry) => put('roomRenovationHistory', value),
  getRiskAssessments: (propertyId: string) => byProperty<PropertyRiskAssessment>('riskAssessments', propertyId),
  saveRiskAssessment: (value: PropertyRiskAssessment) => put('riskAssessments', value),

  getVerifications: (propertyId: string) => REMOTE_OPERATIONAL_MODE
    ? remoteDataGateway.listVerifications(propertyId)
    : localByProperty<PropertyVerification>('propertyVerifications', propertyId),

  saveVerification: async (value: PropertyVerification) => {
    if (REMOTE_OPERATIONAL_MODE) return remoteDataGateway.appendVerification(value);
    await (await database).put('propertyVerifications', value);
    return value;
  },

  getVerificationCandidates: (propertyId: string) => REMOTE_OPERATIONAL_MODE
    ? remoteDataGateway.listVerificationCandidates(propertyId)
    : localByProperty<PropertyVerificationCandidate>('propertyVerificationCandidates', propertyId),

  saveVerificationCandidate: async (value: PropertyVerificationCandidate) => {
    if (REMOTE_OPERATIONAL_MODE) {
      if (value.decisionStatus === 'pending') return remoteDataGateway.submitVerificationCandidate(value);
      await remoteDataGateway.decideVerificationCandidate(value.id, value.decisionStatus === 'approved' ? 'approved' : value.decisionStatus === 'rejected' ? 'rejected' : 'held', value.note);
      return value;
    }
    await (await database).put('propertyVerificationCandidates', value);
    return value;
  },

  getDataSources: (propertyId: string) => byProperty<PropertyDataSource>('propertyDataSources', propertyId),
  saveDataSource: (value: PropertyDataSource) => put('propertyDataSources', value),

  async approveVerificationCandidate(input: { property: Property; candidate: PropertyVerificationCandidate; verification: PropertyVerification; dataSource: PropertyDataSource; }): Promise<PropertyVerificationCandidate> {
    if (REMOTE_OPERATIONAL_MODE) {
      await remoteDataGateway.upsertProperty(input.property);
      await remoteDataGateway.upsertObject({ objectType: 'propertyDataSources', id: input.dataSource.id, propertyId: input.dataSource.propertyId, payload: input.dataSource as unknown as Record<string, unknown> });
      await remoteDataGateway.appendVerification(input.verification);
      await remoteDataGateway.decideVerificationCandidate(input.candidate.id, 'approved', input.candidate.note);
      return input.candidate;
    }
    const db = await database;
    const tx = db.transaction(['properties', 'propertyVerificationCandidates', 'propertyVerifications', 'propertyDataSources'], 'readwrite');
    await Promise.all([
      tx.objectStore('properties').put(input.property),
      tx.objectStore('propertyVerificationCandidates').put(input.candidate),
      tx.objectStore('propertyVerifications').put(input.verification),
      tx.objectStore('propertyDataSources').put(input.dataSource),
    ]);
    await tx.done;
    return input.candidate;
  },

  getReportSnapshots: (propertyId: string) => REMOTE_OPERATIONAL_MODE
    ? remoteDataGateway.listReportSnapshots(propertyId)
    : localByProperty<ReportSnapshot>('reportSnapshots', propertyId),

  async getReportSnapshot(id: string) {
    if (REMOTE_OPERATIONAL_MODE) return findRemoteSnapshot(id);
    return (await database).get('reportSnapshots', id) as Promise<ReportSnapshot | undefined>;
  },

  async saveReportSnapshot(value: ReportSnapshot) {
    if (REMOTE_OPERATIONAL_MODE) {
      await remoteDataGateway.createReportSnapshot({ snapshot: value, status: remoteSnapshotStatus(value) });
      return value;
    }
    await (await database).add('reportSnapshots', value);
    return value;
  },

  async updateReportSnapshotStatus(id: string, status: ReportSnapshot['status']): Promise<ReportSnapshot> {
    if (REMOTE_OPERATIONAL_MODE) {
      if (status === 'archived') throw new Error('Production Snapshot은 immutable입니다. 기존 draft를 archive로 변경하지 않고 새 버전을 생성하세요.');
      const current = await findRemoteSnapshot(id);
      if (!current) throw new Error('보고서 Snapshot을 찾을 수 없습니다.');
      if (status === current.status) return current;
      if (status !== 'ready' || current.status !== 'draft') throw new Error('Production에서는 draft를 새 final Snapshot으로 승격하는 흐름만 허용합니다.');
      const existing = await remoteDataGateway.listReportSnapshots(current.propertyId);
      const now = new Date().toISOString();
      const finalized: ReportSnapshot = {
        ...current,
        id: crypto.randomUUID(),
        reportVersion: Math.max(0, ...existing.filter((item) => item.reportType === current.reportType).map((item) => item.reportVersion)) + 1,
        generatedAt: now,
        status: 'ready',
        createdAt: now,
      };
      await remoteDataGateway.createReportSnapshot({ snapshot: finalized, status: 'final' });
      return finalized;
    }
    const db = await database;
    const tx = db.transaction('reportSnapshots', 'readwrite');
    const current = await tx.store.get(id) as ReportSnapshot | undefined;
    if (!current) { await tx.done; throw new Error('보고서 Snapshot을 찾을 수 없습니다.'); }
    const updated = { ...current, status };
    await tx.store.put(updated);
    await tx.done;
    return updated;
  },

  async createNextReportSnapshot(input: Omit<ReportSnapshot, 'reportVersion'>): Promise<ReportSnapshot> {
    if (REMOTE_OPERATIONAL_MODE) {
      const existing = await remoteDataGateway.listReportSnapshots(input.propertyId);
      const reportVersion = Math.max(0, ...existing.filter((item) => item.reportType === input.reportType).map((item) => item.reportVersion)) + 1;
      const snapshot = { ...input, reportVersion };
      await remoteDataGateway.createReportSnapshot({ snapshot, status: remoteSnapshotStatus(snapshot) });
      return snapshot;
    }
    const db = await database;
    const tx = db.transaction('reportSnapshots', 'readwrite');
    const existing = await tx.store.index('propertyId').getAll(input.propertyId) as ReportSnapshot[];
    const reportVersion = Math.max(0, ...existing.filter((item) => item.reportType === input.reportType).map((item) => item.reportVersion)) + 1;
    const snapshot = { ...input, reportVersion };
    await tx.store.add(snapshot);
    await tx.done;
    return snapshot;
  },

  getDigitalTwinAssets: (propertyId: string) => REMOTE_OPERATIONAL_MODE
    ? loadRemoteAsset<DigitalTwinAsset>('digital_twin', propertyId)
    : localByProperty<DigitalTwinAsset>('digitalTwinAssets', propertyId),

  saveDigitalTwinAsset: (value: DigitalTwinAsset) => REMOTE_OPERATIONAL_MODE
    ? saveRemoteAsset<DigitalTwinAsset>('digital_twin', value)
    : (async () => { await (await database).put('digitalTwinAssets', value); return value; })(),

  getAgentJobs: (propertyId: string) => byProperty<AgentJob>('agentJobs', propertyId),
  saveAgentJob: (value: AgentJob) => put('agentJobs', value),
  getAgentResults: (propertyId: string) => byProperty<AgentResult>('agentResults', propertyId),
  saveAgentResult: (value: AgentResult) => put('agentResults', value),
  getAgentReviews: (propertyId: string) => byProperty<AgentReview>('agentReviews', propertyId),
  saveAgentReview: (value: AgentReview) => put('agentReviews', value),

  async getAgentResultsByJob(jobId: string): Promise<AgentResult[]> {
    if (!REMOTE_OPERATIONAL_MODE) return (await database).getAllFromIndex('agentResults', 'jobId', jobId) as Promise<AgentResult[]>;
    const output: AgentResult[] = [];
    for (const property of await remoteDataGateway.listProperties()) {
      output.push(...(await remoteObjectByProperty<AgentResult>('agentResults', property.id)).filter((item) => item.jobId === jobId));
    }
    return output;
  },

  async archiveProperty(propertyId: string) {
    if (REMOTE_OPERATIONAL_MODE) return;
    const db = await database;
    const now = new Date().toISOString();
    const stores: StoreName[] = ['propertyDocuments', 'propertyMedia', 'propertyVerifications', 'propertyVerificationCandidates', 'propertyDataSources', 'reportSnapshots', 'digitalTwinAssets', 'agentJobs', 'agentResults', 'agentReviews', 'propertySpaces', 'spaceMediaLinks', 'spaceRoomLinks', 'propertyFacilities', 'roomEvidencePositions', 'roomConditionHistory', 'renovationAssessments', 'roomRenovationAssessments', 'roomRenovationHistory', 'riskAssessments', 'buildingReleaseSnapshots'];
    for (const storeName of stores) {
      const values = await db.getAllFromIndex(storeName, 'propertyId', propertyId) as Array<Record<string, unknown> & { id: string }>;
      const tx = db.transaction(storeName, 'readwrite');
      for (const value of values) await tx.store.put({ ...value, deletedAt: now, updatedAt: now, fileData: undefined });
      await tx.done;
    }
  },

  async getBundle(propertyId: string): Promise<DataRoomBundle> {
    const [documents, media, verifications, verificationCandidates, dataSources, reportSnapshots, digitalTwinAssets, agentJobs, agentResults, agentReviews, spaces, spaceMediaLinks, spaceRoomLinks, facilities, roomEvidencePositions, roomConditionHistory, renovationAssessments, roomRenovationAssessments, roomRenovationHistory, riskAssessments] = await Promise.all([
      this.getDocuments(propertyId),
      this.getMedia(propertyId),
      this.getVerifications(propertyId),
      this.getVerificationCandidates(propertyId),
      this.getDataSources(propertyId),
      this.getReportSnapshots(propertyId),
      this.getDigitalTwinAssets(propertyId),
      this.getAgentJobs(propertyId),
      this.getAgentResults(propertyId),
      this.getAgentReviews(propertyId),
      this.getSpaces(propertyId),
      this.getSpaceMediaLinks(propertyId),
      this.getSpaceRoomLinks(propertyId),
      this.getFacilities(propertyId),
      this.getRoomEvidencePositions(propertyId),
      this.getRoomConditionHistory(propertyId),
      this.getRenovationAssessments(propertyId),
      this.getRoomRenovationAssessments(propertyId),
      this.getRoomRenovationHistory(propertyId),
      this.getRiskAssessments(propertyId),
    ]);
    return { documents, media, verifications, verificationCandidates, dataSources, reportSnapshots, digitalTwinAssets, agentJobs, agentResults, agentReviews, spaces, spaceMediaLinks, spaceRoomLinks, facilities, roomEvidencePositions, roomConditionHistory, renovationAssessments, roomRenovationAssessments, roomRenovationHistory, riskAssessments };
  },
};
