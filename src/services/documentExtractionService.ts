import type { DocumentType, PropertyDocument } from '../domain/propertyDataRoom/types';
import { propertyRepository } from '../repositories/propertyRepository';
import type { Property } from '../types';
import { propertyDataRoomService } from './propertyDataRoomService';

export interface DocumentFieldDefinition {
  fieldKey: keyof Property;
  label: string;
  valueType: 'text' | 'number' | 'boolean' | 'date';
}

export interface ExtractedDocumentField {
  fieldKey: keyof Property;
  rawValue: string;
  candidateValue?: unknown;
  confidence?: number;
}

const DOCUMENT_FIELD_MAP: Partial<Record<DocumentType, DocumentFieldDefinition[]>> = {
  building_register: [
    { fieldKey: 'address', label: '소재지', valueType: 'text' },
    { fieldKey: 'buildingName', label: '건물명', valueType: 'text' },
    { fieldKey: 'mainUse', label: '주용도', valueType: 'text' },
    { fieldKey: 'structure', label: '구조', valueType: 'text' },
    { fieldKey: 'basementFloors', label: '지하층', valueType: 'number' },
    { fieldKey: 'groundFloors', label: '지상층', valueType: 'number' },
    { fieldKey: 'completionDate', label: '사용승인일', valueType: 'date' },
    { fieldKey: 'buildingCoverageRate', label: '건폐율', valueType: 'number' },
    { fieldKey: 'floorAreaRatio', label: '용적률', valueType: 'number' },
    { fieldKey: 'parkingOfficial', label: '공부상 주차대수', valueType: 'number' },
    { fieldKey: 'totalFloorAreaSqm', label: '연면적(㎡)', valueType: 'number' },
  ],
  land_register: [
    { fieldKey: 'address', label: '소재지', valueType: 'text' },
    { fieldKey: 'landAreaSqm', label: '대지면적(㎡)', valueType: 'number' },
  ],
  land_use_plan: [
    { fieldKey: 'address', label: '소재지', valueType: 'text' },
    { fieldKey: 'zoning', label: '용도지역', valueType: 'text' },
  ],
  registry: [
    { fieldKey: 'address', label: '소재지', valueType: 'text' },
    { fieldKey: 'buildingName', label: '건물명', valueType: 'text' },
  ],
  cadastral_map: [
    { fieldKey: 'address', label: '소재지', valueType: 'text' },
    { fieldKey: 'landAreaSqm', label: '대지면적(㎡)', valueType: 'number' },
  ],
  lease_status: [
    { fieldKey: 'deposit', label: '보증금', valueType: 'number' },
    { fieldKey: 'monthlyRent', label: '월세', valueType: 'number' },
    { fieldKey: 'occupancyStatus', label: '임대·명도 현황', valueType: 'text' },
  ],
  appraisal: [
    { fieldKey: 'salePrice', label: '평가/기준 금액', valueType: 'number' },
    { fieldKey: 'landAreaSqm', label: '대지면적(㎡)', valueType: 'number' },
    { fieldKey: 'totalFloorAreaSqm', label: '연면적(㎡)', valueType: 'number' },
  ],
};

const numericKeys = new Set<keyof Property>([
  'salePrice', 'deposit', 'monthlyRent', 'landAreaPyeong', 'landAreaSqm', 'totalFloorAreaPyeong', 'totalFloorAreaSqm',
  'buildingAreaPyeong', 'basementFloors', 'groundFloors', 'buildingCoverageRate', 'floorAreaRatio', 'parkingSpaces',
  'parkingOfficial', 'parkingField',
]);

const fingerprint = (fieldKey: keyof Property, value: unknown) => `${String(fieldKey)}:${JSON.stringify(value)}`;
const normalizedComparable = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;
const sameValue = (left: unknown, right: unknown) => JSON.stringify(normalizedComparable(left)) === JSON.stringify(normalizedComparable(right));
const sqmToPyeong = (value: number) => Math.round((value / 3.305785) * 100) / 100;

function derivedAreaField(fieldKey: keyof Property, value: unknown): { fieldKey: keyof Property; value: number } | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (fieldKey === 'landAreaSqm') return { fieldKey: 'landAreaPyeong', value: sqmToPyeong(value) };
  if (fieldKey === 'totalFloorAreaSqm') return { fieldKey: 'totalFloorAreaPyeong', value: sqmToPyeong(value) };
  return undefined;
}

export const documentExtractionService = {
  fieldsFor(documentType: DocumentType): DocumentFieldDefinition[] {
    return DOCUMENT_FIELD_MAP[documentType] ?? [];
  },

  parseValue(fieldKey: keyof Property, rawValue: string): unknown {
    const value = rawValue.trim();
    if (!value) return '';
    if (numericKeys.has(fieldKey)) {
      const numeric = Number(value.replace(/[,\s원㎡%평]/g, ''));
      if (!Number.isFinite(numeric)) throw new Error('숫자 형식을 확인해 주세요.');
      return numeric;
    }
    if (fieldKey === 'negotiable' || fieldKey === 'internalPhotoAllowed') {
      return /^(예|y|yes|true|1|가능)$/i.test(value);
    }
    return value;
  },

  async queueExtractedFields(document: PropertyDocument, fields: ExtractedDocumentField[]): Promise<number> {
    const allowed = new Set(this.fieldsFor(document.documentType).map((field) => field.fieldKey));
    const [bundle, property] = await Promise.all([
      propertyDataRoomService.getBundle(document.propertyId),
      propertyRepository.getById(document.propertyId),
    ]);
    if (!property) throw new Error('검증 후보를 생성할 물건을 찾을 수 없습니다.');

    const active = new Set(bundle.verificationCandidates
      .filter((candidate) => candidate.decisionStatus === 'pending' || candidate.decisionStatus === 'held')
      .map((candidate) => fingerprint(candidate.fieldKey as keyof Property, candidate.candidateValue)));

    let queued = 0;
    const queueCandidate = async (fieldKey: keyof Property, candidateValue: unknown, confidence?: number, calculated = false) => {
      if (sameValue(property[fieldKey], candidateValue)) return;
      const keyFingerprint = fingerprint(fieldKey, candidateValue);
      if (active.has(keyFingerprint)) return;
      await propertyDataRoomService.createVerificationCandidate(document.propertyId, {
        fieldKey,
        candidateValue,
        sourceType: calculated ? 'calculated' : officialDocumentType(document.documentType) ? 'official_document' : 'external',
        sourceName: calculated ? `${document.title} 면적 환산` : document.title,
        sourceReference: document.id,
        sourceDate: document.issuedAt,
        confidence,
        note: calculated
          ? `${String(fieldKey)} 자동 환산 후보 — 원문 면적 승인 전 Property 미변경`
          : `${document.documentType} 추출 후보 — 사용자 승인 전 Property 미변경`,
      });
      active.add(keyFingerprint);
      queued += 1;
    };

    for (const field of fields) {
      if (!allowed.has(field.fieldKey)) continue;
      const rawValue = field.rawValue.trim();
      if (!rawValue) continue;
      const candidateValue = field.candidateValue ?? this.parseValue(field.fieldKey, rawValue);
      await queueCandidate(field.fieldKey, candidateValue, field.confidence);

      const derived = derivedAreaField(field.fieldKey, candidateValue);
      if (derived) await queueCandidate(derived.fieldKey, derived.value, field.confidence, true);
    }
    return queued;
  },
};

function officialDocumentType(type: DocumentType) {
  return ['building_register', 'land_register', 'land_use_plan', 'registry', 'cadastral_map'].includes(type);
}
