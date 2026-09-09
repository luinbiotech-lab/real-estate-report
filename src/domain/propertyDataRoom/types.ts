export type VerificationStatus = 'verified' | 'confirmed' | 'imported' | 'calculated' | 'estimated' | 'ai_analysis' | 'unverified' | 'missing';
export type DocumentType = 'building_register' | 'land_register' | 'land_use_plan' | 'registry' | 'cadastral_map' | 'lease_status' | 'floor_plan' | 'appraisal' | 'contract' | 'financial' | 'development' | 'due_diligence' | 'other';
export type MediaCategory = 'exterior' | 'interior' | 'road' | 'entrance' | 'parking' | 'roof' | 'mechanical' | 'surroundings' | 'floor_plan' | 'aerial' | '360' | 'other';
export type DataSourceType = 'manual' | 'excel_import' | 'public_api' | 'official_document' | 'map_provider' | 'market_data' | 'calculated' | 'ai' | 'external';

export interface PropertyDocument {
  id: string; propertyId: string; documentType: DocumentType; title: string; originalFileName: string;
  storagePath: string; fileUrl?: string; fileData?: Blob; mimeType: string; fileSize: number;
  sourceType: DataSourceType; sourceName: string; issuedAt?: string; uploadedAt: string;
  verificationStatus: VerificationStatus; verifiedAt?: string; version: number; notes: string;
  createdAt: string; updatedAt: string; deletedAt?: string;
}

export interface PropertyMedia {
  id: string; propertyId: string; mediaType: 'image' | 'video' | 'document'; category: MediaCategory;
  storagePath: string; url?: string; fileData?: Blob; fileName: string; mimeType?: string; fileSize?: number;
  captureDate?: string; latitude?: number; longitude?: number; direction?: string; floor?: string; room?: string;
  caption: string; aiTags: string[]; verificationStatus: VerificationStatus; sortOrder: number; isPrimary: boolean;
  createdAt: string; updatedAt: string; deletedAt?: string;
}

export interface PropertyVerification {
  id: string; propertyId: string; fieldKey: string; status: VerificationStatus; note: string;
  verifiedBy?: string; verifiedAt?: string; createdAt: string; updatedAt: string;
}

export interface PropertyDataSource {
  id: string; propertyId: string; fieldKey?: string; resourceType?: string; sourceType: DataSourceType;
  sourceName: string; sourceReference?: string; collectedAt: string; sourceDate?: string; confidence?: number;
  verificationStatus: VerificationStatus; metadata: Record<string, unknown>; createdAt: string;
}

export type ReportType = 'proposal' | 'investment_report' | 'briefing' | 'professional_report';
export interface ReportSnapshot {
  id: string; propertyId: string; reportType: ReportType; reportVersion: number;
  /** Added non-destructively. Legacy snapshots may not have this field. */
  templateId?: string;
  templateVersion: string;
  engineVersion?: string;
  snapshotData: Record<string, unknown>; generatedAt: string; generatedBy?: string;
  status: 'draft' | 'ready' | 'archived' | 'failed'; createdAt: string;
}

export type DigitalTwinAssetType = 'floor_plan' | 'dwg' | 'dxf' | 'scanned_plan' | '360_photo' | 'lidar' | 'point_cloud' | 'mesh' | 'glb' | 'gltf' | 'room_model' | 'measurement_data';
export interface DigitalTwinAsset {
  id: string; propertyId: string; assetType: DigitalTwinAssetType; fileFormat: string; storagePath: string;
  sourceDocumentId?: string; floor?: string; version: number;
  processingStatus: 'uploaded' | 'pending' | 'processing' | 'ready' | 'failed' | 'unsupported';
  metadata: Record<string, unknown>; createdAt: string; updatedAt: string; deletedAt?: string;
}

export interface DataRoomBundle {
  documents: PropertyDocument[]; media: PropertyMedia[]; verifications: PropertyVerification[];
  dataSources: PropertyDataSource[]; reportSnapshots: ReportSnapshot[]; digitalTwinAssets: DigitalTwinAsset[];
}

export interface DataRoomSummary {
  documents: number; media: number; officiallyVerified: number; unverified: number;
  reports: number; digitalTwin: number; missingDocumentTypes: DocumentType[]; reportReady: boolean;
}
