import type { ProfessionalReportViewModel } from '../../domain/professionalReport/types';
import type { ReportSnapshot } from '../../domain/propertyDataRoom/types';
import { isBangbae81511, reportMediaCategoryAllowed, reportSpatialMediaAllowed } from '../../domain/professionalReport/reportAccessPolicy';
import { propertyDataRoomRepository } from '../../repositories/propertyDataRoomRepository';
import { REQUIRED_DOCUMENT_TYPES } from '../../domain/propertyDataRoom/labels';
import { assessRequiredDocumentReadiness, scopeDataRoomBundle } from '../propertyReadinessService';
import { reportSnapshotFreshnessService } from './reportSnapshotFreshnessService';
import {
  PROFESSIONAL_REPORT_TEMPLATE_ID,
  PROFESSIONAL_REPORT_TEMPLATE_VERSION,
  REPORT_ENGINE_VERSION,
  reportDataBuilder,
} from './reportDataBuilder';

function applySnapshotMediaPolicy(viewModel: ProfessionalReportViewModel): ProfessionalReportViewModel {
  if (viewModel.media.internalPhotoAllowed) return viewModel;
  return {
    ...viewModel,
    spatial: viewModel.spatial ? {
      ...viewModel.spatial,
      media: viewModel.spatial.media.filter((item) => reportSpatialMediaAllowed(item.mediaType, item.sourceOrigin, false)),
    } : undefined,
    media: {
      ...viewModel.media,
      mainImage: { ...viewModel.media.mainImage, value: null, display: '미연결', state: 'missing', sourceIds: [] },
      additionalImages: { ...viewModel.media.additionalImages, value: [], display: '미연결', state: 'missing', sourceIds: [] },
      items: viewModel.media.items.filter((item) => item.id !== 'property-main' && item.category !== 'additional' && reportMediaCategoryAllowed(item.category, false)),
    },
  };
}

function snapshotData(viewModel: ProfessionalReportViewModel): Record<string, unknown> {
  return JSON.parse(JSON.stringify(applySnapshotMediaPolicy(viewModel))) as Record<string, unknown>;
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
    // A ready report must be bound to its authoritative Property and approved MASTER.
    // Checking only the stored reportReady flag can finalize a legacy or cross-property payload.
    if (current.reportType !== 'professional_report' ||
        current.templateId !== PROFESSIONAL_REPORT_TEMPLATE_ID ||
        current.templateVersion !== PROFESSIONAL_REPORT_TEMPLATE_VERSION ||
        current.engineVersion !== REPORT_ENGINE_VERSION ||
        viewModel.identity?.id !== current.propertyId ||
        viewModel.generated.templateId !== current.templateId ||
        viewModel.generated.templateVersion !== current.templateVersion ||
        viewModel.generated.engineVersion !== current.engineVersion ||
        viewModel.generated.generatedAt !== current.generatedAt) {
      throw new Error('Snapshot 물건 ID·MASTER 버전·생성시각이 일치하지 않습니다. 현재 MASTER로 새 초안을 생성해 주세요.');
    }
    // A legacy Snapshot may contain interior/unknown media even when the current
    // preview hides it. Never persist that raw payload as an immutable final report.
    // Require regeneration instead of silently changing historical Snapshot data.
    if (isBangbae81511({
      id: current.propertyId,
      name: viewModel.identity.name?.value ?? '',
      address: viewModel.identity.address?.value ?? '',
      detailAddress: viewModel.identity.detailAddress?.value ?? '',
    })) {
      const media = viewModel.media;
      if (!media || media.internalPhotoAllowed !== false ||
          Boolean(media.mainImage?.value) ||
          Boolean(media.additionalImages?.value?.length) ||
          !Array.isArray(media.items) ||
          media.items.some((item) => item.id === 'property-main' || !reportMediaCategoryAllowed(item.category, false)) ||
          (viewModel.spatial && (!Array.isArray(viewModel.spatial.media) ||
            viewModel.spatial.media.some((item) => !reportSpatialMediaAllowed(item.mediaType, item.sourceOrigin, false))))) {
        throw new Error('방배동 815-11의 Snapshot에 금지되거나 미분류된 사진이 포함되어 있습니다. 내부사진을 제외한 현재 MASTER로 새 초안을 생성해 주세요.');
      }
    }
    if (!viewModel.dataQuality.reportReady) {
      const missingDocuments = viewModel.dataQuality.requiredDocumentsMissing.length;
      const missingFields = viewModel.dataQuality.missingFields.length;
      throw new Error(`검증이 완료되지 않아 보고서를 확정할 수 없습니다. 필수자료 ${missingDocuments}건 · 확인 필요 필드 ${missingFields}건을 먼저 검토해 주세요.`);
    }
    // Recheck live Data Room evidence: an older Snapshot may have been generated
    // when user-confirmed documents were incorrectly accepted as officially verified.
    const bundle = scopeDataRoomBundle(await propertyDataRoomRepository.getBundle(current.propertyId), current.propertyId);
    const required = assessRequiredDocumentReadiness(bundle, current.propertyId);
    const unresolvedCandidates = bundle.verificationCandidates.some(
      (candidate) => candidate.decisionStatus === 'pending' || candidate.decisionStatus === 'held',
    );
    if (required.connected.length !== REQUIRED_DOCUMENT_TYPES.length ||
        required.verified.length !== REQUIRED_DOCUMENT_TYPES.length || unresolvedCandidates) {
      throw new Error('현재 Data Room의 필수 원본·공식 검증 또는 미처리 후보가 남아 있어 보고서를 확정할 수 없습니다.');
    }
    const freshness = await reportSnapshotFreshnessService.evaluate(current);
    if (freshness.isStale) {
      throw new Error('Snapshot 생성 이후 Property/Data Room/Spatial 데이터가 변경되었습니다. 최신 데이터로 새 버전을 생성한 뒤 확정해 주세요.');
    }
    return propertyDataRoomRepository.updateReportSnapshotStatus(snapshotId, 'ready');
  },
};