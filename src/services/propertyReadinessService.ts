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

// All Data Room rows used to generate a report must belong to the authoritative Property.
// Repository filtering alone is not a security boundary: stale/mixed bundles can reach the builder.
export function scopeDataRoomBundle(bundle: DataRoomBundle, propertyId: string): DataRoomBundle {
  return {
    ...bundle,
    documents: bundle.documents?.filter((row) => row.propertyId === propertyId) ?? [],
    media: bundle.media?.filter((row) => row.propertyId === propertyId) ?? [],
    verifications: bundle.verifications?.filter((row) => row.propertyId === propertyId) ?? [],
    verificationCandidates: bundle.verificationCandidates?.filter((row) => row.propertyId === propertyId) ?? [],
    dataSources: bundle.dataSources?.filter((row) => row.propertyId === propertyId) ?? [],
    reportSnapshots: bundle.reportSnapshots?.filter((row) => row.propertyId === propertyId) ?? [],
    digitalTwinAssets: bundle.digitalTwinAssets?.filter((row) => row.propertyId === propertyId) ?? [],
    agentJobs: bundle.agentJobs?.filter((row) => row.propertyId === propertyId),
    agentResults: bundle.agentResults?.filter((row) => row.propertyId === propertyId),
    agentReviews: bundle.agentReviews?.filter((row) => row.propertyId === propertyId),
    spaces: bundle.spaces?.filter((row) => row.propertyId === propertyId),
    spaceMediaLinks: bundle.spaceMediaLinks?.filter((row) => row.propertyId === propertyId),
    spaceRoomLinks: bundle.spaceRoomLinks?.filter((row) => row.propertyId === propertyId),
    facilities: bundle.facilities?.filter((row) => row.propertyId === propertyId),
    roomEvidencePositions: bundle.roomEvidencePositions?.filter((row) => row.propertyId === propertyId),
    roomConditionHistory: bundle.roomConditionHistory?.filter((row) => row.propertyId === propertyId),
    renovationAssessments: bundle.renovationAssessments?.filter((row) => row.propertyId === propertyId),
    roomRenovationAssessments: bundle.roomRenovationAssessments?.filter((row) => row.propertyId === propertyId),
    roomRenovationHistory: bundle.roomRenovationHistory?.filter((row) => row.propertyId === propertyId),
    riskAssessments: bundle.riskAssessments?.filter((row) => row.propertyId === propertyId),
  };
}

// A Data Room metadata row or a stale/deleted document is not an attached original.
// Remote mode downloads the private Storage object into fileData before returning
// the bundle; local mode stores the original Blob in IndexedDB.
function hasConnectedOriginal(document: DataRoomBundle['documents'][number]): boolean {
  return !document.deletedAt &&
    typeof document.storagePath === 'string' && document.storagePath.trim().length > 0 &&
    document.fileData instanceof Blob &&
    document.fileData.size > 0 &&
    Number.isFinite(document.fileSize) && document.fileSize === document.fileData.size;
}

export function assessRequiredDocumentReadiness(bundle: DataRoomBundle, propertyId?: string): RequiredDocumentReadiness {
  // A repository query normally scopes rows by Property, but a mixed/stale bundle
  // must never certify another Property's official originals or attestations.
  // Callers that issue a report must supply the authoritative Property ID.
  const documents = propertyId ? bundle.documents.filter((document) => document.propertyId === propertyId) : bundle.documents;
  const verifications = propertyId ? bundle.verifications.filter((verification) => verification.propertyId === propertyId) : bundle.verifications;
  const dataSources = propertyId ? bundle.dataSources.filter((source) => source.propertyId === propertyId) : bundle.dataSources;
  const inventoryDocumentTypes = new Set(dataSources
    .filter((source) => source.resourceType === 'source_document_inventory' && source.metadata?.originalSourcePresence === 'confirmed')
    .map((source) => {
      const type = source.metadata?.documentType;
      if (type === 'registry_land' || type === 'registry_building' || type === 'registry') return 'registry';
      return typeof type === 'string' ? type : '';
    })
    .filter(Boolean));
  const connected = REQUIRED_DOCUMENT_TYPES.filter((type) => documents.some((document) =>
    document.documentType === type && hasConnectedOriginal(document)));
  const present = REQUIRED_DOCUMENT_TYPES.filter((type) => connected.includes(type) || inventoryDocumentTypes.has(type));
  const verified = REQUIRED_DOCUMENT_TYPES.filter((type) => documents.some((document) =>
    document.documentType === type && hasConnectedOriginal(document) &&
    (document.verificationStatus === 'verified' || verifications.some((verification) =>
      verification.status === 'verified' &&
      (verification.fieldKey === `document:${document.id}` || verification.fieldKey === document.id)
    ))
  ));
  const missing = REQUIRED_DOCUMENT_TYPES.filter((type) => !present.includes(type));
  return { present, connected, verified, missing };
}

function coreStage(property: Property): ReadinessStage {
  const checks = [
    Boolean(property.address?.trim()),
    property.landAreaSqm > 0,
    property.totalFloorAreaSqm > 0,
    Boolean(property.managerName?.trim()),
  ];
  const complete = checks.filter(Boolean).length;
  return {
    id: 'core',
    label: '기본정보',
    state: complete === checks.length ? 'ready' : complete > 0 ? 'partial' : 'missing',
    detail: `${complete}/${checks.length} 핵심필드`,
  };
}

export function assessPropertyReadiness(property: Property, bundle: DataRoomBundle): PropertyReadinessAssessment {
  // Never let a mixed/stale Data Room response inflate another Property's dashboard readiness.
  // Scope every stage, not only the official-document gate used for report finalization.
  bundle = scopeDataRoomBundle(bundle, property.id);
  const spaces = bundle.spaces ?? [];
  const hasReadyReport = bundle.reportSnapshots.some((snapshot) => snapshot.status === 'ready');
  const hasReport = bundle.reportSnapshots.length > 0;
  // A floor-plan upload, failed conversion, or sample 3D file is not a verified Digital Twin.
  // This is a dashboard readiness signal, not independent evidence of real dimensions.
  const activeTwinAssets = bundle.digitalTwinAssets.filter((asset) => !asset.deletedAt);
  const readyTwinModels = activeTwinAssets.filter((asset) =>
    (asset.assetType === 'glb' || asset.assetType === 'gltf') && asset.processingStatus === 'ready');
  const readySourcePlanIds = new Set(activeTwinAssets
    .filter((asset) => ['floor_plan', 'scanned_plan', 'dwg', 'dxf'].includes(asset.assetType) &&
      asset.processingStatus === 'ready')
    .map((asset) => asset.id));
  const dimensionCheckedModels = readyTwinModels.filter((asset) =>
    asset.metadata?.horizontalScaleVerified === true &&
    asset.metadata?.heightStatus === 'verified' &&
    typeof asset.metadata?.sourceFloorPlanAssetId === 'string' &&
    readySourcePlanIds.has(asset.metadata.sourceFloorPlanAssetId));

  const required = assessRequiredDocumentReadiness(bundle, property.id);
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
    : `원본확인 ${requiredPresent.length}/${REQUIRED_DOCUMENT_TYPES.length} · 파일연결 ${requiredConnected.length}/${REQUIRED_DOCUMENT_TYPES.length} · 공식검증 ${requiredVerified.length}/${REQUIRED_DOCUMENT_TYPES.length}`;
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
      state: dimensionCheckedModels.length > 0 ? 'ready' : activeTwinAssets.length > 0 ? 'partial' : 'missing',
      detail: dimensionCheckedModels.length > 0
        ? `치수·축척 검증표시 3D ${dimensionCheckedModels.length}건 (실자료 독립검증 별도)`
        : activeTwinAssets.length > 0
          ? `자산 ${activeTwinAssets.length}건 · 모델 준비 ${readyTwinModels.length}건 · 도면/치수/층 검증 필요`
          : '3D 자산 없음',
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
