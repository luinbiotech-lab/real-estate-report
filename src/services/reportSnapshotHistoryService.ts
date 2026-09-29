import type { ReportSnapshot, ReportType } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';

export interface ReportSnapshotHistoryItem {
  snapshot: ReportSnapshot;
  isLatest: boolean;
  isLatestReady: boolean;
}

function orderSnapshots(items: ReportSnapshot[]) {
  return [...items].sort((left, right) => {
    if (left.reportVersion !== right.reportVersion) return right.reportVersion - left.reportVersion;
    return right.generatedAt.localeCompare(left.generatedAt);
  });
}

export const reportSnapshotHistoryService = {
  async list(propertyId: string, reportType: ReportType = 'professional_report'): Promise<ReportSnapshotHistoryItem[]> {
    const snapshots = orderSnapshots(
      (await propertyDataRoomRepository.getReportSnapshots(propertyId)).filter((item) => item.reportType === reportType),
    );
    const latestId = snapshots[0]?.id;
    const latestReadyId = snapshots.find((item) => item.status === 'ready')?.id;
    return snapshots.map((snapshot) => ({
      snapshot,
      isLatest: snapshot.id === latestId,
      isLatestReady: snapshot.id === latestReadyId,
    }));
  },

  async archive(snapshotId: string): Promise<ReportSnapshot> {
    const snapshot = await propertyDataRoomRepository.getReportSnapshot(snapshotId);
    if (!snapshot) throw new Error('보고서 Snapshot을 찾을 수 없습니다.');
    if (snapshot.status === 'ready') throw new Error('확정된 Snapshot은 임의로 보관 처리할 수 없습니다.');
    if (snapshot.status === 'archived') return snapshot;
    return propertyDataRoomRepository.updateReportSnapshotStatus(snapshotId, 'archived');
  },

  async archiveSupersededDrafts(propertyId: string, reportType: ReportType = 'professional_report'): Promise<number> {
    const history = await this.list(propertyId, reportType);
    const targets = history.filter(({ snapshot, isLatest }) => !isLatest && snapshot.status === 'draft');
    for (const { snapshot } of targets) {
      await propertyDataRoomRepository.updateReportSnapshotStatus(snapshot.id, 'archived');
    }
    return targets.length;
  },
};
