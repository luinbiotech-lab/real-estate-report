export type SpatialVerificationStatus =
  | 'unknown'
  | 'estimated'
  | 'ai_estimated'
  | 'source_provided'
  | 'document_verified'
  | 'field_checked'
  | 'owner_confirmed'
  | 'agent_verified'
  | 'conflict'
  | 'rejected';

export type SpatialVerificationLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type FloorPlanFileType = 'pdf' | 'image' | 'dwg' | 'dxf' | 'scan' | 'unknown';
export type FloorPlanScaleStatus = 'unknown' | 'unscaled' | 'estimated' | 'verified';
export type FloorPlanExtractionStatus =
  | 'not_started'
  | 'uploaded'
  | 'image_converted'
  | 'space_candidate_detected'
  | 'manual_mapping_required'
  | 'mapped'
  | 'verified'
  | 'rejected';

export type SpatialSpaceType =
  | 'retail'
  | 'office'
  | 'residential'
  | 'storage'
  | 'parking'
  | 'common_area'
  | 'stair'
  | 'elevator'
  | 'mechanical'
  | 'roof'
  | 'exterior'
  | 'roadside'
  | 'unknown';

export type SpatialSourceType = 'manual' | 'floor_plan' | 'document' | 'field' | 'agent' | 'ai';

export type MediaAssetType =
  | 'photo'
  | 'video'
  | 'floorplan_image'
  | 'roadview_capture'
  | 'map_capture'
  | 'drone_image'
  | 'document_scan'
  | '360_image'
  | '360_video';

export type MediaSourceOrigin =
  | 'owner_provided'
  | 'agent_uploaded'
  | 'field_captured'
  | 'public_source'
  | 'roadview'
  | 'map_provider'
  | 'ai_generated'
  | 'sample'
  | 'unknown';

export type MediaVisibilityScope = 'private' | 'data_room' | 'report' | 'public_share';
export type MediaProcessingStatus =
  | 'uploaded'
  | 'virus_checked'
  | 'metadata_extracted'
  | 'thumbnail_generated'
  | 'awaiting_space_match'
  | 'matched'
  | 'processing_failed'
  | 'archived'
  | 'deleted';

export type MediaSpaceMatchType =
  | 'manual'
  | 'filename_rule'
  | 'gps_exif'
  | 'timestamp_session'
  | 'ai_visual_match'
  | 'roadview_position'
  | 'unknown';

export type MediaSpaceMatchStatus = 'unmatched' | 'suggested' | 'matched' | 'needs_review' | 'verified' | 'rejected';

export type ViewerSceneType = 'floor_stack' | 'space_model' | 'photo_walkthrough' | 'roadview_context' | 'digital_twin';
export type ViewerModelSourceType = 'metadata' | 'floor_plan' | 'media' | 'glb' | 'gltf' | 'external' | 'none';
export type ViewerGenerationStatus = 'draft' | 'queued' | 'generating' | 'ready' | 'failed' | 'archived';
export type ViewerNodeType = 'space' | 'photo' | 'video' | 'transition' | 'roadview' | 'annotation';
export type ViewerEdgeType = 'walk' | 'jump' | 'stairs' | 'elevator' | 'context';

export type WalkthroughRouteType = 'default' | 'exterior' | 'floor' | 'investment' | 'due_diligence' | 'custom';
export type WalkthroughTransitionType = 'cut' | 'fade' | 'pan' | 'walk' | 'jump';

export type VerificationTargetType =
  | 'property'
  | 'floor'
  | 'space'
  | 'media'
  | 'floor_plan'
  | 'report_section'
  | 'viewer_scene'
  | 'walkthrough_step'
  | 'public_record'
  | 'comparable_transaction';

export type VerificationMethod =
  | 'manual'
  | 'official_document'
  | 'field_visit'
  | 'owner_confirmation'
  | 'agent_review'
  | 'ai_review'
  | 'system';

export interface PropertyMediaPolicy {
  propertyId: string;
  allowInteriorPhotos: boolean;
  allowExteriorPhotos: boolean;
  allowRoadview: boolean;
  allowPublicMap: boolean;
  allowAiVisualization: boolean;
  restrictionNote?: string;
}

export interface FloorPlanRecord {
  id: string;
  propertyId: string;
  floorId?: string;
  floorLabel?: string;
  sourceFileId?: string;
  storagePath?: string;
  fileType: FloorPlanFileType;
  originalFilename: string;
  pageNumber?: number;
  imageUrl?: string;
  widthPx?: number;
  heightPx?: number;
  scaleStatus: FloorPlanScaleStatus;
  scaleValue?: number;
  scaleUnit?: string;
  orientation?: string;
  extractionStatus: FloorPlanExtractionStatus;
  verificationStatus: SpatialVerificationStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface SpatialPropertySpace {
  id: string;
  propertyId: string;
  floorId?: string;
  parentSpaceId?: string;
  spaceCode?: string;
  spaceName: string;
  spaceType: SpatialSpaceType;
  areaM2?: number;
  areaPy?: number;
  ceilingHeightM?: number;
  geometry2d: Record<string, unknown>;
  estimatedGeometry3d: Record<string, unknown>;
  confidenceScore?: number;
  sourceType: SpatialSourceType;
  verificationStatus: SpatialVerificationStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface MediaAssetRecord {
  id: string;
  propertyId: string;
  uploadedBy?: string;
  sourceFileId?: string;
  mediaType: MediaAssetType;
  mimeType?: string;
  originalFilename: string;
  storagePath: string;
  thumbnailPath?: string;
  durationSec?: number;
  widthPx?: number;
  heightPx?: number;
  fileSizeBytes?: number;
  capturedAt?: string;
  uploadedAt: string;
  sourceOrigin: MediaSourceOrigin;
  visibilityScope: MediaVisibilityScope;
  processingStatus: MediaProcessingStatus;
  verificationStatus: SpatialVerificationStatus;
  aiAnalysisStatus: 'not_started' | 'queued' | 'running' | 'review_required' | 'completed' | 'failed';
  caption?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface CameraPose {
  x?: number;
  y?: number;
  z?: number;
  yaw?: number;
  pitch?: number;
  roll?: number;
  directionLabel?: 'front' | 'left' | 'right' | 'rear' | 'up' | 'down' | 'entrance_to_inside' | 'inside_to_exit' | 'road_to_building';
}

export interface MediaSpaceLinkRecord {
  id: string;
  mediaAssetId: string;
  propertyId: string;
  floorId?: string;
  spaceId?: string;
  matchType: MediaSpaceMatchType;
  matchStatus: MediaSpaceMatchStatus;
  matchConfidence?: number;
  matchSource?: string;
  cameraPosition: CameraPose;
  cameraDirection: CameraPose;
  displayPriority: number;
  isRepresentative: boolean;
  verificationStatus: SpatialVerificationStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface ViewerSceneRecord {
  id: string;
  propertyId: string;
  sceneType: ViewerSceneType;
  title: string;
  description?: string;
  modelSourceType: ViewerModelSourceType;
  modelUrl?: string;
  floorPlanId?: string;
  generationStatus: ViewerGenerationStatus;
  verificationStatus: SpatialVerificationStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface ViewerNodeRecord {
  id: string;
  sceneId: string;
  propertyId: string;
  floorId?: string;
  spaceId?: string;
  nodeType: ViewerNodeType;
  label: string;
  positionX?: number;
  positionY?: number;
  positionZ?: number;
  rotationYaw?: number;
  linkedMediaAssetId?: string;
  linkedViewerNodeId?: string;
  verificationStatus: SpatialVerificationStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface ViewerEdgeRecord {
  id: string;
  sceneId: string;
  fromNodeId: string;
  toNodeId: string;
  edgeType: ViewerEdgeType;
  sequenceOrder: number;
  createdAt: string;
}

export interface WalkthroughRouteRecord {
  id: string;
  propertyId: string;
  title: string;
  description?: string;
  routeType: WalkthroughRouteType;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface WalkthroughStepRecord {
  id: string;
  routeId: string;
  sequenceOrder: number;
  spaceId?: string;
  mediaAssetId?: string;
  viewerNodeId?: string;
  title: string;
  description?: string;
  transitionType: WalkthroughTransitionType;
  verificationStatus: SpatialVerificationStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface VerificationEventRecord {
  id: string;
  propertyId: string;
  targetType: VerificationTargetType;
  targetId: string;
  previousStatus?: SpatialVerificationStatus;
  newStatus: SpatialVerificationStatus;
  verificationLevel: SpatialVerificationLevel;
  evidenceSourceId?: string;
  verifiedBy?: string;
  verificationMethod: VerificationMethod;
  confidenceScore?: number;
  note?: string;
  createdAt: string;
}

export interface SpatialMediaDataRoomBundle {
  mediaPolicy?: PropertyMediaPolicy;
  floorPlans: FloorPlanRecord[];
  spaces: SpatialPropertySpace[];
  mediaAssets: MediaAssetRecord[];
  mediaSpaceLinks: MediaSpaceLinkRecord[];
  viewerScenes: ViewerSceneRecord[];
  viewerNodes: ViewerNodeRecord[];
  viewerEdges: ViewerEdgeRecord[];
  walkthroughRoutes: WalkthroughRouteRecord[];
  walkthroughSteps: WalkthroughStepRecord[];
  verificationEvents: VerificationEventRecord[];
}

export const SPATIAL_VERIFICATION_LEVEL_BY_STATUS: Record<SpatialVerificationStatus, SpatialVerificationLevel> = {
  unknown: 0,
  estimated: 1,
  ai_estimated: 1,
  source_provided: 2,
  document_verified: 3,
  field_checked: 4,
  owner_confirmed: 5,
  agent_verified: 5,
  conflict: 0,
  rejected: 0,
};

export const SPATIAL_VERIFICATION_LABELS: Record<SpatialVerificationStatus, string> = {
  unknown: '미확인',
  estimated: '추정',
  ai_estimated: 'AI 추정',
  source_provided: '제공자료 기준',
  document_verified: '공적자료 확인',
  field_checked: '현장확인',
  owner_confirmed: '소유자 확인',
  agent_verified: '담당자 검증',
  conflict: '출처 불일치',
  rejected: '제외',
};

export const FLOOR_PLAN_EXTRACTION_LABELS: Record<FloorPlanExtractionStatus, string> = {
  not_started: '미시작',
  uploaded: '도면 업로드',
  image_converted: '이미지 변환 완료',
  space_candidate_detected: '공간 후보 추출',
  manual_mapping_required: '수동 매핑 필요',
  mapped: '공간 매핑 완료',
  verified: '검증 완료',
  rejected: '제외',
};

export const MEDIA_PROCESSING_LABELS: Record<MediaProcessingStatus, string> = {
  uploaded: '업로드 완료',
  virus_checked: '보안 검사 완료',
  metadata_extracted: '메타데이터 추출',
  thumbnail_generated: '썸네일 생성',
  awaiting_space_match: '공간 매칭 대기',
  matched: '공간 매칭 완료',
  processing_failed: '처리 실패',
  archived: '보관',
  deleted: '삭제',
};

export const MEDIA_SPACE_MATCH_LABELS: Record<MediaSpaceMatchStatus, string> = {
  unmatched: '미매칭',
  suggested: '후보 제안',
  matched: '매칭 완료',
  needs_review: '검토 필요',
  verified: '검증 완료',
  rejected: '매칭 제외',
};

export const DEFAULT_MEDIA_POLICY: PropertyMediaPolicy = {
  propertyId: '',
  allowInteriorPhotos: true,
  allowExteriorPhotos: true,
  allowRoadview: true,
  allowPublicMap: true,
  allowAiVisualization: false,
};

export const BANGBAE_815_11_MEDIA_POLICY: Omit<PropertyMediaPolicy, 'propertyId'> = {
  allowInteriorPhotos: false,
  allowExteriorPhotos: true,
  allowRoadview: true,
  allowPublicMap: true,
  allowAiVisualization: true,
  restrictionNote: '매도인 요청으로 내부 사진은 사용하지 않으며, 외관·도로·주변환경·로드뷰·지도 중심으로 구성한다.',
};

export const SPATIAL_WORKFLOW_STEPS = [
  'property_registered',
  'floor_plan_uploaded',
  'space_structure_mapped',
  'media_uploaded',
  'media_space_matched',
  'verification_event_recorded',
  'viewer_scene_ready',
  'walkthrough_ready',
  'report_view_model_ready',
] as const;

export type SpatialWorkflowStep = (typeof SPATIAL_WORKFLOW_STEPS)[number];

export function getSpatialVerificationLevel(status: SpatialVerificationStatus): SpatialVerificationLevel {
  return SPATIAL_VERIFICATION_LEVEL_BY_STATUS[status];
}

export function isReportSafeMedia(asset: Pick<MediaAssetRecord, 'sourceOrigin' | 'verificationStatus' | 'visibilityScope'>): boolean {
  if (asset.sourceOrigin === 'ai_generated') return false;
  if (asset.verificationStatus === 'conflict' || asset.verificationStatus === 'rejected') return false;
  return asset.visibilityScope === 'report' || asset.visibilityScope === 'public_share';
}

export function isInteriorMediaAllowed(policy: Pick<PropertyMediaPolicy, 'allowInteriorPhotos'> | undefined): boolean {
  return policy?.allowInteriorPhotos ?? true;
}
