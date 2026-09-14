import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';

export type ProductionCandidateState = 'none' | 'current' | 'stale' | 'invalid';

const SOURCE_KEYS = [
  'geometry',
  'semanticLayerReviews',
  'scaleCalibration',
  'verticalDimensions',
  'floorPlacement',
  'wallThicknessReviews',
  'roomTopologyReviews',
  'openingAdjacencyReviews',
  'openingDimensions',
  'verticalCoreReviews',
] as const;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonicalize(item)]));
}

function hashString(value: string) {
  let h1 = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h1 ^= value.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0');
}

export function buildGeometrySourceFingerprint(asset: DigitalTwinAsset) {
  const source = Object.fromEntries(SOURCE_KEYS.map((key) => [key, canonicalize(asset.metadata[key])]));
  return `daon-src-${hashString(JSON.stringify(source))}`;
}

export function getProductionCandidateState(asset: DigitalTwinAsset): { state: ProductionCandidateState; reason: string; sourceFingerprint: string; candidateFingerprint?: string } {
  const sourceFingerprint = buildGeometrySourceFingerprint(asset);
  const candidate = asset.metadata.productionGeometryCandidate;
  if (!candidate || typeof candidate !== 'object') return { state: 'none', reason: '승격된 production candidate가 없습니다.', sourceFingerprint };
  const record = candidate as Record<string, unknown>;
  if (record.status !== 'production_candidate' || !record.geometry || typeof record.geometry !== 'object') return { state: 'invalid', reason: 'production candidate 구조가 유효하지 않습니다.', sourceFingerprint };
  const validation = record.validation;
  if (!validation || typeof validation !== 'object' || (validation as Record<string, unknown>).valid !== true) return { state: 'invalid', reason: '승격 candidate의 geometry validation이 유효하지 않습니다.', sourceFingerprint };
  const candidateFingerprint = typeof record.sourceFingerprint === 'string' ? record.sourceFingerprint : undefined;
  if (!candidateFingerprint) return { state: 'stale', reason: '기존 candidate에 source fingerprint가 없어 재승격이 필요합니다.', sourceFingerprint };
  if (candidateFingerprint !== sourceFingerprint) return { state: 'stale', reason: '승격 이후 CAD/Human Review/치수 데이터가 변경되었습니다.', sourceFingerprint, candidateFingerprint };
  return { state: 'current', reason: '현재 검증 소스와 production candidate가 일치합니다.', sourceFingerprint, candidateFingerprint };
}

export const geometryProductionStateService = {
  fingerprint: buildGeometrySourceFingerprint,
  getState: getProductionCandidateState,
};
