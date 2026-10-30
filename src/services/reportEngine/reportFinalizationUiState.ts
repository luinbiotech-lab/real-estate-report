import type { ReportSnapshot } from '../../domain/propertyDataRoom/types';
import type { ReportSnapshotFreshness } from './reportSnapshotFreshnessService';

// UI preflight only. reportSnapshotService.markReady() remains the authoritative
// live Data Room, provenance, privacy and freshness gate at mutation time.
// Remote finalization creates a new immutable Snapshot ID. The route must
// follow that ID; otherwise the cross-route render guard shows a permanent spinner.
// Local IndexedDB finalization retains the original ID and should not navigate.
export function getFinalizedSnapshotDestination(requestedId: string, ready: Pick<ReportSnapshot, 'id'>): string | null {
  if (!ready.id) throw new Error('확정된 보고서 Snapshot ID가 없습니다.');
  return ready.id === requestedId ? null : `/professional-report/snapshot/${encodeURIComponent(ready.id)}`;
}

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
