export type VerificationStatus = 'verified' | 'confirmed' | 'imported' | 'calculated' | 'estimated' | 'ai_analysis' | 'unverified' | 'missing';
export type VerificationDecisionStatus = 'pending' | 'approved' | 'held' | 'rejected';
export type DocumentExtractionStatus = 'not_started' | 'text_extracted' | 'scan_ocr_required' | 'manual_review' | 'failed';
export type DocumentExtractionMethod = 'pdf_text' | 'ocr' | 'manual';
export type DocumentType = 'building_register' | 'land_register' | 'land_use_plan' | 'registry' | 'cadastral_map' | 'lease_status' | 'floor_plan' | 'appraisal' | 'contract' | 'financial' | 'development' | 'due_diligence' | 'other';
export type MediaCategory = 'exterior' | 'interior' | 'lobby' | 'office' | 'corridor' | 'restroom' | 'basement' | 'rooftop' | 'roof' | 'parking' | 'mechanical_room' | 'mechanical' | 'road' | 'entrance' | 'surroundings' | 'floor_plan' | 'facade_detail' | 'aerial' | '360' | 'other';
export type DataSourceType = 'manual' | 'excel_import' | 'public_api' | 'official_document' | 'map_provider' | 'market_data' | 'calculated' | 'ai' | 'external';

export type AgentType = 'intake' | 'document' | 'interior_vision' | 'floor_plan' | 'space' | 'renovation' | 'risk_compliance' | 'report' | 'digital_twin';
export type AgentJobStatus = 'queued' | 'running' | 'review_required' | 'completed' | 'failed' | 'cancelled';
export type AgentTrigger = 'manual' | 'upload' | 'dependency' | 'refresh';
export type AgentReviewDecision = 'pending' | 'approved' | 'held' | 'rejected';

export interface AgentJob {
  id: string; propertyId: string; agentType: AgentType; trigger: AgentTrigger;
  resourceType?: 'document' | 'media' | 'property' | 'digital_twin'; resourceId?: string;
  status: AgentJobStatus; priority: number; attempt: number; maxAttempts: number;
  input: Record<string, unknown>; error?: string;
  createdAt: string; startedAt?: string; completedAt?: string; updatedAt: string;
}

export interface AgentResult {
  id: string; jobId: string; propertyId: string; agentType: AgentType; resultType: string;
  payload: Record<string, unknown>; confidence?: number; requiresReview: boolean;
  createdAt: string;
}

export interface AgentReview {
  id: string; jobId: string; resultId: string; propertyId: string;
  decision: AgentReviewDecision; note: string; reviewedBy?: string; reviewedAt?: string; createdAt: string; updatedAt: string;
}

export interface PropertyDocument {
  id: string; propertyId: string; documentType: DocumentType; title: string; originalFileName: string;
  storagePath: string; fileUrl?: string; fileData?: Blob; mimeType: string; fileSize: number;
  sourceType: DataSourceType; sourceName: string; issuedAt?: string; uploadedAt: string;
  verificationStatus: VerificationStatus; verifiedAt?: string; version: number; notes: string;
  extractionStatus?: DocumentExtractionStatus; extractionMethod?: DocumentExtractionMethod; extractionPageCount?: number;
  extractionUpdatedAt?: string; extractionError?: string;
  createdAt: string; updatedAt: string; deletedAt?: string;
}

export interface PropertyMedia {
  id: string; propertyId: string; mediaType: 'image' | 'video' | 'document'; category: MediaCategory;
  storagePath: string; url?: string; fileData?: Blob; fileName: string; mimeType?: string; fileSize?: number;
  captureDate?: string; latitude?: number; longitude?: number; direction?: string; floor?: string; room?: string;
  caption: string; aiTags: string[]; verificationStatus: VerificationStatus; sortOrder: number; isPrimary: boolean;
  createdAt: string; updatedAt: string; deletedAt?: string;
}

export type SpaceType = 'retail' | 'office' | 'residential' | 'lobby' | 'corridor' | 'restroom' | 'parking' | 'basement' | 'rooftop' | 'mechanical' | 'storage' | 'other';
export interface PropertySpace {
  id: string; propertyId: string; name: string; spaceType: SpaceType; floor?: string; roomCode?: string;
  areaSqm?: number; widthM?: number; depthM?: number; ceilingHeightM?: number;
  currentCondition?: string; recommendedUse?: string;
  sourceType: 'manual' | 'agent'; sourceAgentResultId?: string; verificationStatus: VerificationStatus;
  createdAt: string; updatedAt: string; deletedAt?: string;
}

export interface SpaceMediaLink {
  id: string; propertyId: string; spaceId: string; mediaId: string; confidence?: number;
  sourceAgentResultId?: string; createdAt: string; deletedAt?: string;
}

export type FacilityCategory = 'hvac' | 'electrical' | 'plumbing' | 'fire_safety' | 'elevator' | 'restroom' | 'kitchen' | 'internet' | 'access_control' | 'cctv' | 'signage' | 'soundproofing' | 'other';
export interface PropertyFacility {
  id: string; propertyId: string; category: FacilityCategory; name: string; floor?: string; spaceId?: string;
  condition: 'unknown' | 'good' | 'fair' | 'poor' | 'not_present'; notes: string;
  sourceType: 'manual' | 'agent'; sourceAgentResultId?: string; verificationStatus: VerificationStatus;
  createdAt: string; updatedAt: string; deletedAt?: string;
}

export type RenovationScope = 'retain' | 'partial' | 'full' | 'change_of_use' | 'rebuild_review';
export interface RenovationAssessment {
  id: string; propertyId: string; scope: RenovationScope; title: string; summary: string;
  recommendedItems: string[]; riskItems: string[]; costStatus: 'not_estimated' | 'range_candidate';
  sourceAgentResultId?: string; verificationStatus: VerificationStatus;
  createdAt: string; updatedAt: string; deletedAt?: string;
}

export type RiskCheckStatus = 'clear' | 'review' | 'missing' | 'not_applicable';
export interface RiskCheckItem {
  key: string; label: string; status: RiskCheckStatus; detail: string; sourceReference?: string;
}
export interface PropertyRiskAssessment {
  id: string; propertyId: string; title: string; summary: string; checks: RiskCheckItem[];
  disclaimer: string; sourceAgentResultId?: string; verificationStatus: VerificationStatus;
  createdAt: string; updatedAt: string; deletedAt?: string;
}

export interface PropertyVerification {
  id: string; propertyId: string; fieldKey: string; status: VerificationStatus; note: string;
  verifiedBy?: string; verifiedAt?: string; createdAt: string; updatedAt: string;
}

export interface PropertyVerificationCandidate {
  id: string; propertyId: string; fieldKey: string;
  currentValue: unknown; candidateValue: unknown;
  sourceType: DataSourceType; sourceName: string; sourceReference?: string; sourceDate?: string;
  confidence?: number; decisionStatus: VerificationDecisionStatus; note: string;
  createdAt: string; reviewedAt?: string; reviewedBy?: string;
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
  fileName?: string; mimeType?: string; fileData?: Blob; fileUrl?: string;
  sourceDocumentId?: string; floor?: string; version: number;
  processingStatus: 'uploaded' | 'pending' | 'processing' | 'ready' | 'failed' | 'unsupported';
  metadata: Record<string, unknown>; createdAt: string; updatedAt: string; deletedAt?: string;
}

export interface DataRoomBundle {
  documents: PropertyDocument[]; media: PropertyMedia[]; verifications: PropertyVerification[];
  verificationCandidates: PropertyVerificationCandidate[];
  dataSources: PropertyDataSource[]; reportSnapshots: ReportSnapshot[]; digitalTwinAssets: DigitalTwinAsset[];
  /** Added non-destructively for Agent Foundation. Legacy bundle literals remain valid. */
  agentJobs?: AgentJob[]; agentResults?: AgentResult[]; agentReviews?: AgentReview[];
  /** Spatial/interior model is optional for compatibility with legacy bundle literals. */
  spaces?: PropertySpace[]; spaceMediaLinks?: SpaceMediaLink[]; facilities?: PropertyFacility[]; renovationAssessments?: RenovationAssessment[]; riskAssessments?: PropertyRiskAssessment[];
}

export interface DataRoomSummary {
  documents: number; media: number; officiallyVerified: number; unverified: number; verificationPending: number;
  reports: number; digitalTwin: number; agentQueued: number; agentReviewRequired: number;
  missingDocumentTypes: DocumentType[]; reportReady: boolean;
}
