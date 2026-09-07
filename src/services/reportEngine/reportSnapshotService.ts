import type { ProfessionalReportViewModel } from '../../domain/professionalReport/types';
import type { ReportSnapshot } from '../../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../../repositories/propertyDataRoomRepository';
import { PROFESSIONAL_REPORT_TEMPLATE_VERSION, REPORT_ENGINE_VERSION, reportDataBuilder } from './reportDataBuilder';

function snapshotData(viewModel: ProfessionalReportViewModel): Record<string, unknown> {
  return JSON.parse(JSON.stringify(viewModel)) as Record<string, unknown>;
}

export const reportSnapshotService = {
  async createDraft(propertyId: string, generatedBy?: string): Promise<ReportSnapshot> {
    const viewModel = await reportDataBuilder.build(propertyId, { templateVersion: PROFESSIONAL_REPORT_TEMPLATE_VERSION });
    const now = viewModel.generated.generatedAt;
    return propertyDataRoomRepository.createNextReportSnapshot({
      id: crypto.randomUUID(), propertyId, reportType: 'professional_report',
      templateVersion: viewModel.generated.templateVersion, engineVersion: REPORT_ENGINE_VERSION,
      snapshotData: snapshotData(viewModel), generatedAt: now,
      generatedBy, status: 'draft', createdAt: now,
    });
  },
  async markReady(snapshotId: string): Promise<ReportSnapshot> {
    const current = await propertyDataRoomRepository.getReportSnapshot(snapshotId);
    if (!current) throw new Error('보고서 Snapshot을 찾을 수 없습니다.');
    if (current.status !== 'draft') throw new Error('초안 상태의 보고서만 확정할 수 있습니다.');
    return propertyDataRoomRepository.updateReportSnapshotStatus(snapshotId, 'ready');
  },
};
