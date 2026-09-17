import { remoteAuthGateway } from './authProviderService';
import { DAON_REMOTE_SHARE_FUNCTION, DAON_SUPABASE_PROJECT_URL, DAON_SUPABASE_PUBLISHABLE_KEY } from './supabaseProductionConfig';
import type { BuildingReleaseReviewNote, BuildingReleaseShare } from './buildingReleaseCollaborationService';
import type { BuildingReleaseSnapshot } from './buildingReleaseSnapshotService';

export interface RemoteShareIssueRequest {
  snapshot: BuildingReleaseSnapshot;
  expiresAt?: string;
  allowDownload: boolean;
  recipientNote?: string;
}

/**
 * Returned only at issuance time. The raw token must never be persisted by the
 * remote provider, so this shape must not be reused for audit/list responses.
 */
export interface RemoteShareIssuedSession {
  remoteShareId: string;
  publicUrl: string;
  rawToken: string;
  status: 'active' | 'revoked' | 'expired';
  expiresAt?: string;
  allowDownload: boolean;
  createdAt: string;
}

/** Persistable/auditable metadata. It intentionally contains no raw token. */
export interface RemoteShareRecord {
  remoteShareId: string;
  snapshotId: string;
  propertyId: string;
  status: 'active' | 'revoked' | 'expired';
  expiresAt?: string;
  allowDownload: boolean;
  recipientNote?: string;
  createdAt: string;
  revokedAt?: string;
}

// Compatibility name for issuance consumers only.
export type RemoteShareSession = RemoteShareIssuedSession;

export interface RemoteShareAccessResult {
  status: 'active' | 'revoked' | 'expired' | 'not_found';
  snapshotId?: string;
  propertyId?: string;
  allowDownload?: boolean;
  expiresAt?: string;
  payload?: unknown;
}

export interface RemoteExternalShareGateway {
  issue(request: RemoteShareIssueRequest): Promise<RemoteShareIssuedSession>;
  revoke(remoteShareId: string): Promise<void>;
  resolve(rawToken: string): Promise<RemoteShareAccessResult>;
  listForSnapshot(snapshotId: string): Promise<RemoteShareRecord[]>;
  addReviewNote(rawToken: string, author: string, body: string): Promise<BuildingReleaseReviewNote>;
}


function parseJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

class RemoteShareHttpError extends Error {
  constructor(readonly statusCode: number, readonly payload: Record<string, unknown>) {
    super(`REMOTE / PUBLIC 요청 실패 (${statusCode})${typeof payload.error === 'string' ? `: ${payload.error}` : ''}`);
  }
}

async function callRemoteShare(body: Record<string, unknown>, authenticated: boolean) {
  const headers = new Headers({ 'Content-Type': 'application/json', apikey: DAON_SUPABASE_PUBLISHABLE_KEY });
  if (authenticated) {
    const token = await remoteAuthGateway.getAccessToken();
    if (!token) throw new Error('REMOTE / PUBLIC 관리 작업은 REMOTE AUTH 로그인이 필요합니다.');
    headers.set('Authorization', `Bearer ${token}`);
  }
  const response = await fetch(`${DAON_SUPABASE_PROJECT_URL}/functions/v1/${DAON_REMOTE_SHARE_FUNCTION}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const raw = await response.text();
  let payload: unknown = undefined;
  if (raw) {
    try { payload = JSON.parse(raw); } catch { payload = raw; }
  }
  if (!response.ok) {
    throw new RemoteShareHttpError(response.status, parseJsonObject(payload));
  }
  return payload;
}

class SupabaseRemoteExternalShareGateway implements RemoteExternalShareGateway {
  async issue(request: RemoteShareIssueRequest): Promise<RemoteShareIssuedSession> {
    return parseJsonObject(await callRemoteShare({ action: 'issue', ...request }, true)) as unknown as RemoteShareIssuedSession;
  }

  async revoke(remoteShareId: string): Promise<void> {
    await callRemoteShare({ action: 'revoke', remoteShareId }, true);
  }

  async resolve(rawToken: string): Promise<RemoteShareAccessResult> {
    try {
      return parseJsonObject(await callRemoteShare({ action: 'resolve', rawToken }, false)) as unknown as RemoteShareAccessResult;
    } catch (error) {
      if (error instanceof RemoteShareHttpError) {
        if (error.statusCode === 404) return { status: 'not_found' };
        if (error.statusCode === 410) {
          const status = error.payload.status;
          if (status === 'revoked' || status === 'expired') {
            return {
              status,
              snapshotId: typeof error.payload.snapshotId === 'string' ? error.payload.snapshotId : undefined,
              propertyId: typeof error.payload.propertyId === 'string' ? error.payload.propertyId : undefined,
              expiresAt: typeof error.payload.expiresAt === 'string' ? error.payload.expiresAt : undefined,
            };
          }
        }
      }
      throw error;
    }
  }

  async listForSnapshot(snapshotId: string): Promise<RemoteShareRecord[]> {
    const payload = parseJsonObject(await callRemoteShare({ action: 'list', snapshotId }, true));
    return Array.isArray(payload.shares) ? payload.shares as RemoteShareRecord[] : [];
  }

  async addReviewNote(rawToken: string, author: string, body: string): Promise<BuildingReleaseReviewNote> {
    return parseJsonObject(await callRemoteShare({ action: 'add_review', rawToken, author, body }, false)) as unknown as BuildingReleaseReviewNote;
  }
}

export const remoteExternalShareGateway: RemoteExternalShareGateway = new SupabaseRemoteExternalShareGateway();

