import type { DataRoomBundle } from '../domain/propertyDataRoom/types';
import { DOCUMENT_TYPE_LABELS, REQUIRED_DOCUMENT_TYPES } from '../domain/propertyDataRoom/labels';
import type { Property } from '../types';

export type ReadinessState = 'ready' | 'partial' | 'missing';

export interface ReadinessStage {
  id: 'core' | 'documents' | 'provenance' | 'verification' | 'media' | 'report' | 'digital_twin';
  label: string;
  state: ReadinessState;
  detail: string;
  pathSuffix?: string;
}

export interface PropertyReadinessAssessment {
  propertyId: string;
  scorePct: number;
  readyCount: number;
  partialCount: number;
  missingCount: number;
  stages: ReadinessStage[];
}

export interface RequiredDocumentReadiness {
  present: typeof REQUIRED_DOCUMENT_TYPES;
  connected: typeof REQUIRED_DOCUMENT_TYPES;
  verified: typeof REQUIRED_DOCUMENT_TYPES;
  missing: typeof REQUIRED_DOCUMENT_TYPES;
}

export function assessRequiredDocumentReadiness(bundle: DataRoomBundle): RequiredDocumentReadiness {
  const required = assessRequiredDocumentReadiness(bundle);
  const requiredPresent = required.present;
  const requiredConnected = required.connected;
  const requiredVerified = required.verified;
  const requiredMissing = required.missing;
  const documentState: ReadinessState = requiredConnected.length === REQUIRED_DOCUMENT_TYPES.length && requiredVerified.length === REQUIRED_DOCUMENT_TYPES.length
    ? 'ready'
    : requiredPresent.length > 0 || requiredConnected.length > 0
      ? 'partial'
      : 'missing';
  const documentDetail = requiredMissing.length
    ? `원본확인 ${requiredPresent.length}/${REQUIRED_DOCUMENT_TYPES.length} · 파일연결 ${requiredConnected.length}/${REQUIRED_DOCUMENT_TYPES.length} · 미확인 ${requiredMissing.map((type) => DOCUMENT_TYPE_LABELS[type]).join('·')}`
    : `원본확인 4/4 · 파일연결 ${requiredConnected.length}/4 · 공식검증 ${requiredVerified.length}/4`;
  const stages: ReadinessStage[] = [
    coreStage(property),
    {
      id: 'documents',
      label: '문서',
      state: documentState,
      detail: documentDetail,
      pathSuffix: '?tab=documents',
    },
    {
      id: 'provenance',
      label: '구조화 / 출처',
      state: spaces.length > 0 && bundle.dataSources.length > 0 ? 'ready' : (spaces.length > 0 || bundle.dataSources.length > 0) ? 'partial' : 'missing',
      detail: `공간 ${spaces.length} · 출처 ${bundle.dataSources.length}`,
    },
    {
      id: 'verification',
      label: '검증',
      state: bundle.verifications.length > 0 ? 'ready' : bundle.verificationCandidates.length > 0 ? 'partial' : 'missing',
      detail: bundle.verifications.length > 0 ? `검증 ${bundle.verifications.length}건` : bundle.verificationCandidates.length > 0 ? `후보 ${bundle.verificationCandidates.length}건` : '검증 기록 없음',
      pathSuffix: '?tab=verification',
    },
    {
      id: 'media',
      label: '미디어',
      state: bundle.media.length > 0 ? 'ready' : 'missing',
      detail: `${bundle.media.length}건`,
      pathSuffix: '?tab=media',
    },
    {
      id: 'report',
      label: '보고서',
      state: hasReadyReport ? 'ready' : hasReport ? 'partial' : 'missing',
      detail: hasReadyReport ? `확정 ${bundle.reportSnapshots.filter((snapshot) => snapshot.status === 'ready').length}건` : hasReport ? `Draft ${bundle.reportSnapshots.length}건` : 'Snapshot 없음',
      pathSuffix: '?tab=reports',
    },
    {
      id: 'digital_twin',
      label: '3D / Digital Twin',
      state: bundle.digitalTwinAssets.length > 0 ? 'ready' : 'missing',
      detail: `${bundle.digitalTwinAssets.length}개 자산`,
      pathSuffix: '?tab=digitalTwin',
    },
  ];

  const readyCount = stages.filter((stage) => stage.state === 'ready').length;
  const partialCount = stages.filter((stage) => stage.state === 'partial').length;
  const missingCount = stages.filter((stage) => stage.state === 'missing').length;
  const weighted = readyCount + partialCount * 0.5;
  const scorePct = Math.round((weighted / stages.length) * 100);

  return { propertyId: property.id, scorePct, readyCount, partialCount, missingCount, stages };
}
