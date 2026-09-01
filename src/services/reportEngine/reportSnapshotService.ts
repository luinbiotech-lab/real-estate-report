import type { ProfessionalReportViewModel } from '../../domain/professionalReport/types';
import type { ReportSnapshot } from '../../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../../repositories/propertyDataRoomRepository';
import { PROFESSIONAL_REPORT_TEMPLATE_VERSION, reportDataBuilder } from './reportDataBuilder';

function snapshotData(viewModel: ProfessionalReportViewModel): Record<string, unknown> {
  return JSON.parse(JSON.stringify(viewModel)) as Record<string, unknown>;
}

export const reportSnapshotService = {
  async createDraft(propertyId: string, generatedBy?: string): Promise<ReportSnapshot> {
    const existing = await propertyDataRoomRepository.getReportSnapshots(propertyId);
    const viewModel = await reportDataBuilder.build(propertyId, { templateVersion: PROFESSIONAL_REPORT_TEMPLATE_VERSION });
    const now = viewModel.generated.generatedAt;
    const snapshot: ReportSnapshot = {
      id: crypto.randomUUID(), propertyId, reportType: 'professional_report',
      reportVersion: Math.max(0, ...existing.filter((item) => item.reportType === 'professional_report').map((item) => item.reportVersion)) + 1,
      templateVersion: viewModel.generated.templateVersion, snapshotData: snapshotData(viewModel), generatedAt: now,
      generatedBy, status: 'draft', createdAt: now,
    };
    return propertyDataRoomRepository.saveReportSnapshot(snapshot);
  },
};
