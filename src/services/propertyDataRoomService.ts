import { REQUIRED_DOCUMENT_TYPES } from '../domain/propertyDataRoom/labels';
import { isVerificationFieldKey } from '../domain/propertyDataRoom/verificationFieldRegistry';
import type { DataRoomBundle, DataRoomSummary, DataSourceType, DocumentExtractionMethod, DocumentExtractionStatus, DocumentType, PropertyDocument, PropertyVerificationCandidate, VerificationDecisionStatus } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { propertyRepository } from '../repositories/propertyRepository';
import { agentOrchestratorService } from './agentOrchestratorService';
import type { Property } from '../types';

const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

const DOCUMENT_NAME_RULES: Array<{ type: DocumentType; patterns: RegExp[] }> = [
  { type: 'building_register', patterns: [/건축물대장/i, /건축물.?대장/i, /building.?register/i] },
  { type: 'land_register', patterns: [/토지대장/i, /land.?register/i] },
  { type: 'land_use_plan', patterns: [/토지이용/i, /이용계획/i, /land.?use/i] },
  { type: 'registry', patterns: [/등기부/i, /등기사항/i, /registry/i] },
  { type: 'cadastral_map', patterns: [/지적도/i, /임야도/i, /cadastral/i] },
  { type: 'lease_status', patterns: [/임대차/i, /임대.?현황/i, /lease/i] },
  { type: 'floor_plan', patterns: [/도면/i, /평면도/i, /floor.?plan/i, /dwg/i, /dxf/i] },
  { type: 'appraisal', patterns: [/감정평가/i, /appraisal/i] },
  { type: 'contract', patterns: [/계약서/i, /매매계약/i, /contract/i] },
  { type: 'financial', patterns: [/재무/i, /손익/i, /financial/i] },
  { type: 'development', patterns: [/개발계획/i, /정비계획/i, /development/i] },
  { type: 'due_diligence', patterns: [/실사/i, /due.?diligence/i] },
];

export const propertyDataRoomService = {
  getBundle: (propertyId: string) => propertyDataRoomRepository.getBundle(propertyId),
  summarize(property: Property, bundle: DataRoomBundle): DataRoomSummary {
    const existingMedia = [property.mainImage, property.mapImage, property.locationAnalysisImage, ...property.additionalImages].filter(Boolean).length;
    const statuses = [...bundle.documents.map((item) => item.verificationStatus), ...bundle.verifications.map((item) => item.status), ...bundle.dataSources.map((item) => item.verificationStatus)];
    const present = new Set(bundle.documents.map((item) => item.documentType));
    const missingDocumentTypes = REQUIRED_DOCUMENT_TYPES.filter((type) => !present.has(type));
    const verificationCandidates = bundle.verificationCandidates ?? [];
    const activeCandidates = verificationCandidates.filter((item) => item.decisionStatus === 'pending' || item.decisionStatus === 'held');
    const requiredDocumentsVerified = REQUIRED_DOCUMENT_TYPES.every((type) => bundle.documents.some((document) =>
      document.documentType === type && (document.verificationStatus === 'verified' || document.verificationStatus === 'confirmed')));
    const agentJobs = bundle.agentJobs ?? [];
    const agentReviews = bundle.agentReviews ?? [];
    return {
      documents: bundle.documents.length, media: existingMedia + bundle.media.length,
      officiallyVerified: statuses.filter((status) => status === 'verified').length,
      unverified: statuses.filter((status) => status === 'unverified' || status === 'missing' || status === 'estimated' || status === 'ai_analysis').length,
      verificationPending: activeCandidates.length,
      reports: bundle.reportSnapshots.length, digitalTwin: bundle.digitalTwinAssets.length,
      agentQueued: agentJobs.filter((job) => job.status === 'queued' || job.status === 'running').length,
      agentReviewRequired: agentReviews.filter((review) => review.decision === 'pending').length,
      missingDocumentTypes,
      reportReady: missingDocumentTypes.length === 0 && requiredDocumentsVerified && activeCandidates.length === 0,
    };
  },
  classifyDocument(fileName: string): DocumentType {
    const normalized = fileName.replace(/\.[^.]+$/, '').trim();
    return DOCUMENT_NAME_RULES.find((rule) => rule.patterns.some((pattern) => pattern.test(normalized)))?.type ?? 'other';
  },
  validateDocument(file: File) {
    if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) return 'PDF, JPG, PNG, WEBP 파일만 등록할 수 있습니다.';
    if (file.size > MAX_DOCUMENT_BYTES) return '파일은 20MB 이하만 등록할 수 있습니다.';
    return '';
  },
  async uploadDocument(propertyId: string, file: File, input: { documentType: DocumentType; title: string; sourceName: string }): Promise<PropertyDocument> {
    const error = this.validateDocument(file); if (error) throw new Error(error);
    const now = new Date().toISOString();
    const document: PropertyDocument = {
      id: crypto.randomUUID(), propertyId, documentType: input.documentType, title: input.title.trim() || file.name,
      originalFileName: file.name, storagePath: `properties/${propertyId}/documents/${crypto.randomUUID()}-${file.name}`,
      fileData: file, mimeType: file.type, fileSize: file.size, sourceType: 'manual', sourceName: input.sourceName.trim() || '사용자 업로드',
      uploadedAt: now, verificationStatus: 'unverified', version: 1, notes: '', extractionStatus: 'not_started', createdAt: now, updatedAt: now,
    };
    const saved = await propertyDataRoomRepository.createDocument(document);
    await propertyDataRoomRepository.saveDataSource({
      id: crypto.randomUUID(), propertyId, resourceType: 'document', sourceType: officialDocumentType(input.documentType) ? 'official_document' : 'external',
      sourceName: saved.title, sourceReference: saved.id, collectedAt: now, verificationStatus: 'unverified',
      metadata: { documentId: saved.id, documentType: saved.documentType, originalFileName: saved.originalFileName, mimeType: saved.mimeType, fileSize: saved.fileSize }, createdAt: now,
    });
    await agentOrchestratorService.queueDocument(saved, 'upload');
    return saved;
  },
  async updateDocumentExtraction(document: PropertyDocument, input: {
    status: DocumentExtractionStatus; method?: DocumentExtractionMethod; pageCount?: number; error?: string;
  }): Promise<PropertyDocument> {
    const now = new Date().toISOString();
    const updated: PropertyDocument = {
      ...document,
      extractionStatus: input.status,
      extractionMethod: input.method,
      extractionPageCount: input.pageCount,
      extractionUpdatedAt: now,
      extractionError: input.error,
      updatedAt: now,
    };
    return propertyDataRoomRepository.updateDocument(updated);
  },
  async createVerificationCandidate(propertyId: string, input: {
    fieldKey: keyof Property; candidateValue: unknown; sourceType: DataSourceType; sourceName: string;
    sourceReference?: string; sourceDate?: string; confidence?: number; note?: string;
  }): Promise<PropertyVerificationCandidate> {
    const fieldKey = String(input.fieldKey);
    if (!isVerificationFieldKey(fieldKey)) throw new Error(`검증 후보로 허용되지 않은 필드입니다: ${fieldKey}`);
    const property = await propertyRepository.getById(propertyId);
    if (!property) throw new Error('검증 후보를 등록할 물건을 찾을 수 없습니다.');
    const now = new Date().toISOString();
    const candidate: PropertyVerificationCandidate = {
      id: crypto.randomUUID(), propertyId, fieldKey, currentValue: property[fieldKey], candidateValue: input.candidateValue,
      sourceType: input.sourceType, sourceName: input.sourceName.trim() || '출처 미등록', sourceReference: input.sourceReference,
      sourceDate: input.sourceDate, confidence: input.confidence, decisionStatus: 'pending', note: input.note?.trim() || '', createdAt: now,
    };
    return propertyDataRoomRepository.saveVerificationCandidate(candidate);
  },
  async decideVerificationCandidate(candidate: PropertyVerificationCandidate, decisionStatus: VerificationDecisionStatus, reviewedBy?: string): Promise<PropertyVerificationCandidate> {
    const now = new Date().toISOString();
    if (candidate.decisionStatus !== 'pending' && candidate.decisionStatus !== 'held') throw new Error('이미 처리된 검증 후보입니다.');
    if (decisionStatus === 'pending') throw new Error('처리 결과는 승인, 보류 또는 거절이어야 합니다.');

    const updatedCandidate = { ...candidate, decisionStatus, reviewedAt: now, reviewedBy };

    if (decisionStatus === 'approved') {
      if (!isVerificationFieldKey(candidate.fieldKey)) throw new Error(`승인할 수 없는 필드입니다: ${candidate.fieldKey}`);
      const property = await propertyRepository.getById(candidate.propertyId);
      if (!property) throw new Error('검증 후보를 반영할 물건을 찾을 수 없습니다.');
      const updatedProperty = { ...property, [candidate.fieldKey]: candidate.candidateValue, updatedAt: now } as Property;
      return propertyDataRoomRepository.approveVerificationCandidate({
        property: updatedProperty,
        candidate: updatedCandidate,
        verification: {
          id: crypto.randomUUID(), propertyId: candidate.propertyId, fieldKey: candidate.fieldKey, status: 'verified',
          note: candidate.note || `${candidate.sourceName} 후보값 승인`, verifiedBy: reviewedBy, verifiedAt: now, createdAt: now, updatedAt: now,
        },
        dataSource: {
          id: crypto.randomUUID(), propertyId: candidate.propertyId, fieldKey: candidate.fieldKey, sourceType: candidate.sourceType,
          sourceName: candidate.sourceName, sourceReference: candidate.sourceReference, collectedAt: now, sourceDate: candidate.sourceDate,
          confidence: candidate.confidence, verificationStatus: 'verified', metadata: { verificationCandidateId: candidate.id }, createdAt: now,
        },
      });
    }

    return propertyDataRoomRepository.saveVerificationCandidate(updatedCandidate);
  },
  downloadDocument(document: PropertyDocument) {
    if (!document.fileData && !document.fileUrl) throw new Error('저장된 파일 본문을 찾을 수 없습니다.');
    const url = document.fileData ? URL.createObjectURL(document.fileData) : document.fileUrl!;
    const anchor = window.document.createElement('a'); anchor.href = url; anchor.download = document.originalFileName; anchor.click();
    if (document.fileData) window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

function officialDocumentType(type: DocumentType) {
  return ['building_register', 'land_register', 'land_use_plan', 'registry', 'cadastral_map'].includes(type);
}
