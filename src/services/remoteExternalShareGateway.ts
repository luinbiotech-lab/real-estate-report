import type { BuildingReleaseReviewNote, BuildingReleaseShare } from './buildingReleaseCollaborationService';
import type { BuildingReleaseSnapshot } from './buildingReleaseSnapshotService';

export interface RemoteShareIssueRequest {
  snapshot: BuildingReleaseSnapshot;
  expiresAt?: string;
  allowDownload: boolean;
  recipientNote?: string;
}

export interface RemoteShareSession {
  remoteShareId: string;
  publicUrl: string;
  rawToken: string;
  status: 'active' | 'revoked' | 'expired';
  expiresAt?: string;
  allowDownload: boolean;
  createdAt: string;
}

export interface RemoteShareAccessResult {
  status: 'active' | 'revoked' | 'expired' | 'not_found';
  snapshotId?: string;
  propertyId?: string;
  allowDownload?: boolean;
  expiresAt?: string;
  payload?: unknown;
}

export interface RemoteExternalShareGateway {
  issue(request: RemoteShareIssueRequest): Promise<RemoteShareSession>;
  revoke(remoteShareId: string): Promise<void>;
  resolve(rawToken: string): Promise<RemoteShareAccessResult>;
  listForSnapshot(snapshotId: string): Promise<RemoteShareSession[]>;
  addReviewNote(rawToken: string, author: string, body: string): Promise<BuildingReleaseReviewNote>;
}

class NotConfiguredRemoteExternalShareGateway implements RemoteExternalShareGateway {
  private unavailable(): never {
    throw new Error('REMOTE / PUBLIC Provider가 아직 연결되지 않았습니다. 부동산 전용 서버 프로젝트가 필요합니다.');
  }

  async issue(_request: RemoteShareIssueRequest): Promise<RemoteShareSession> { return this.unavailable(); }
  async revoke(_remoteShareId: string): Promise<void> { this.unavailable(); }
  async resolve(_rawToken: string): Promise<RemoteShareAccessResult> { return this.unavailable(); }
  async listForSnapshot(_snapshotId: string): Promise<RemoteShareSession[]> { return this.unavailable(); }
  async addReviewNote(_rawToken: string, _author: string, _body: string): Promise<BuildingReleaseReviewNote> { return this.unavailable(); }
}

export const remoteExternalShareGateway: RemoteExternalShareGateway = new NotConfiguredRemoteExternalShareGateway();

export function localShareToRemoteCandidate(share: BuildingReleaseShare) {
  return {
    snapshotId: share.snapshotId,
    propertyId: share.propertyId,
    expiresAt: share.expiresAt,
    allowDownload: share.allowDownload,
    recipientNote: share.note,
  };
}
