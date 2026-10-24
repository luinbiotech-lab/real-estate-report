import type { ReportSnapshot } from '../../domain/propertyDataRoom/types';
import type { ReportSnapshotFreshness } from './reportSnapshotFreshnessService';

// UI preflight only. reportSnapshotService.markReady() remains the authoritative
// live Data Room, provenance, privacy and freshness gate at mutation time.
export function getSnapshotFinalizationUiState(
  status: ReportSnapshot['status'],
  reportReady: boolean,
  freshness: ReportSnapshotFreshness | undefined,
) {
  if (status === 'ready') return { label: '확정됨', color: 'success' as const, canRequestReady: false };
  if (status !== 'draft') return { label: '확정 불가', color: 'warning' as const, canRequestReady: false };
  if (!reportReady) return { label: '검증 필요', color: 'warning' as const, canRequestReady: false };
  // Undefined means checking OR failed. Neither permits a confirmation request.
  if (!freshness) return { label: '최신성 확인 중', color: 'warning' as const, canRequestReady: false };
  if (freshness.isStale) return { label: '최신 데이터 필요', color: 'warning' as const, canRequestReady: false };
  return { label: '확정 요청 가능', color: 'primary' as const, canRequestReady: true };
}
