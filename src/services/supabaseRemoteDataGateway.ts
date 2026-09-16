import type { Property, Settings } from '../types';
import type { PropertyVerification, PropertyVerificationCandidate, ReportSnapshot } from '../domain/propertyDataRoom/types';
import type {
  RemoteAssetMetadata,
  RemoteAssetResourceType,
  RemoteDataGateway,
  RemotePropertyObject,
  RemotePropertyObjectType,
  RemoteReportSnapshotInput,
} from './remoteDataGateway';

export interface SupabaseRemoteDataGatewayConfig {
  projectUrl: string;
  anonKey: string;
  getAccessToken: () => Promise<string | null>;
  getActorId: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
}

export interface RemoteAssetStorageGateway {
  upload(path: string, body: Blob, contentType?: string, upsert?: boolean): Promise<void>;
  download(path: string): Promise<Blob>;
  remove(paths: string[]): Promise<void>;
}

interface JsonRow { [key: string]: unknown }

const ASSET_BUCKET = 'daon-property-assets';
const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

function cleanProjectUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) throw new Error('Supabase project URL이 필요합니다.');
  const url = new URL(trimmed);
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new Error('Supabase project URL은 HTTPS여야 합니다. localhost만 HTTP를 허용합니다.');
  }
  if (url.username || url.password || url.search || url.hash) throw new Error('Supabase project URL에 credential/query/hash를 포함할 수 없습니다.');
  return url.origin;
}

function requireBrowserSafeAnonKey(value: string) {
  const key = value.trim();
  if (!key) throw new Error('Supabase public anon key가 필요합니다.');
  if (/service[_-]?role/i.test(key)) throw new Error('service_role credential은 browser adapter에 사용할 수 없습니다.');
  return key;
}

function encodeEq(value: string) {
  return `eq.${value}`;
}

function asRows(value: unknown): JsonRow[] {
  return Array.isArray(value) ? value.filter((row): row is JsonRow => !!row && typeof row === 'object' && !Array.isArray(row)) : [];
}

function rowPayload<T>(row: JsonRow | undefined): T | undefined {
  return row?.payload as T | undefined;
}

function mapObject(row: JsonRow): RemotePropertyObject {
  return {
    objectType: row.object_type as RemotePropertyObjectType,
    id: String(row.id ?? ''),
    propertyId: String(row.property_id ?? ''),
    payload: (row.payload ?? {}) as Record<string, unknown>,
    createdAt: typeof row.created_at === 'string' ? row.created_at : undefined,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : undefined,
  };
}

function mapAsset(row: JsonRow): RemoteAssetMetadata {
  return {
    resourceType: row.resource_type as RemoteAssetResourceType,
    id: String(row.id ?? ''),
    propertyId: String(row.property_id ?? ''),
    storagePath: String(row.storage_path ?? ''),
    originalFileName: typeof row.original_file_name === 'string' ? row.original_file_name : undefined,
    mimeType: typeof row.mime_type === 'string' ? row.mime_type : undefined,
    fileSize: typeof row.file_size === 'number' ? row.file_size : undefined,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: typeof row.created_at === 'string' ? row.created_at : undefined,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : undefined,
  };
}

class SupabaseRestClient {
  readonly projectUrl: string;
  readonly anonKey: string;
  readonly fetchImpl: typeof fetch;

  constructor(private readonly config: SupabaseRemoteDataGatewayConfig) {
    this.projectUrl = cleanProjectUrl(config.projectUrl);
    this.anonKey = requireBrowserSafeAnonKey(config.anonKey);
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async actorId() {
    const actorId = (await this.config.getActorId())?.trim();
    if (!actorId) throw new Error('인증된 remote actor id가 없습니다.');
    return actorId;
  }

  async authHeaders(extra?: HeadersInit) {
    const token = (await this.config.getAccessToken())?.trim();
    if (!token) throw new Error('REMOTE AUTH access token이 없습니다.');
    return new Headers({ apikey: this.anonKey, Authorization: `Bearer ${token}`, ...extra });
  }

  async requestJson(path: string, init: RequestInit = {}) {
    const headers = await this.authHeaders({ ...JSON_HEADERS, ...(init.headers ?? {}) });
    const response = await this.fetchImpl(`${this.projectUrl}${path}`, { ...init, headers, cache: 'no-store' });
    const text = await response.text();
    let payload: unknown = undefined;
    if (text) {
      try { payload = JSON.parse(text); } catch { payload = text; }
    }
    if (!response.ok) {
      const detail = typeof payload === 'object' && payload && 'message' in payload ? String((payload as { message?: unknown }).message ?? '') : String(payload ?? '');
      throw new Error(`REMOTE DATA 요청 실패 (${response.status})${detail ? `: ${detail}` : ''}`);
    }
    return payload;
  }

  async getRows(table: string, params: URLSearchParams) {
    const payload = await this.requestJson(`/rest/v1/${table}?${params.toString()}`, { method: 'GET' });
    return asRows(payload);
  }

  async patchRows(table: string, params: URLSearchParams, body: JsonRow) {
    const payload = await this.requestJson(`/rest/v1/${table}?${params.toString()}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(body),
    });
    return asRows(payload);
  }

  async insertRows(table: string, body: JsonRow | JsonRow[]) {
    const payload = await this.requestJson(`/rest/v1/${table}`, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(body),
    });
    return asRows(payload);
  }

  async deleteRows(table: string, params: URLSearchParams) {
    await this.requestJson(`/rest/v1/${table}?${params.toString()}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  }
}

export class SupabaseRemoteDataGateway implements RemoteDataGateway {
  private readonly client: SupabaseRestClient;

  constructor(config: SupabaseRemoteDataGatewayConfig) {
    this.client = new SupabaseRestClient(config);
  }

  async listProperties() {
    const params = new URLSearchParams({ select: 'payload', order: 'updated_at.desc' });
    return (await this.client.getRows('properties', params)).flatMap((row) => rowPayload<Property>(row) ?? []);
  }

  async getProperty(propertyId: string) {
    const params = new URLSearchParams({ select: 'payload', id: encodeEq(propertyId), limit: '1' });
    return rowPayload<Property>((await this.client.getRows('properties', params))[0]);
  }

  async upsertProperty(property: Property) {
    const actorId = await this.client.actorId();
    const params = new URLSearchParams({ id: encodeEq(property.id) });
    const updated = await this.client.patchRows('properties', params, { payload: property, updated_by: actorId });
    if (!updated.length) {
      await this.client.insertRows('properties', { id: property.id, payload: property, created_by: actorId, updated_by: actorId });
    }
    return property;
  }

  async deleteProperty(propertyId: string) {
    await this.client.deleteRows('properties', new URLSearchParams({ id: encodeEq(propertyId) }));
  }

  async listObjects(propertyId: string, objectType?: RemotePropertyObjectType) {
    const params = new URLSearchParams({ select: '*', property_id: encodeEq(propertyId), order: 'updated_at.desc' });
    if (objectType) params.set('object_type', encodeEq(objectType));
    return (await this.client.getRows('property_objects', params)).map(mapObject);
  }

  async upsertObject(object: RemotePropertyObject) {
    const actorId = await this.client.actorId();
    const params = new URLSearchParams({ object_type: encodeEq(object.objectType), id: encodeEq(object.id) });
    const updated = await this.client.patchRows('property_objects', params, { property_id: object.propertyId, payload: object.payload, updated_by: actorId });
    if (!updated.length) {
      await this.client.insertRows('property_objects', {
        object_type: object.objectType,
        id: object.id,
        property_id: object.propertyId,
        payload: object.payload,
        created_by: actorId,
        updated_by: actorId,
      });
    }
    return object;
  }

  async deleteObject(objectType: RemotePropertyObjectType, id: string) {
    await this.client.deleteRows('property_objects', new URLSearchParams({ object_type: encodeEq(objectType), id: encodeEq(id) }));
  }

  async listAssets(propertyId: string, resourceType?: RemoteAssetResourceType) {
    const params = new URLSearchParams({ select: '*', property_id: encodeEq(propertyId), order: 'updated_at.desc' });
    if (resourceType) params.set('resource_type', encodeEq(resourceType));
    return (await this.client.getRows('property_assets', params)).map(mapAsset);
  }

  async upsertAssetMetadata(asset: RemoteAssetMetadata) {
    const actorId = await this.client.actorId();
    const params = new URLSearchParams({ resource_type: encodeEq(asset.resourceType), id: encodeEq(asset.id) });
    const row = {
      property_id: asset.propertyId,
      storage_path: asset.storagePath,
      original_file_name: asset.originalFileName,
      mime_type: asset.mimeType,
      file_size: asset.fileSize,
      metadata: asset.metadata,
      updated_by: actorId,
    };
    const updated = await this.client.patchRows('property_assets', params, row);
    if (!updated.length) {
      await this.client.insertRows('property_assets', { resource_type: asset.resourceType, id: asset.id, ...row, created_by: actorId });
    }
    return asset;
  }

  async deleteAssetMetadata(resourceType: RemoteAssetResourceType, id: string) {
    await this.client.deleteRows('property_assets', new URLSearchParams({ resource_type: encodeEq(resourceType), id: encodeEq(id) }));
  }

  async submitVerificationCandidate(candidate: PropertyVerificationCandidate) {
    const actorId = await this.client.actorId();
    await this.client.insertRows('property_verification_candidates', {
      id: candidate.id,
      property_id: candidate.propertyId,
      field_key: candidate.fieldKey,
      candidate_value: candidate.candidateValue,
      source_type: candidate.sourceType,
      source_name: candidate.sourceName,
      source_reference: candidate.sourceReference,
      note: candidate.note,
      decision_status: 'pending',
      created_by: actorId,
    });
    return candidate;
  }

  async decideVerificationCandidate(candidateId: string, decision: 'approved' | 'held' | 'rejected', note?: string) {
    const actorId = await this.client.actorId();
    const body: JsonRow = { decision_status: decision, decision_note: note ?? '' };
    if (decision === 'approved' || decision === 'rejected') {
      body.decided_by = actorId;
      body.decided_at = new Date().toISOString();
    } else {
      body.decided_by = null;
      body.decided_at = null;
    }
    await this.client.patchRows('property_verification_candidates', new URLSearchParams({ id: encodeEq(candidateId) }), body);
  }

  async appendVerification(verification: PropertyVerification) {
    const actorId = await this.client.actorId();
    await this.client.insertRows('property_verifications', { id: verification.id, property_id: verification.propertyId, payload: verification, created_by: actorId });
    return verification;
  }

  async createReportSnapshot(input: RemoteReportSnapshotInput) {
    const actorId = await this.client.actorId();
    const final = input.status === 'final';
    await this.client.insertRows('report_snapshots', {
      id: input.snapshot.id,
      property_id: input.snapshot.propertyId,
      payload: input.snapshot,
      status: input.status,
      created_by: actorId,
      finalized_by: final ? actorId : null,
      finalized_at: final ? new Date().toISOString() : null,
    });
    return input.snapshot;
  }

  async listReportSnapshots(propertyId: string) {
    const params = new URLSearchParams({ select: 'payload', property_id: encodeEq(propertyId), order: 'created_at.desc' });
    return (await this.client.getRows('report_snapshots', params)).flatMap((row) => rowPayload<ReportSnapshot>(row) ?? []);
  }

  async getCompanySettings() {
    const params = new URLSearchParams({ select: 'payload', id: 'eq.main', limit: '1' });
    return rowPayload<Settings>((await this.client.getRows('company_settings', params))[0]);
  }

  async saveCompanySettings(settings: Settings) {
    const actorId = await this.client.actorId();
    const params = new URLSearchParams({ id: 'eq.main' });
    const updated = await this.client.patchRows('company_settings', params, { payload: settings, updated_by: actorId });
    if (!updated.length) await this.client.insertRows('company_settings', { id: 'main', payload: settings, updated_by: actorId });
    return settings;
  }
}

export class SupabaseRemoteAssetStorageGateway implements RemoteAssetStorageGateway {
  private readonly client: SupabaseRestClient;

  constructor(config: SupabaseRemoteDataGatewayConfig) {
    this.client = new SupabaseRestClient(config);
  }

  async upload(path: string, body: Blob, contentType = body.type || 'application/octet-stream', upsert = false) {
    if (!path || path.startsWith('/') || path.includes('..')) throw new Error('유효하지 않은 Storage path입니다.');
    if (body.size > 50 * 1024 * 1024) throw new Error('Storage upload hard cap 50 MiB를 초과했습니다.');
    const headers = await this.client.authHeaders({ 'Content-Type': contentType, 'x-upsert': String(upsert) });
    const response = await this.client.fetchImpl(`${this.client.projectUrl}/storage/v1/object/${ASSET_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'POST', headers, body, cache: 'no-store',
    });
    if (!response.ok) throw new Error(`REMOTE ASSET upload 실패 (${response.status})`);
  }

  async download(path: string) {
    if (!path || path.startsWith('/') || path.includes('..')) throw new Error('유효하지 않은 Storage path입니다.');
    const headers = await this.client.authHeaders();
    const response = await this.client.fetchImpl(`${this.client.projectUrl}/storage/v1/object/authenticated/${ASSET_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'GET', headers, cache: 'no-store',
    });
    if (!response.ok) throw new Error(`REMOTE ASSET download 실패 (${response.status})`);
    return response.blob();
  }

  async remove(paths: string[]) {
    const clean = paths.filter(Boolean);
    if (!clean.length) return;
    if (clean.some((path) => path.startsWith('/') || path.includes('..'))) throw new Error('유효하지 않은 Storage path가 포함되어 있습니다.');
    await this.client.requestJson(`/storage/v1/object/${ASSET_BUCKET}`, { method: 'DELETE', body: JSON.stringify({ prefixes: clean }) });
  }
}

export function createSupabaseRemoteDataGateway(config: SupabaseRemoteDataGatewayConfig): RemoteDataGateway {
  return new SupabaseRemoteDataGateway(config);
}

export function createSupabaseRemoteAssetStorageGateway(config: SupabaseRemoteDataGatewayConfig): RemoteAssetStorageGateway {
  return new SupabaseRemoteAssetStorageGateway(config);
}
