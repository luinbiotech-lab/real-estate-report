import type { ProfessionalReportViewModel } from '../../domain/professionalReport/types';
import type { ReportSnapshot } from '../../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../../repositories/propertyDataRoomRepository';
import {
  PROFESSIONAL_REPORT_TEMPLATE_ID,
  PROFESSIONAL_REPORT_TEMPLATE_VERSION,
  REPORT_ENGINE_VERSION,
  reportDataBuilder,
} from './reportDataBuilder';

function snapshotData(viewModel: ProfessionalReportViewModel): Record<string, unknown> {
  return JSON.parse(JSON.stringify(viewModel)) as Record<string, unknown>;
}

function snapshotViewModel(snapshot: ReportSnapshot): ProfessionalReportViewModel | null {
  if (!snapshot.snapshotData || typeof snapshot.snapshotData !== 'object') return null;
  const candidate = snapshot.snapshotData as Partial<ProfessionalReportViewModel>;
  if (!candidate.generated?.templateId || !candidate.dataQuality) return null;
  return candidate as ProfessionalReportViewModel;
}

export const reportSnapshotService = {
  async createDraft(propertyId: string, generatedBy?: string): Promise<ReportSnapshot> {
    const viewModel = await reportDataBuilder.build(propertyId, {
      templateId: PROFESSIONAL_REPORT_TEMPLATE_ID,
      templateVersion: PROFESSIONAL_REPORT_TEMPLATE_VERSION,
    });
    const now = viewModel.generated.generatedAt;
    return propertyDataRoomRepository.createNextReportSnapshot({
      id: crypto.randomUUID(), propertyId, reportType: 'professional_report',
      templateId: viewModel.generated.templateId,
      templateVersion: viewModel.generated.templateVersion,
      engineVersion: REPORT_ENGINE_VERSION,
      snapshotData: snapshotData(viewModel), generatedAt: now,
      generatedBy, status: 'draft', createdAt: now,
    });
  },
  async markReady(snapshotId: string): Promise<ReportSnapshot> {
    const current = await propertyDataRoomRepository.getReportSnapshot(snapshotId);
    if (!current) throw new Error('보고서 Snapshot을 찾을 수 없습니다.');
    if (current.status !== 'draft') throw new Error('초안 상태의 보고서만 확정할 수 있습니다.');
    const viewModel = snapshotViewModel(current);
    if (!viewModel) throw new Error('현재 MASTER 형식으로 다시 생성한 뒤 보고서를 확정해 주세요.');
    if (!viewModel.dataQuality.reportReady) {
      const missingDocuments = viewModel.dataQuality.requiredDocumentsMissing.length;
      const missingFields = viewModel.dataQuality.missingFields.length;
      throw new Error(`검증이 완료되지 않아 보고서를 확정할 수 없습니다. 필수자료 ${missingDocuments}건 · 확인 필요 필드 ${missingFields}건을 먼저 검토해 주세요.`);
    }
    return propertyDataRoomRepository.updateReportSnapshotStatus(snapshotId, 'ready');
  },
};
