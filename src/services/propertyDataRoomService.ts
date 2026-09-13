import { REQUIRED_DOCUMENT_TYPES } from '../domain/propertyDataRoom/labels';
import type { DataRoomBundle, DataRoomSummary, DataSourceType, DocumentType, PropertyDocument, PropertyVerificationCandidate, VerificationDecisionStatus } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { propertyRepository } from '../repositories/propertyRepository';
import type { Property } from '../types';

const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export const propertyDataRoomService = {
  getBundle: (propertyId: string) => propertyDataRoomRepository.getBundle(propertyId),
  summarize(property: Property, bundle: DataRoomBundle): DataRoomSummary {
    const existingMedia = [property.mainImage, property.mapImage, property.locationAnalysisImage, ...property.additionalImages].filter(Boolean).length;
    const statuses = [...bundle.documents.map((item) => item.verificationStatus), ...bundle.verifications.map((item) => item.status), ...bundle.dataSources.map((item) => item.verificationStatus)];
    const present = new Set(bundle.documents.map((item) => item.documentType));
    const missingDocumentTypes = REQUIRED_DOCUMENT_TYPES.filter((type) => !present.has(type));
    const verificationCandidates = bundle.verificationCandidates ?? [];
    return {
      documents: bundle.documents.length, media: existingMedia + bundle.media.length,
      officiallyVerified: statuses.filter((status) => status === 'verified').length,
      unverified: statuses.filter((status) => status === 'unverified' || status === 'missing' || status === 'estimated' || status === 'ai_analysis').length,
      verificationPending: verificationCandidates.filter((item) => item.decisionStatus === 'pending' || item.decisionStatus === 'held').length,
      reports: bundle.reportSnapshots.length, digitalTwin: bundle.digitalTwinAssets.length,
      missingDocumentTypes, reportReady: missingDocumentTypes.length === 0,
    };
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
      uploadedAt: now, verificationStatus: 'unverified', version: 1, notes: '', createdAt: now, updatedAt: now,
    };
    return propertyDataRoomRepository.createDocument(document);
  },
  async createVerificationCandidate(propertyId: string, input: {
    fieldKey: keyof Property; candidateValue: unknown; sourceType: DataSourceType; sourceName: string;
    sourceReference?: string; sourceDate?: string; confidence?: number; note?: string;
  }): Promise<PropertyVerificationCandidate> {
    const property = await propertyRepository.getById(propertyId);
    if (!property) throw new Error('검증 후보를 등록할 물건을 찾을 수 없습니다.');
    const now = new Date().toISOString();
    const candidate: PropertyVerificationCandidate = {
      id: crypto.randomUUID(), propertyId, fieldKey: String(input.fieldKey), currentValue: property[input.fieldKey], candidateValue: input.candidateValue,
      sourceType: input.sourceType, sourceName: input.sourceName.trim() || '출처 미등록', sourceReference: input.sourceReference,
      sourceDate: input.sourceDate, confidence: input.confidence, decisionStatus: 'pending', note: input.note?.trim() || '', createdAt: now,
    };
    return propertyDataRoomRepository.saveVerificationCandidate(candidate);
  },
  async decideVerificationCandidate(candidate: PropertyVerificationCandidate, decisionStatus: VerificationDecisionStatus, reviewedBy?: string): Promise<PropertyVerificationCandidate> {
    const now = new Date().toISOString();
    if (candidate.decisionStatus !== 'pending' && candidate.decisionStatus !== 'held') throw new Error('이미 처리된 검증 후보입니다.');
    if (decisionStatus === 'pending') throw new Error('처리 결과는 승인, 보류 또는 거절이어야 합니다.');

    if (decisionStatus === 'approved') {
      const property = await propertyRepository.getById(candidate.propertyId);
      if (!property) throw new Error('검증 후보를 반영할 물건을 찾을 수 없습니다.');
      const fieldKey = candidate.fieldKey as keyof Property;
      const updated = { ...property, [fieldKey]: candidate.candidateValue, updatedAt: now } as Property;
      await propertyRepository.update(updated);
      await propertyDataRoomRepository.saveVerification({
        id: crypto.randomUUID(), propertyId: candidate.propertyId, fieldKey: candidate.fieldKey, status: 'verified',
        note: candidate.note || `${candidate.sourceName} 후보값 승인`, verifiedBy: reviewedBy, verifiedAt: now, createdAt: now, updatedAt: now,
      });
      await propertyDataRoomRepository.saveDataSource({
        id: crypto.randomUUID(), propertyId: candidate.propertyId, fieldKey: candidate.fieldKey, sourceType: candidate.sourceType,
        sourceName: candidate.sourceName, sourceReference: candidate.sourceReference, collectedAt: now, sourceDate: candidate.sourceDate,
        confidence: candidate.confidence, verificationStatus: 'verified', metadata: { verificationCandidateId: candidate.id }, createdAt: now,
      });
    }

    const updatedCandidate = { ...candidate, decisionStatus, reviewedAt: now, reviewedBy };
    return propertyDataRoomRepository.saveVerificationCandidate(updatedCandidate);
  },
  downloadDocument(document: PropertyDocument) {
    if (!document.fileData && !document.fileUrl) throw new Error('저장된 파일 본문을 찾을 수 없습니다.');
    const url = document.fileData ? URL.createObjectURL(document.fileData) : document.fileUrl!;
    const anchor = window.document.createElement('a'); anchor.href = url; anchor.download = document.originalFileName; anchor.click();
    if (document.fileData) window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
