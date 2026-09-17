import { remoteAuthGateway } from './authProviderService';
import { createSupabaseRemoteAssetStorageGateway, createSupabaseRemoteDataGateway } from './supabaseRemoteDataGateway';
import { DAON_SUPABASE_PROJECT_URL, DAON_SUPABASE_PUBLISHABLE_KEY } from './supabaseProductionConfig';
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

const remoteDataConfig = {
  projectUrl: DAON_SUPABASE_PROJECT_URL,
  anonKey: DAON_SUPABASE_PUBLISHABLE_KEY,
  getAccessToken: () => remoteAuthGateway.getAccessToken(),
  getActorId: () => remoteAuthGateway.getActorId(),
};

export const remoteDataGateway: RemoteDataGateway = createSupabaseRemoteDataGateway(remoteDataConfig);
export const remoteAssetStorageGateway = createSupabaseRemoteAssetStorageGateway(remoteDataConfig);
