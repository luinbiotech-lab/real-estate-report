import type {
  FloorPlanRecord,
  MediaAssetRecord,
  MediaSpaceLinkRecord,
  PropertyMediaPolicy,
  SpatialMediaDataRoomBundle,
  SpatialPropertySpace,
  VerificationEventRecord,
  ViewerEdgeRecord,
  ViewerNodeRecord,
  ViewerSceneRecord,
  WalkthroughRouteRecord,
  WalkthroughStepRecord,
} from '../domain/propertyDataRoom/spatialMediaModel';
import { remoteAuthGateway } from '../services/authProviderService';
import { REMOTE_OPERATIONAL_MODE } from '../services/operationalDataMode';
import { DAON_SUPABASE_PROJECT_URL, DAON_SUPABASE_PUBLISHABLE_KEY } from '../services/supabaseProductionConfig';
import { requireBrowserSafeSupabaseKey } from '../services/supabaseBrowserCredential';
import { database } from './database';

type SpatialStoreName =
  | 'propertyMediaPolicies'
  | 'floorPlans'
  | 'propertySpacesSpatial'
  | 'mediaAssets'
  | 'mediaSpaceLinks'
  | 'viewerScenes'
  | 'viewerNodes'
  | 'viewerEdges'
  | 'walkthroughRoutes'
  | 'walkthroughSteps'
  | 'verificationEvents';

type SpatialTableName =
  | 'property_media_policies'
  | 'floor_plans'
  | 'property_spaces_spatial'
  | 'media_assets'
  | 'media_space_links'
  | 'viewer_scenes'
  | 'viewer_nodes'
  | 'viewer_edges'
  | 'walkthrough_routes'
  | 'walkthrough_steps'
  | 'verification_events';

interface SpatialTableConfig {
  table: SpatialTableName;
  store: SpatialStoreName;
  keyColumn: 'id' | 'property_id';
  keyField: 'id' | 'propertyId';
  hasUpdatedBy: boolean;
  appendOnly?: boolean;
}

const TABLES = {
  mediaPolicy: { table: 'property_media_policies', store: 'propertyMediaPolicies', keyColumn: 'property_id', keyField: 'propertyId', hasUpdatedBy: true },
  floorPlan: { table: 'floor_plans', store: 'floorPlans', keyColumn: 'id', keyField: 'id', hasUpdatedBy: true },
  space: { table: 'property_spaces_spatial', store: 'propertySpacesSpatial', keyColumn: 'id', keyField: 'id', hasUpdatedBy: true },
  mediaAsset: { table: 'media_assets', store: 'mediaAssets', keyColumn: 'id', keyField: 'id', hasUpdatedBy: true },
  mediaSpaceLink: { table: 'media_space_links', store: 'mediaSpaceLinks', keyColumn: 'id', keyField: 'id', hasUpdatedBy: true },
  viewerScene: { table: 'viewer_scenes', store: 'viewerScenes', keyColumn: 'id', keyField: 'id', hasUpdatedBy: true },
  viewerNode: { table: 'viewer_nodes', store: 'viewerNodes', keyColumn: 'id', keyField: 'id', hasUpdatedBy: true },
  viewerEdge: { table: 'viewer_edges', store: 'viewerEdges', keyColumn: 'id', keyField: 'id', hasUpdatedBy: false },
  walkthroughRoute: { table: 'walkthrough_routes', store: 'walkthroughRoutes', keyColumn: 'id', keyField: 'id', hasUpdatedBy: true },
  walkthroughStep: { table: 'walkthrough_steps', store: 'walkthroughSteps', keyColumn: 'id', keyField: 'id', hasUpdatedBy: true },
  verificationEvent: { table: 'verification_events', store: 'verificationEvents', keyColumn: 'id', keyField: 'id', hasUpdatedBy: false, appendOnly: true },
} as const satisfies Record<string, SpatialTableConfig>;

type JsonRow = Record<string, unknown>;

function cleanProjectUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) throw new Error('Supabase project URL이 필요합니다.');
  const url = new URL(trimmed);
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('Supabase project URL은 HTTPS여야 합니다.');
  return url.origin;
}

function encodeEq(value: string) {
  return `eq.${value}`;
}

function asRows(value: unknown): JsonRow[] {
  return Array.isArray(value) ? value.filter((row): row is JsonRow => !!row && typeof row === 'object' && !Array.isArray(row)) : [];
}

function toSnake(value: string) {
  if (value === 'geometry2d') return 'geometry_2d';
  if (value === 'estimatedGeometry3d') return 'estimated_geometry_3d';
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Za-z])([0-9]+)/g, '$1_$2')
    .toLowerCase();
}

function toCamel(value: string) {
  if (value === 'geometry_2d') return 'geometry2d';
  if (value === 'estimated_geometry_3d') return 'estimatedGeometry3d';
  return value.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

function rowFromRecord<T extends Record<string, unknown>>(value: T): JsonRow {
  const row: JsonRow = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) continue;
    row[toSnake(key)] = entry;
  }
  return row;
}

function recordFromRow<T>(row: JsonRow): T {
  const value: JsonRow = {};
  for (const [key, entry] of Object.entries(row)) value[toCamel(key)] = entry;
  return value as T;
}

async function remoteHeaders(extra?: HeadersInit) {
  const token = (await remoteAuthGateway.getAccessToken())?.trim();
  if (!token) throw new Error('REMOTE AUTH access token이 없습니다.');
  return new Headers({
    apikey: requireBrowserSafeSupabaseKey(DAON_SUPABASE_PUBLISHABLE_KEY),
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(extra ?? {}),
  });
}

async function remoteRequest(path: string, init: RequestInit = {}) {
  const projectUrl = cleanProjectUrl(DAON_SUPABASE_PROJECT_URL);
  const headers = await remoteHeaders(init.headers);
  const response = await fetch(`${projectUrl}${path}`, { ...init, headers, cache: 'no-store' });
  const text = await response.text();
  let payload: unknown = undefined;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = text; }
  }
  if (!response.ok) {
    const detail = typeof payload === 'object' && payload && 'message' in payload ? String((payload as { message?: unknown }).message ?? '') : String(payload ?? '');
    throw new Error(`SPATIAL REMOTE 요청 실패 (${response.status})${detail ? `: ${detail}` : ''}`);
  }
  return payload;
}

async function remoteGetRows(table: SpatialTableName, params: URLSearchParams) {
  return asRows(await remoteRequest(`/rest/v1/${table}?${params.toString()}`, { method: 'GET' }));
}

async function remotePatchRows(table: SpatialTableName, params: URLSearchParams, body: JsonRow) {
  return asRows(await remoteRequest(`/rest/v1/${table}?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(body),
  }));
}

async function remoteInsertRows(table: SpatialTableName, body: JsonRow | JsonRow[]) {
  return asRows(await remoteRequest(`/rest/v1/${table}`, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(body),
  }));
}

function remoteOrderFor(table: SpatialTableName) {
  if (table === 'viewer_edges' || table === 'walkthrough_steps') return 'sequence_order.asc';
  if (table === 'verification_events') return 'created_at.desc';
  if (table === 'floor_plans') return 'floor_label.asc,updated_at.desc';
  return 'updated_at.desc';
}

async function remoteList<T>(config: SpatialTableConfig, propertyId: string): Promise<T[]> {
  const params = new URLSearchParams({ select: '*', property_id: encodeEq(propertyId), order: remoteOrderFor(config.table) });
  return (await remoteGetRows(config.table, params)).map(recordFromRow<T>).filter((value) => !(value as { deletedAt?: string }).deletedAt);
}

async function remoteUpsert<T extends Record<string, unknown>>(config: SpatialTableConfig, value: T): Promise<T> {
  const actorId = (await remoteAuthGateway.getActorId())?.trim();
  if (!actorId) throw new Error('인증된 remote actor id가 없습니다.');
  const row = rowFromRecord(value);
  const keyValue = String(value[config.keyField] ?? '');
  if (!keyValue) throw new Error(`${config.table}: key 값이 없습니다.`);

  if (config.appendOnly) {
    await remoteInsertRows(config.table, { ...row, created_by: actorId });
    return value;
  }

  const updated = await remotePatchRows(config.table, new URLSearchParams({ [config.keyColumn]: encodeEq(keyValue) }), {
    ...row,
    ...(config.hasUpdatedBy ? { updated_by: actorId } : {}),
  });
  if (!updated.length) {
    await remoteInsertRows(config.table, {
      ...row,
      created_by: actorId,
      ...(config.hasUpdatedBy ? { updated_by: actorId } : {}),
    });
  }
  return value;
}

async function remoteGetMediaPolicy(propertyId: string): Promise<PropertyMediaPolicy | undefined> {
  const rows = await remoteGetRows('property_media_policies', new URLSearchParams({ select: '*', property_id: encodeEq(propertyId), limit: '1' }));
  return rows[0] ? recordFromRow<PropertyMediaPolicy>(rows[0]) : undefined;
}

async function localByProperty<T>(storeName: SpatialStoreName, propertyId: string): Promise<T[]> {
  if (storeName === 'propertyMediaPolicies') {
    const value = await (await database).get(storeName, propertyId) as T | undefined;
    return value ? [value] : [];
  }
  const values = await (await database).getAllFromIndex(storeName, 'propertyId', propertyId) as T[];
  return values.filter((value) => !(value as { deletedAt?: string }).deletedAt);
}

async function localPut<T extends { id?: string; propertyId: string }>(storeName: SpatialStoreName, value: T): Promise<T> {
  await (await database).put(storeName, value);
  return value;
}

async function localGetMediaPolicy(propertyId: string): Promise<PropertyMediaPolicy | undefined> {
  return (await database).get('propertyMediaPolicies', propertyId) as Promise<PropertyMediaPolicy | undefined>;
}

async function list<T>(config: SpatialTableConfig, propertyId: string): Promise<T[]> {
  if (REMOTE_OPERATIONAL_MODE) return remoteList<T>(config, propertyId);
  return localByProperty<T>(config.store, propertyId);
}

async function upsert<T extends { id?: string; propertyId: string } & Record<string, unknown>>(config: SpatialTableConfig, value: T): Promise<T> {
  if (REMOTE_OPERATIONAL_MODE) return remoteUpsert(config, value);
  return localPut(config.store, value);
}

export const spatialMediaRepository = {
  async getMediaPolicy(propertyId: string) {
    return REMOTE_OPERATIONAL_MODE ? remoteGetMediaPolicy(propertyId) : localGetMediaPolicy(propertyId);
  },

  saveMediaPolicy(value: PropertyMediaPolicy) {
    return upsert(TABLES.mediaPolicy, value as PropertyMediaPolicy & Record<string, unknown>);
  },

  getFloorPlans: (propertyId: string) => list<FloorPlanRecord>(TABLES.floorPlan, propertyId),
  saveFloorPlan: (value: FloorPlanRecord) => upsert(TABLES.floorPlan, value as FloorPlanRecord & Record<string, unknown>),

  getSpaces: (propertyId: string) => list<SpatialPropertySpace>(TABLES.space, propertyId),
  saveSpace: (value: SpatialPropertySpace) => upsert(TABLES.space, value as SpatialPropertySpace & Record<string, unknown>),

  getMediaAssets: (propertyId: string) => list<MediaAssetRecord>(TABLES.mediaAsset, propertyId),
  saveMediaAsset: (value: MediaAssetRecord) => upsert(TABLES.mediaAsset, value as MediaAssetRecord & Record<string, unknown>),

  getMediaSpaceLinks: (propertyId: string) => list<MediaSpaceLinkRecord>(TABLES.mediaSpaceLink, propertyId),
  saveMediaSpaceLink: (value: MediaSpaceLinkRecord) => upsert(TABLES.mediaSpaceLink, value as MediaSpaceLinkRecord & Record<string, unknown>),

  getViewerScenes: (propertyId: string) => list<ViewerSceneRecord>(TABLES.viewerScene, propertyId),
  saveViewerScene: (value: ViewerSceneRecord) => upsert(TABLES.viewerScene, value as ViewerSceneRecord & Record<string, unknown>),

  getViewerNodes: (propertyId: string) => list<ViewerNodeRecord>(TABLES.viewerNode, propertyId),
  saveViewerNode: (value: ViewerNodeRecord) => upsert(TABLES.viewerNode, value as ViewerNodeRecord & Record<string, unknown>),

  getViewerEdges: (propertyId: string) => list<ViewerEdgeRecord & { propertyId: string }>(TABLES.viewerEdge, propertyId),
  saveViewerEdge: (value: ViewerEdgeRecord & { propertyId: string }) => upsert(TABLES.viewerEdge, value as ViewerEdgeRecord & { propertyId: string } & Record<string, unknown>),

  getWalkthroughRoutes: (propertyId: string) => list<WalkthroughRouteRecord>(TABLES.walkthroughRoute, propertyId),
  saveWalkthroughRoute: (value: WalkthroughRouteRecord) => upsert(TABLES.walkthroughRoute, value as WalkthroughRouteRecord & Record<string, unknown>),

  getWalkthroughSteps: (propertyId: string) => list<WalkthroughStepRecord & { propertyId: string }>(TABLES.walkthroughStep, propertyId),
  saveWalkthroughStep: (value: WalkthroughStepRecord & { propertyId: string }) => upsert(TABLES.walkthroughStep, value as WalkthroughStepRecord & { propertyId: string } & Record<string, unknown>),

  getVerificationEvents: (propertyId: string) => list<VerificationEventRecord>(TABLES.verificationEvent, propertyId),
  appendVerificationEvent: (value: VerificationEventRecord) => upsert(TABLES.verificationEvent, value as VerificationEventRecord & Record<string, unknown>),

  async getBundle(propertyId: string): Promise<SpatialMediaDataRoomBundle> {
    const [
      mediaPolicy,
      floorPlans,
      spaces,
      mediaAssets,
      mediaSpaceLinks,
      viewerScenes,
      viewerNodes,
      viewerEdges,
      walkthroughRoutes,
      walkthroughSteps,
      verificationEvents,
    ] = await Promise.all([
      this.getMediaPolicy(propertyId),
      this.getFloorPlans(propertyId),
      this.getSpaces(propertyId),
      this.getMediaAssets(propertyId),
      this.getMediaSpaceLinks(propertyId),
      this.getViewerScenes(propertyId),
      this.getViewerNodes(propertyId),
      this.getViewerEdges(propertyId),
      this.getWalkthroughRoutes(propertyId),
      this.getWalkthroughSteps(propertyId),
      this.getVerificationEvents(propertyId),
    ]);
    return { mediaPolicy, floorPlans, spaces, mediaAssets, mediaSpaceLinks, viewerScenes, viewerNodes, viewerEdges, walkthroughRoutes, walkthroughSteps, verificationEvents };
  },
};
