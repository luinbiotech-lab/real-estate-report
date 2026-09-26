import { database } from '../repositories/database';
import { REMOTE_OPERATIONAL_MODE } from './operationalDataMode';
import { remoteDataGateway } from './remoteDataGateway';
import type { BuildingReleaseSnapshot } from './buildingReleaseSnapshotService';

export type ReleaseLifecycleStatus = 'current' | 'superseded' | 'archived';
export interface BuildingReleaseSnapshotState {
  id: string;
  propertyId: string;
  snapshotId: string;
  status: ReleaseLifecycleStatus;
  changedAt: string;
  changedBy?: string;
  reason?: string;
}
export interface BuildingReleaseShare {
  id: string;
  propertyId: string;
  snapshotId: string;
  createdAt: string;
  expiresAt?: string;
  status: 'active' | 'revoked' | 'expired';
  access: 'read_only';
  allowDownload: boolean;
  token: string;
  note?: string;
}
export interface BuildingReleaseReviewNote {
  id: string;
  propertyId: string;
  snapshotId: string;
  createdAt: string;
  author: string;
  body: string;
  status: 'open' | 'resolved';
}

function id(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function token() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function resolveShareStatus(row: BuildingReleaseShare, now = new Date().toISOString()): BuildingReleaseShare {
  return row.status === 'active' && row.expiresAt && row.expiresAt <= now ? { ...row, status: 'expired' as const } : row;
}

export async function getSnapshotStates(propertyId: string): Promise<BuildingReleaseSnapshotState[]> {
  if (REMOTE_OPERATIONAL_MODE) {
    return (await remoteDataGateway.listObjects(propertyId, 'buildingReleaseSnapshotStates')).map((item) => item.payload as unknown as BuildingReleaseSnapshotState);
  }
  return await (await database).getAllFromIndex('buildingReleaseSnapshotStates', 'propertyId', propertyId) as BuildingReleaseSnapshotState[];
}

export async function setSnapshotState(snapshot: BuildingReleaseSnapshot, status: ReleaseLifecycleStatus, reason?: string, changedBy?: string) {
  const row: BuildingReleaseSnapshotState = { id: id('release-state'), propertyId: snapshot.propertyId, snapshotId: snapshot.id, status, changedAt: new Date().toISOString(), reason: reason?.trim() || undefined, changedBy: changedBy?.trim() || undefined };
  if (REMOTE_OPERATIONAL_MODE) {
    await remoteDataGateway.upsertObject({ objectType: 'buildingReleaseSnapshotStates', id: row.id, propertyId: row.propertyId, payload: row as unknown as Record<string, unknown> });
  } else {
    await (await database).add('buildingReleaseSnapshotStates', row);
  }
  return row;
}

export async function resolveSnapshotStatus(snapshotId: string): Promise<ReleaseLifecycleStatus> {
  let rows: BuildingReleaseSnapshotState[] = [];
  if (REMOTE_OPERATIONAL_MODE) {
    for (const property of await remoteDataGateway.listProperties()) {
      rows.push(...(await remoteDataGateway.listObjects(property.id, 'buildingReleaseSnapshotStates')).map((item) => item.payload as unknown as BuildingReleaseSnapshotState).filter((item) => item.snapshotId === snapshotId));
    }
  } else {
    rows = await (await database).getAllFromIndex('buildingReleaseSnapshotStates', 'snapshotId', snapshotId) as BuildingReleaseSnapshotState[];
  }
  return [...rows].sort((a, b) => b.changedAt.localeCompare(a.changedAt))[0]?.status ?? 'current';
}

export async function createShare(snapshot: BuildingReleaseSnapshot, input: { expiresAt?: string; allowDownload: boolean; note?: string }) {
  if (REMOTE_OPERATIONAL_MODE) throw new Error('Production에서는 raw-token legacy share를 생성하지 않습니다. 외부 공유 센터의 REMOTE/PUBLIC 발급 경로를 사용하세요.');
  const now = new Date().toISOString();
  if (input.expiresAt && input.expiresAt <= now) throw new Error('공유 만료일은 현재 시각 이후여야 합니다.');
  const row: BuildingReleaseShare = { id: id('release-share'), propertyId: snapshot.propertyId, snapshotId: snapshot.id, createdAt: now, expiresAt: input.expiresAt, status: 'active', access: 'read_only', allowDownload: input.allowDownload, token: token(), note: input.note?.trim() || undefined };
  await (await database).add('buildingReleaseShares', row);
  return row;
}

export async function listShares(snapshotId: string): Promise<BuildingReleaseShare[]> {
  if (REMOTE_OPERATIONAL_MODE) return [];
  const rows = await (await database).getAllFromIndex('buildingReleaseShares', 'snapshotId', snapshotId) as BuildingReleaseShare[];
  const now = new Date().toISOString();
  return rows.map((row) => resolveShareStatus(row, now)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listAllShares(): Promise<BuildingReleaseShare[]> {
  if (REMOTE_OPERATIONAL_MODE) return [];
  const rows = await (await database).getAll('buildingReleaseShares') as BuildingReleaseShare[];
  const now = new Date().toISOString();
  return rows.map((row) => resolveShareStatus(row, now)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function revokeShare(share: BuildingReleaseShare) {
  if (REMOTE_OPERATIONAL_MODE) throw new Error('Production legacy share revoke는 사용하지 않습니다. 외부 공유 센터의 REMOTE revoke를 사용하세요.');
  const updated: BuildingReleaseShare = { ...share, status: 'revoked' };
  await (await database).put('buildingReleaseShares', updated);
  return updated;
}

export async function addReviewNote(snapshot: BuildingReleaseSnapshot, author: string, body: string) {
  if (!author.trim() || !body.trim()) throw new Error('검토자와 코멘트를 입력하세요.');
  const row: BuildingReleaseReviewNote = { id: id('release-note'), propertyId: snapshot.propertyId, snapshotId: snapshot.id, createdAt: new Date().toISOString(), author: author.trim(), body: body.trim(), status: 'open' };
  if (REMOTE_OPERATIONAL_MODE) {
    await remoteDataGateway.upsertObject({ objectType: 'buildingReleaseReviewNotes', id: row.id, propertyId: row.propertyId, payload: row as unknown as Record<string, unknown> });
  } else {
    await (await database).add('buildingReleaseReviewNotes', row);
  }
  return row;
}

export async function listReviewNotes(snapshotId: string): Promise<BuildingReleaseReviewNote[]> {
  let rows: BuildingReleaseReviewNote[] = [];
  if (REMOTE_OPERATIONAL_MODE) {
    for (const property of await remoteDataGateway.listProperties()) {
      rows.push(...(await remoteDataGateway.listObjects(property.id, 'buildingReleaseReviewNotes')).map((item) => item.payload as unknown as BuildingReleaseReviewNote).filter((item) => item.snapshotId === snapshotId));
    }
  } else {
    rows = await (await database).getAllFromIndex('buildingReleaseReviewNotes', 'snapshotId', snapshotId) as BuildingReleaseReviewNote[];
  }
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listAllReviewNotes(): Promise<BuildingReleaseReviewNote[]> {
  if (REMOTE_OPERATIONAL_MODE) {
    const rows: BuildingReleaseReviewNote[] = [];
    for (const property of await remoteDataGateway.listProperties()) {
      rows.push(...(await remoteDataGateway.listObjects(property.id, 'buildingReleaseReviewNotes')).map((item) => item.payload as unknown as BuildingReleaseReviewNote));
    }
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const rows = await (await database).getAll('buildingReleaseReviewNotes') as BuildingReleaseReviewNote[];
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function resolveReviewNote(note: BuildingReleaseReviewNote) {
  const updated: BuildingReleaseReviewNote = { ...note, status: 'resolved' };
  if (REMOTE_OPERATIONAL_MODE) {
    await remoteDataGateway.upsertObject({ objectType: 'buildingReleaseReviewNotes', id: updated.id, propertyId: updated.propertyId, payload: updated as unknown as Record<string, unknown> });
  } else {
    await (await database).put('buildingReleaseReviewNotes', updated);
  }
  return updated;
}

export function buildShareManifest(snapshot: BuildingReleaseSnapshot, share: BuildingReleaseShare) {
  return {
    schemaVersion: 'daon-release-share-manifest-v1',
    snapshotId: snapshot.id,
    propertyId: snapshot.propertyId,
    checksumHex: snapshot.checksumHex,
    token: share.token,
    access: share.access,
    allowDownload: share.allowDownload,
    expiresAt: share.expiresAt,
    status: share.status,
    note: share.note,
    hostingRequired: true,
    statement: '이 manifest는 외부 공유 서버/URL 발급을 위한 foundation이며 현재 브라우저 단독으로 공개 URL을 생성하지 않습니다.',
  };
}

export const buildingReleaseCollaborationService = { getSnapshotStates, setSnapshotState, resolveSnapshotStatus, createShare, listShares, listAllShares, revokeShare, addReviewNote, listReviewNotes, listAllReviewNotes, resolveReviewNote, buildShareManifest };
