import type { Property, Settings } from '../types';
import type {
  PropertyVerification,
  PropertyVerificationCandidate,
  ReportSnapshot,
} from '../domain/propertyDataRoom/types';
import type { RemoteAssetMetadata, RemotePropertyObject, RemotePropertyObjectType } from './remoteDataGateway';

export const REMOTE_MIGRATION_PLAN_VERSION = 'daon-remote-migration-plan-v1';

export interface LocalMigrationSnapshot {
  properties: Property[];
  settings?: Settings;
  stores: Record<string, unknown[]>;
}

export interface RemotePropertyWritePlan {
  id: string;
  payload: Property;
}

export interface RemoteVerificationCandidatePlan {
  candidate: PropertyVerificationCandidate;
}

export interface RemoteVerificationPlan {
  verification: PropertyVerification;
}

export interface RemoteReportSnapshotPlan {
  snapshot: ReportSnapshot;
  status: 'draft' | 'final';
}

export interface RemoteAssetUploadPlan {
  resourceType: 'document' | 'media' | 'digital_twin';
  id: string;
  propertyId: string;
  storagePath: string;
  fileName: string;
  mimeType?: string;
  fileSize?: number;
  hasLocalBinary: boolean;
  binarySource: 'blob' | 'existing_remote_url' | 'missing';
}

export interface RemoteMigrationBlocker {
  code:
    | 'MISSING_PROPERTY_ID'
    | 'ORPHAN_PROPERTY_REFERENCE'
    | 'INLINE_DATA_URL'
    | 'MISSING_ASSET_BINARY'
    | 'ASSET_TOO_LARGE'
    | 'UNSUPPORTED_STORE'
    | 'INVALID_ROW';
  store: string;
  id?: string;
  propertyId?: string;
  message: string;
}

export interface RemoteMigrationPlan {
  schemaVersion: typeof REMOTE_MIGRATION_PLAN_VERSION;
  generatedAt: string;
  dryRun: true;
  networkWrites: 0;
  properties: RemotePropertyWritePlan[];
  objects: RemotePropertyObject[];
  assets: RemoteAssetMetadata[];
  assetUploads: RemoteAssetUploadPlan[];
  verificationCandidates: RemoteVerificationCandidatePlan[];
  verifications: RemoteVerificationPlan[];
  reportSnapshots: RemoteReportSnapshotPlan[];
  companySettings?: Settings;
  ignoredStores: string[];
  blockers: RemoteMigrationBlocker[];
  counts: {
    properties: number;
    objects: number;
    assets: number;
    assetUploads: number;
    verificationCandidates: number;
    verifications: number;
    reportSnapshots: number;
    blockers: number;
  };
  readyForRemoteWrite: boolean;
}

const OBJECT_STORES: readonly RemotePropertyObjectType[] = [
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
  'buildingReleaseSnapshotStates',
  'buildingReleaseShares',
  'buildingReleaseReviewNotes',
] as const;

const KNOWN_LOCAL_STORES = new Set([
  'properties',
  'settings',
  'importJobs',
  'propertyDocuments',
  'propertyMedia',
  'propertyVerifications',
  'propertyVerificationCandidates',
  'reportSnapshots',
  'digitalTwinAssets',
  ...OBJECT_STORES,
]);

const MAX_REMOTE_ASSET_BYTES = 50 * 1024 * 1024;

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function idOf(row: unknown) {
  return text(record(row)?.id);
}

function propertyIdOf(row: unknown) {
  return text(record(row)?.propertyId);
}

function sanitizedFileName(value: string) {
  return (value || 'asset').replace(/[^A-Za-z0-9._-]+/g, '_');
}

function hasInlineDataUrl(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'string') return value.startsWith('data:');
  if (!value || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => hasInlineDataUrl(item, seen));
  return Object.values(value as Record<string, unknown>).some((item) => hasInlineDataUrl(item, seen));
}

function stripBinaryFields(row: Record<string, unknown>) {
  const rest = { ...row };
  delete rest.fileData;
  return rest;
}

function ensurePropertyReference(
  store: string,
  row: unknown,
  propertyIds: Set<string>,
  blockers: RemoteMigrationBlocker[],
) {
  const id = idOf(row);
  const propertyId = propertyIdOf(row);
  if (!propertyId) {
    blockers.push({ code: 'MISSING_PROPERTY_ID', store, id: id || undefined, message: `${store} row에 propertyId가 없습니다.` });
    return undefined;
  }
  if (!propertyIds.has(propertyId)) {
    blockers.push({ code: 'ORPHAN_PROPERTY_REFERENCE', store, id: id || undefined, propertyId, message: `${store} row가 존재하지 않는 Property를 참조합니다.` });
    return undefined;
  }
  return propertyId;
}

function buildAsset(
  store: 'propertyDocuments' | 'propertyMedia' | 'digitalTwinAssets',
  row: unknown,
  propertyIds: Set<string>,
  blockers: RemoteMigrationBlocker[],
): { metadata?: RemoteAssetMetadata; upload?: RemoteAssetUploadPlan } {
  const value = record(row);
  if (!value) {
    blockers.push({ code: 'INVALID_ROW', store, message: `${store} row가 object가 아닙니다.` });
    return {};
  }
  const id = text(value.id);
  const propertyId = ensurePropertyReference(store, value, propertyIds, blockers);
  if (!id || !propertyId) {
    if (!id) blockers.push({ code: 'INVALID_ROW', store, propertyId, message: `${store} row에 id가 없습니다.` });
    return {};
  }

  const resourceType = store === 'propertyDocuments' ? 'document' : store === 'propertyMedia' ? 'media' : 'digital_twin';
  const fileName = text(value.originalFileName) || text(value.fileName) || `${id}.bin`;
  const mimeType = text(value.mimeType) || undefined;
  const rawSize = typeof value.fileSize === 'number' && Number.isFinite(value.fileSize) ? value.fileSize : undefined;
  const fileData = value.fileData;
  const hasLocalBinary = typeof Blob !== 'undefined' && fileData instanceof Blob;
  const existingUrl = text(value.fileUrl) || text(value.url);

  if (existingUrl.startsWith('data:')) {
    blockers.push({ code: 'INLINE_DATA_URL', store, id, propertyId, message: `${store}/${id}에 inline data URL이 남아 있습니다.` });
  }
  if (rawSize != null && rawSize > MAX_REMOTE_ASSET_BYTES) {
    blockers.push({ code: 'ASSET_TOO_LARGE', store, id, propertyId, message: `${store}/${id}가 server hard cap 50 MiB를 초과합니다.` });
  }
  if (!hasLocalBinary && !existingUrl) {
    blockers.push({ code: 'MISSING_ASSET_BINARY', store, id, propertyId, message: `${store}/${id}에 업로드할 binary 또는 기존 remote URL이 없습니다.` });
  }

  const storagePath = `${propertyId}/${resourceType}/${id}/${sanitizedFileName(fileName)}`;
  const metadataPayload = stripBinaryFields(value);
  delete metadataPayload.url;
  delete metadataPayload.fileUrl;
  delete metadataPayload.storagePath;
  if (hasInlineDataUrl(metadataPayload)) {
    blockers.push({ code: 'INLINE_DATA_URL', store, id, propertyId, message: `${store}/${id} metadata 내부에 inline data URL이 있습니다.` });
  }

  return {
    metadata: {
      resourceType,
      id,
      propertyId,
      storagePath,
      originalFileName: fileName,
      mimeType,
      fileSize: rawSize,
      metadata: metadataPayload,
    },
    upload: {
      resourceType,
      id,
      propertyId,
      storagePath,
      fileName,
      mimeType,
      fileSize: rawSize,
      hasLocalBinary,
      binarySource: hasLocalBinary ? 'blob' : existingUrl && !existingUrl.startsWith('data:') ? 'existing_remote_url' : 'missing',
    },
  };
}

function reportStatus(row: ReportSnapshot): 'draft' | 'final' {
  return row.status === 'ready' || row.status === 'archived' ? 'final' : 'draft';
}

export function buildRemoteMigrationPlan(snapshot: LocalMigrationSnapshot): RemoteMigrationPlan {
  const blockers: RemoteMigrationBlocker[] = [];
  const propertyIds = new Set(snapshot.properties.map((property) => property.id).filter(Boolean));
  const properties = snapshot.properties.flatMap((property) => {
    if (!property.id) {
      blockers.push({ code: 'INVALID_ROW', store: 'properties', message: 'Property id가 없습니다.' });
      return [];
    }
    return [{ id: property.id, payload: property }];
  });

  const objects: RemotePropertyObject[] = [];
  for (const store of OBJECT_STORES) {
    for (const row of snapshot.stores[store] ?? []) {
      const value = record(row);
      const id = idOf(row);
      const propertyId = ensurePropertyReference(store, row, propertyIds, blockers);
      if (!value || !id || !propertyId) {
        if (value && !id) blockers.push({ code: 'INVALID_ROW', store, propertyId, message: `${store} row에 id가 없습니다.` });
        continue;
      }
      if (hasInlineDataUrl(value)) {
        blockers.push({ code: 'INLINE_DATA_URL', store, id, propertyId, message: `${store}/${id}에 inline data URL이 포함되어 있습니다.` });
        continue;
      }
      objects.push({ objectType: store, id, propertyId, payload: value });
    }
  }

  const assets: RemoteAssetMetadata[] = [];
  const assetUploads: RemoteAssetUploadPlan[] = [];
  for (const store of ['propertyDocuments', 'propertyMedia', 'digitalTwinAssets'] as const) {
    for (const row of snapshot.stores[store] ?? []) {
      const built = buildAsset(store, row, propertyIds, blockers);
      if (built.metadata) assets.push(built.metadata);
      if (built.upload) assetUploads.push(built.upload);
    }
  }

  const verificationCandidates = (snapshot.stores.propertyVerificationCandidates ?? []).flatMap((row) => {
    const propertyId = ensurePropertyReference('propertyVerificationCandidates', row, propertyIds, blockers);
    const id = idOf(row);
    if (!propertyId || !id || !record(row)) return [];
    return [{ candidate: row as PropertyVerificationCandidate }];
  });

  const verifications = (snapshot.stores.propertyVerifications ?? []).flatMap((row) => {
    const propertyId = ensurePropertyReference('propertyVerifications', row, propertyIds, blockers);
    const id = idOf(row);
    if (!propertyId || !id || !record(row)) return [];
    return [{ verification: row as PropertyVerification }];
  });

  const reportSnapshots = (snapshot.stores.reportSnapshots ?? []).flatMap((row) => {
    const propertyId = ensurePropertyReference('reportSnapshots', row, propertyIds, blockers);
    const id = idOf(row);
    if (!propertyId || !id || !record(row)) return [];
    const typed = row as ReportSnapshot;
    return [{ snapshot: typed, status: reportStatus(typed) }];
  });

  const ignoredStores = Object.keys(snapshot.stores)
    .filter((store) => !KNOWN_LOCAL_STORES.has(store))
    .sort();
  for (const store of ignoredStores) {
    if ((snapshot.stores[store] ?? []).length) {
      blockers.push({ code: 'UNSUPPORTED_STORE', store, message: `${store}는 remote migration mapping이 정의되지 않았습니다.` });
    }
  }

  const plan: RemoteMigrationPlan = {
    schemaVersion: REMOTE_MIGRATION_PLAN_VERSION,
    generatedAt: new Date().toISOString(),
    dryRun: true,
    networkWrites: 0,
    properties,
    objects,
    assets,
    assetUploads,
    verificationCandidates,
    verifications,
    reportSnapshots,
    companySettings: snapshot.settings,
    ignoredStores,
    blockers,
    counts: {
      properties: properties.length,
      objects: objects.length,
      assets: assets.length,
      assetUploads: assetUploads.length,
      verificationCandidates: verificationCandidates.length,
      verifications: verifications.length,
      reportSnapshots: reportSnapshots.length,
      blockers: blockers.length,
    },
    readyForRemoteWrite: blockers.length === 0,
  };
  return plan;
}

export const remoteMigrationPlanService = { build: buildRemoteMigrationPlan };
