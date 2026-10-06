import { readFileSync } from 'node:fs';

const service = readFileSync('src/services/digitalTwinVisionFoundationService.ts', 'utf8');
const panel = readFileSync('src/components/DigitalTwinVisionFoundationPanel.tsx', 'utf8');

for (const token of [
  'DIGITAL_TWIN_VISION_FOUNDATION_VERSION',
  "'daon-twin-vision-foundation-v1'",
  "TwinInputFamily = 'drawing' | 'photo' | 'video' | 'scan' | 'field_note'",
  "TwinEvidenceMode = 'drawing_only' | 'photo_assisted' | 'video_assisted' | 'scan_verified' | 'manual_field_verified'",
  "TwinConfidenceState = 'concept_estimate' | 'assisted_reality' | 'verified_twin'",
  "TwinOutputSurface = 'web_3d_viewer' | 'walkthrough' | 'large_screen_projection' | 'vision_pro_xr' | 'handoff_package'",
  "TwinReviewState = 'estimated' | 'ai_assisted' | 'human_review_required' | 'human_verified' | 'field_confirmed'",
  'summarizeTwinRealityReadiness',
]) if (!service.includes(token)) throw new Error(`Digital Twin vision foundation service contract missing: ${token}`);

for (const capability of [
  '도면 기반 3D 안정화',
  '사진 기반 현장 보강',
  '영상 기반 Walkthrough 보강',
  '고정밀 Scan / XR 준비',
  '현장확인 메모',
]) if (!service.includes(capability)) throw new Error(`Input capability missing: ${capability}`);

for (const mode of [
  'Concept Mode · 도면 기반 추정 3D',
  'Assisted Reality Mode · 사진/영상 보강 3D',
  'Verified Twin Mode · 현장확인/스캔 검증 3D',
]) if (!service.includes(mode)) throw new Error(`Reality mode missing: ${mode}`);

for (const stage of [
  '도면 → 3D shell',
  '사진 → 공간 매칭',
  '영상 → 동선/시점 매칭',
  '스캔 → 도면/3D 정합',
  '현장확인 → verified 승격',
]) if (!service.includes(stage)) throw new Error(`Spatial matching stage missing: ${stage}`);

for (const viewer of [
  'Web 3D Viewer',
  'Walkthrough Viewer',
  'Large Screen Projection',
  'Vision Pro / XR Ready',
  'Professional Handoff Package',
]) if (!service.includes(viewer)) throw new Error(`Viewer/XR capability missing: ${viewer}`);

if (!service.includes('drawingAssets > 0') || !service.includes('photoMedia > 0 && videoMedia > 0') || !service.includes('scanAssets > 0')) throw new Error('Reality readiness gate must distinguish drawing, photo/video and scan evidence.');
if (!service.includes("status === 'verified'") || !service.includes("status === 'confirmed'") || !service.includes("status === 'ai_analysis' || status === 'estimated'")) throw new Error('Review-state mapping must separate estimated, confirmed and field-verified evidence.');

for (const ui of [
  'DIGITAL TWIN VISION FOUNDATION',
  '도면·사진·영상·스캔 통합 3D 재현 구조',
  '사진/영상 → 공간 매칭',
  'Viewer / Walkthrough / XR',
  'Concept / Assisted Reality / Verified Twin',
]) if (!panel.includes(ui)) throw new Error(`Vision foundation UI missing: ${ui}`);

if (!panel.includes('summarizeReadiness(assets, media)')) throw new Error('Vision foundation UI must calculate readiness from actual asset/media bundle.');
if (!panel.includes('readiness.missingForNextMode')) throw new Error('Vision foundation UI must show missing evidence for next mode.');

console.log('DA:ON Digital Twin vision foundation contract: PASS');
