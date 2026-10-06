import type { DigitalTwinAsset, PropertyMedia, VerificationStatus } from '../domain/propertyDataRoom/types';

export type TwinInputFamily = 'drawing' | 'photo' | 'video' | 'scan' | 'field_note';
export type TwinEvidenceMode = 'drawing_only' | 'photo_assisted' | 'video_assisted' | 'scan_verified' | 'manual_field_verified';
export type TwinConfidenceState = 'concept_estimate' | 'assisted_reality' | 'verified_twin';
export type TwinOutputSurface = 'web_3d_viewer' | 'walkthrough' | 'large_screen_projection' | 'vision_pro_xr' | 'handoff_package';
export type TwinReviewState = 'estimated' | 'ai_assisted' | 'human_review_required' | 'human_verified' | 'field_confirmed';

export interface TwinInputCapability {
  family: TwinInputFamily;
  label: string;
  acceptedSources: string[];
  purpose: string;
  requiredReview: TwinReviewState;
}

export interface TwinRealityMode {
  mode: TwinConfidenceState;
  label: string;
  minimumEvidence: TwinInputFamily[];
  usableFor: string[];
  blockedFor: string[];
}

export interface TwinSpatialMatchingStage {
  id: string;
  label: string;
  inputFamilies: TwinInputFamily[];
  output: string;
  reviewState: TwinReviewState;
  provenanceRequired: boolean;
}

export interface TwinViewerCapability {
  surface: TwinOutputSurface;
  label: string;
  purpose: string;
  readinessGate: string[];
  productionReady: boolean;
}

export interface TwinRealityReadiness {
  drawingAssets: number;
  photoMedia: number;
  videoMedia: number;
  scanAssets: number;
  conceptReady: boolean;
  assistedRealityReady: boolean;
  verifiedTwinReady: boolean;
  recommendedMode: TwinConfidenceState;
  missingForNextMode: string[];
}

export const DIGITAL_TWIN_VISION_FOUNDATION_VERSION = 'daon-twin-vision-foundation-v1';

export const TWIN_INPUT_CAPABILITIES: TwinInputCapability[] = [
  {
    family: 'drawing',
    label: '도면 기반 3D 안정화',
    acceptedSources: ['PDF floor plan', 'DWG', 'DXF', 'SVG', 'scanned floor-plan image'],
    purpose: '벽·공간·문·창·층고 후보를 만들고 도면만으로 Concept 3D shell을 생성합니다.',
    requiredReview: 'human_review_required',
  },
  {
    family: 'photo',
    label: '사진 기반 현장 보강',
    acceptedSources: ['interior photo', 'exterior photo', '360 photo', 'room-by-room stills'],
    purpose: '마감재·상태·조명·창호·설비 흔적을 공간 후보와 연결해 현장감을 보강합니다.',
    requiredReview: 'ai_assisted',
  },
  {
    family: 'video',
    label: '영상 기반 Walkthrough 보강',
    acceptedSources: ['walkthrough video', 'room sweep clip', 'corridor movement clip'],
    purpose: '공간 연결관계와 실제 이동 동선을 보강하고 방문 체감 시점을 생성합니다.',
    requiredReview: 'ai_assisted',
  },
  {
    family: 'scan',
    label: '고정밀 Scan / XR 준비',
    acceptedSources: ['LiDAR', 'point cloud', 'mesh', 'GLB/GLTF', 'Matterport-like export'],
    purpose: 'Verified Twin 수준의 치수·깊이·공간 재현도를 확보합니다.',
    requiredReview: 'human_verified',
  },
  {
    family: 'field_note',
    label: '현장확인 메모',
    acceptedSources: ['field note', 'measured height', 'manual room label', 'inspection memo'],
    purpose: '자동 추정과 사진/영상 해석을 현장확인 기록으로 승격합니다.',
    requiredReview: 'field_confirmed',
  },
];

export const TWIN_REALITY_MODES: TwinRealityMode[] = [
  {
    mode: 'concept_estimate',
    label: 'Concept Mode · 도면 기반 추정 3D',
    minimumEvidence: ['drawing'],
    usableFor: ['초기 제안', '공간 구조 이해', '리모델링 방향성 검토', '보고서용 3D 개념도'],
    blockedFor: ['시공 치수 확정', '법정면적 확정', '구조·소방·피난 판단'],
  },
  {
    mode: 'assisted_reality',
    label: 'Assisted Reality Mode · 사진/영상 보강 3D',
    minimumEvidence: ['drawing', 'photo', 'video'],
    usableFor: ['현장상태 체감', '마감·노후도 검토', '공간별 인테리어 제안', '원격 프레젠테이션'],
    blockedFor: ['정밀 시공도면 대체', '감정/법률 확정 판단'],
  },
  {
    mode: 'verified_twin',
    label: 'Verified Twin Mode · 현장확인/스캔 검증 3D',
    minimumEvidence: ['drawing', 'photo', 'video', 'scan'],
    usableFor: ['고신뢰 현장 재현', 'XR/대형 스크린 프레젠테이션', '공사 전후 비교', '운영/관리 Handoff'],
    blockedFor: ['전문가 검토 없는 최종 설계 승인'],
  },
];

export const TWIN_SPATIAL_MATCHING_STAGES: TwinSpatialMatchingStage[] = [
  { id: 'drawing_shell', label: '도면 → 3D shell', inputFamilies: ['drawing'], output: 'rooms, walls, openings, slab/core candidates', reviewState: 'human_review_required', provenanceRequired: true },
  { id: 'photo_room_match', label: '사진 → 공간 매칭', inputFamilies: ['photo'], output: 'room evidence positions, finish/material/state candidates', reviewState: 'ai_assisted', provenanceRequired: true },
  { id: 'video_path_match', label: '영상 → 동선/시점 매칭', inputFamilies: ['video'], output: 'walkthrough path candidates, camera pose sequence candidates', reviewState: 'ai_assisted', provenanceRequired: true },
  { id: 'scan_alignment', label: '스캔 → 도면/3D 정합', inputFamilies: ['scan'], output: 'scale/depth/mesh alignment candidates', reviewState: 'human_verified', provenanceRequired: true },
  { id: 'field_confirmation', label: '현장확인 → verified 승격', inputFamilies: ['field_note'], output: 'field-confirmed geometry/material/status state', reviewState: 'field_confirmed', provenanceRequired: true },
];

export const TWIN_VIEWER_CAPABILITIES: TwinViewerCapability[] = [
  { surface: 'web_3d_viewer', label: 'Web 3D Viewer', purpose: '브라우저에서 방·층·건물 모델을 회전/확대/층별 확인합니다.', readinessGate: ['drawing shell', 'verified scale', 'approved room topology'], productionReady: false },
  { surface: 'walkthrough', label: 'Walkthrough Viewer', purpose: '사진/영상 기반 동선을 따라 실제 방문과 유사한 시점 이동을 제공합니다.', readinessGate: ['room matching', 'video path matching', 'camera path review'], productionReady: false },
  { surface: 'large_screen_projection', label: 'Large Screen Projection', purpose: '고객 프레젠테이션용 대형 화면/스크린 투영 모드를 제공합니다.', readinessGate: ['web viewer', 'presentation camera presets', 'safe labels'], productionReady: false },
  { surface: 'vision_pro_xr', label: 'Vision Pro / XR Ready', purpose: 'Spatial Computing 기기에서 공간을 체험할 수 있도록 GLB/scene package를 준비합니다.', readinessGate: ['verified twin package', 'mesh export', 'XR safety manifest'], productionReady: false },
  { surface: 'handoff_package', label: 'Professional Handoff Package', purpose: '3D, evidence, report, provenance를 하나의 전문가 검토 패키지로 묶습니다.', readinessGate: ['provenance complete', 'review states complete', 'not-for-construction guard'], productionReady: false },
];

function assetFamily(asset: DigitalTwinAsset): TwinInputFamily | undefined {
  const format = asset.fileFormat.toLowerCase();
  if (['pdf', 'dwg', 'dxf', 'svg', 'png', 'jpg', 'jpeg', 'webp'].includes(format) && ['floor_plan', 'dwg', 'dxf', 'scanned_plan'].includes(asset.assetType)) return 'drawing';
  if (['360_photo'].includes(asset.assetType)) return 'photo';
  if (['lidar', 'point_cloud', 'mesh', 'glb', 'gltf', 'room_model'].includes(asset.assetType)) return 'scan';
  return undefined;
}

function mediaFamily(media: PropertyMedia): TwinInputFamily | undefined {
  if (media.mediaType === 'image') return 'photo';
  if (media.mediaType === 'video') return 'video';
  return undefined;
}

export function summarizeTwinRealityReadiness(assets: DigitalTwinAsset[], media: PropertyMedia[]): TwinRealityReadiness {
  const drawingAssets = assets.filter((asset) => assetFamily(asset) === 'drawing').length;
  const scanAssets = assets.filter((asset) => assetFamily(asset) === 'scan').length;
  const photoMedia = media.filter((item) => mediaFamily(item) === 'photo').length + assets.filter((asset) => assetFamily(asset) === 'photo').length;
  const videoMedia = media.filter((item) => mediaFamily(item) === 'video').length;
  const conceptReady = drawingAssets > 0;
  const assistedRealityReady = conceptReady && photoMedia > 0 && videoMedia > 0;
  const verifiedTwinReady = assistedRealityReady && scanAssets > 0;
  const recommendedMode: TwinConfidenceState = verifiedTwinReady ? 'verified_twin' : assistedRealityReady ? 'assisted_reality' : 'concept_estimate';
  const missingForNextMode: string[] = [];
  if (!conceptReady) missingForNextMode.push('도면 기반 원본 PDF/DWG/DXF/SVG 또는 스캔 도면');
  else if (!assistedRealityReady) {
    if (!photoMedia) missingForNextMode.push('공간별 내부/외부 사진 또는 360 사진');
    if (!videoMedia) missingForNextMode.push('방문 동선 walkthrough 영상');
  } else if (!verifiedTwinReady) missingForNextMode.push('LiDAR/point cloud/mesh/GLB 등 고정밀 스캔 자료');
  return { drawingAssets, photoMedia, videoMedia, scanAssets, conceptReady, assistedRealityReady, verifiedTwinReady, recommendedMode, missingForNextMode };
}

export function reviewStateFromVerification(status?: VerificationStatus): TwinReviewState {
  if (status === 'verified') return 'field_confirmed';
  if (status === 'confirmed') return 'human_verified';
  if (status === 'ai_analysis' || status === 'estimated') return 'ai_assisted';
  return 'human_review_required';
}

export const digitalTwinVisionFoundationService = {
  version: DIGITAL_TWIN_VISION_FOUNDATION_VERSION,
  inputCapabilities: TWIN_INPUT_CAPABILITIES,
  realityModes: TWIN_REALITY_MODES,
  spatialMatchingStages: TWIN_SPATIAL_MATCHING_STAGES,
  viewerCapabilities: TWIN_VIEWER_CAPABILITIES,
  summarizeReadiness: summarizeTwinRealityReadiness,
  reviewStateFromVerification,
};
