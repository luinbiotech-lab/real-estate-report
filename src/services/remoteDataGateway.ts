import type { Property, Settings } from '../types';
import type { PropertyVerification, PropertyVerificationCandidate, ReportSnapshot } from '../domain/propertyDataRoom/types';

export type RemotePropertyObjectType =
  | 'propertyDataSources'
  | 'agentJobs'
  | 'agentResults'
  | 'agentReviews'
  | 'propertySpaces'
  | 'spaceMediaLinks'
  | 'spaceRoomLinks'
  | 'propertyFacilities'
  | 'roomEvidencePositions'
  | 'roomConditionHistory'
  | 'renovationAssessments'
  | 'roomRenovationAssessments'
  | 'roomRenovationHistory'
  | 'riskAssessments'
  | 'buildingReleaseSnapshots'
  | 'buildingReleaseSnapshotStates'
  | 'buildingReleaseShares'
  | 'buildingReleaseReviewNotes';

export type RemoteAssetResourceType = 'document' | 'media' | 'digital_twin';

export interface RemotePropertyObject {
  objectType: RemotePropertyObjectType;
  id: string;
  propertyId: string;
  payload: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface RemoteAssetMetadata {
  resourceType: RemoteAssetResourceType;
  id: string;
  propertyId: string;
  storagePath: string;
  originalFileName?: string;
  mimeType?: string;
  fileSize?: number;
  metadata: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface RemoteReportSnapshotInput {
  snapshot: ReportSnapshot;
  status: 'draft' | 'final';
}

export interface RemoteDataGateway {
  listProperties(): Promise<Property[]>;
  getProperty(propertyId: string): Promise<Property | undefined>;
  upsertProperty(property: Property): Promise<Property>;
  deleteProperty(propertyId: string): Promise<void>;

  listObjects(propertyId: string, objectType?: RemotePropertyObjectType): Promise<RemotePropertyObject[]>;
  upsertObject(object: RemotePropertyObject): Promise<RemotePropertyObject>;
  deleteObject(objectType: RemotePropertyObjectType, id: string): Promise<void>;

  listAssets(propertyId: string, resourceType?: RemoteAssetResourceType): Promise<RemoteAssetMetadata[]>;
  upsertAssetMetadata(asset: RemoteAssetMetadata): Promise<RemoteAssetMetadata>;
  deleteAssetMetadata(resourceType: RemoteAssetResourceType, id: string): Promise<void>;

  submitVerificationCandidate(candidate: PropertyVerificationCandidate): Promise<PropertyVerificationCandidate>;
  decideVerificationCandidate(candidateId: string, decision: 'approved' | 'held' | 'rejected', note?: string): Promise<void>;
  appendVerification(verification: PropertyVerification): Promise<PropertyVerification>;

  createReportSnapshot(input: RemoteReportSnapshotInput): Promise<ReportSnapshot>;
  listReportSnapshots(propertyId: string): Promise<ReportSnapshot[]>;

  getCompanySettings(): Promise<Settings | undefined>;
  saveCompanySettings(settings: Settings): Promise<Settings>;
}

class NotConfiguredRemoteDataGateway implements RemoteDataGateway {
  private unavailable(): never {
    throw new Error('REMOTE DATA Provider가 아직 연결되지 않았습니다. 부동산 전용 backend가 필요합니다.');
  }

  async listProperties(): Promise<Property[]> { return this.unavailable(); }
  async getProperty(): Promise<Property | undefined> { return this.unavailable(); }
  async upsertProperty(): Promise<Property> { return this.unavailable(); }
  async deleteProperty(): Promise<void> { this.unavailable(); }
  async listObjects(): Promise<RemotePropertyObject[]> { return this.unavailable(); }
  async upsertObject(): Promise<RemotePropertyObject> { return this.unavailable(); }
  async deleteObject(): Promise<void> { this.unavailable(); }
  async listAssets(): Promise<RemoteAssetMetadata[]> { return this.unavailable(); }
  async upsertAssetMetadata(): Promise<RemoteAssetMetadata> { return this.unavailable(); }
  async deleteAssetMetadata(): Promise<void> { this.unavailable(); }
  async submitVerificationCandidate(): Promise<PropertyVerificationCandidate> { return this.unavailable(); }
  async decideVerificationCandidate(): Promise<void> { this.unavailable(); }
  async appendVerification(): Promise<PropertyVerification> { return this.unavailable(); }
  async createReportSnapshot(): Promise<ReportSnapshot> { return this.unavailable(); }
  async listReportSnapshots(): Promise<ReportSnapshot[]> { return this.unavailable(); }
  async getCompanySettings(): Promise<Settings | undefined> { return this.unavailable(); }
  async saveCompanySettings(): Promise<Settings> { return this.unavailable(); }
}

export const remoteDataGateway: RemoteDataGateway = new NotConfiguredRemoteDataGateway();
