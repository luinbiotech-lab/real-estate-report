import type { DataRoomBundle, DocumentType, VerificationStatus } from '../../domain/propertyDataRoom/types';
import type { ProfessionalReportMedia, ProfessionalReportViewModel, ReportValue } from '../../domain/professionalReport/types';
import { numericReportValue, reportValue } from '../../domain/professionalReport/valuePolicy';
import { calculateUnitPrice, roundArea, sqmToPyeong, pyeongToSqm } from '../../domain/professionalReport/calculations';
import { REQUIRED_DOCUMENT_TYPES } from '../../domain/propertyDataRoom/labels';
import { propertyDataRoomRepository } from '../../repositories/propertyDataRoomRepository';
import { propertyRepository } from '../../repositories/propertyRepository';
import type { Property } from '../../types';
import { internalPhotoAllowed } from '../../domain/professionalReport/reportAccessPolicy';
import { DAON_DETAIL_MASTER_TEMPLATE_ID, DAON_DETAIL_MASTER_TEMPLATE_VERSION } from '../../domain/professionalReport/templateIds';
import { formatNullableArea, formatNullableNumber, formatNullableWon } from '../../utils/format';

export const REPORT_ENGINE_VERSION = 'report-engine-1';
export const PROFESSIONAL_REPORT_TEMPLATE_ID = DAON_DETAIL_MASTER_TEMPLATE_ID;
export const PROFESSIONAL_REPORT_TEMPLATE_VERSION = DAON_DETAIL_MASTER_TEMPLATE_VERSION;

type BuilderOptions = { generatedAt?: string; templateId?: string; templateVersion?: string };
const emptyCounts = <T extends string>(keys: T[]) => Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;

function mediaItems(property: Property, bundle: DataRoomBundle): ProfessionalReportMedia[] {
  const items: ProfessionalReportMedia[] = [];
  const allowInternal = internalPhotoAllowed(property);

  // Property.mainImage is the curated representative image used by the locked MASTER.
  // Do not blank it merely because interior photos are forbidden; the current Bangbae MASTER uses an exterior hero image.
  if (property.mainImage) items.push({ id: 'property-main', category: 'main', url: property.mainImage, caption: '대표사진', isPrimary: true, verificationStatus: 'confirmed' });

  // Legacy additionalImages have no category metadata, so exclude them for restricted properties rather than risk interior-photo leakage.
  if (allowInternal) property.additionalImages.filter(Boolean).forEach((url, index) => items.push({ id: `property-additional-${index}`, category: 'additional', url, caption: `추가사진 ${index + 1}`, isPrimary: false, verificationStatus: 'confirmed' }));

  if (property.mapImage) items.push({ id: 'property-map', category: 'map', url: property.mapImage, caption: '위치지도', isPrimary: false, verificationStatus: 'imported' });
  if (property.locationAnalysisImage) items.push({ id: 'property-location-analysis', category: 'location_analysis', url: property.locationAnalysisImage, caption: '입지분석 이미지', isPrimary: false, verificationStatus: 'confirmed' });

  for (const media of bundle.media) {
    if (!allowInternal && media.category === 'interior') continue;
    items.push({ id: media.id, category: media.category, url: media.url ?? null, caption: media.caption || media.fileName, isPrimary: media.isPrimary, verificationStatus: media.verificationStatus });
  }
  return items;
}

function collectValues(input: unknown, path = '', result: Array<{ path: string; value: ReportValue<unknown> }> = []) {
  if (!input || typeof input !== 'object') return result;
  const candidate = input as Partial<ReportValue<unknown>>;
  if (typeof candidate.state === 'string' && typeof candidate.display === 'string' && Array.isArray(candidate.sourceIds)) {
    result.push({ path, value: candidate as ReportValue<unknown> }); return result;
  }
  for (const [key, value] of Object.entries(input)) collectValues(value, path ? `${path}.${key}` : key, result);
  return result;
}

export function buildProfessionalReportViewModel(property: Property, bundle: DataRoomBundle, options: BuilderOptions = {}): ProfessionalReportViewModel {
  const verifications = bundle.verifications; const sources = bundle.dataSources;
  const context = (fieldKey: string, extra: Partial<Parameters<typeof reportValue>[1]> = {}) => ({ fieldKey, verifications, sources, ...extra });
  const text = (fieldKey: keyof Property, disconnected = false) => reportValue(String(property[fieldKey] ?? '').trim(), context(String(fieldKey), { disconnected }));
  const number = (fieldKey: keyof Property, formatter?: (value: number) => string) => numericReportValue(property[fieldKey] as number | undefined, context(String(fieldKey), { formatter: formatter as (value: never) => string }));

  const storedLandPyeong = property.landAreaPyeong > 0 ? property.landAreaPyeong : null;
  const storedLandSqm = property.landAreaSqm > 0 ? property.landAreaSqm : null;
  const landPyeong = storedLandPyeong ?? roundArea(sqmToPyeong(storedLandSqm));
  const landSqm = storedLandSqm ?? roundArea(pyeongToSqm(storedLandPyeong));
  const landPyeongCalculated = !storedLandPyeong && landPyeong !== null;
  const landSqmCalculated = !storedLandSqm && landSqm !== null;
  const unitPrice = calculateUnitPrice(property.salePrice, landPyeong);
  const allowInternal = internalPhotoAllowed(property);
  const media = mediaItems(property, bundle);

  const identity = {
    id: property.id, propertyNumber: text('propertyNumber'), name: text('name'), buildingName: text('buildingName'),
    tradeType: text('tradeType'), address: text('address'), detailAddress: text('detailAddress'),
    managerName: text('managerName'), managerPhone: text('managerPhone'), managerEmail: text('managerEmail'), companyName: text('companyName'),
  };
  const pricing = {
    salePrice: number('salePrice', formatNullableWon), deposit: number('deposit', formatNullableWon), monthlyRent: number('monthlyRent', formatNullableWon),
    landUnitPrice: numericReportValue(unitPrice, context('landUnitPrice', { calculated: unitPrice !== null, formatter: formatNullableWon as (value: never) => string })),
    negotiable: reportValue(property.negotiable, context('negotiable', { formatter: ((value: boolean) => value ? '협의 가능' : '협의 없음') as (value: never) => string })),
    occupancyStatus: text('occupancyStatus'),
  };
  const building = {
    totalFloorAreaSqm: number('totalFloorAreaSqm', (value) => formatNullableArea(value, '㎡')),
    totalFloorAreaPyeong: number('totalFloorAreaPyeong', (value) => formatNullableArea(value, '평')),
    buildingAreaPyeong: number('buildingAreaPyeong', (value) => formatNullableArea(value, '평')),
    mainUse: text('mainUse'), structure: text('structure'), basementFloors: number('basementFloors', (value) => formatNullableNumber(value, '층')),
    groundFloors: number('groundFloors', (value) => formatNullableNumber(value, '층')), completionDate: text('completionDate'),
    buildingCoverageRate: number('buildingCoverageRate', (value) => formatNullableNumber(value, '%')),
    floorAreaRatio: number('floorAreaRatio', (value) => formatNullableNumber(value, '%')), elevator: text('elevator'),
    parkingSpaces: number('parkingSpaces', (value) => formatNullableNumber(value, '대')),
  };
  const land = {
    landAreaSqm: numericReportValue(landSqm, context('landAreaSqm', { calculated: landSqmCalculated, formatter: ((value: number) => formatNullableArea(value, '㎡')) as (value: never) => string })),
    landAreaPyeong: numericReportValue(landPyeong, context('landAreaPyeong', { calculated: landPyeongCalculated, formatter: ((value: number) => formatNullableArea(value, '평')) as (value: never) => string })),
    zoning: text('zoning'), roadCondition: text('roadCondition'),
  };
  const location = {
    latitude: numericReportValue(property.latitude, context('latitude')), longitude: numericReportValue(property.longitude, context('longitude')),
    nearbyStation: text('nearbyStation'), stationDistance: text('stationDistance'), locationAnalysis: text('locationAnalysis'),
    briefingItems: reportValue(property.briefingItems ?? [], context('briefingItems', { disconnected: !property.briefingItems })),
  };
  const mediaGroup = {
    mainImage: reportValue(property.mainImage, context('mainImage', { disconnected: false })),
    mapImage: reportValue(property.mapImage, context('mapImage', { disconnected: !property.latitude || !property.longitude })),
    locationAnalysisImage: reportValue(property.locationAnalysisImage, context('locationAnalysisImage')),
    additionalImages: reportValue(allowInternal ? property.additionalImages ?? [] : [], context('additionalImages')),
    items: media,
    internalPhotoAllowed: allowInternal,
  };
  const documents = {
    items: bundle.documents.map((document) => ({ id: document.id, documentType: document.documentType, title: document.title, originalFileName: document.originalFileName, sourceName: document.sourceName, issuedAt: document.issuedAt ?? null, uploadedAt: document.uploadedAt, verificationStatus: document.verificationStatus, version: document.version })),
    count: bundle.documents.length, verifiedCount: bundle.documents.filter((document) => document.verificationStatus === 'verified').length,
  };
  const digitalTwin = { connected: bundle.digitalTwinAssets.length > 0, count: bundle.digitalTwinAssets.length, readyCount: bundle.digitalTwinAssets.filter((asset) => asset.processingStatus === 'ready').length };
  const verificationCounts = emptyCounts<VerificationStatus>(['verified', 'confirmed', 'imported', 'calculated', 'estimated', 'ai_analysis', 'unverified', 'missing']);
  bundle.verifications.forEach((item) => { verificationCounts[item.status] += 1; });
  bundle.documents.forEach((item) => { verificationCounts[item.verificationStatus] += 1; });
  bundle.dataSources.forEach((item) => { verificationCounts[item.verificationStatus] += 1; });
  const verification = { items: bundle.verifications.map((item) => ({ fieldKey: item.fieldKey, status: item.status, note: item.note, verifiedAt: item.verifiedAt ?? null })), counts: verificationCounts };
  const investment = {
    features: text('features'), investmentPoints: text('investmentPoints'), developmentPlan: text('developmentPlan'),
    recommendedUse: text('recommendedUse'), nearbyTransactions: text('nearbyTransactions'), overallOpinion: text('overallOpinion'),
  };
  const risks = { risks: text('risks') };
  const sourceItems = bundle.dataSources.map((source) => ({ id: source.id, fieldKey: source.fieldKey ?? null, resourceType: source.resourceType ?? null, sourceType: source.sourceType, sourceName: source.sourceName, sourceReference: source.sourceReference ?? null, collectedAt: source.collectedAt, sourceDate: source.sourceDate ?? null, confidence: source.confidence ?? null, verificationStatus: source.verificationStatus }));

  const partial = { identity, pricing, building, land, location, media: mediaGroup, investment, risks };
  const values = collectValues(partial);
  const qualityCounts = emptyCounts(['actual', 'missing', 'disconnected', 'estimated', 'calculated', 'ai_analysis', 'unverified'] as const);
  values.forEach(({ value }) => { qualityCounts[value.state] += 1; });
  const presentDocuments = new Set(bundle.documents.map((document) => document.documentType));
  const requiredDocumentsMissing = REQUIRED_DOCUMENT_TYPES.filter((type: DocumentType) => !presentDocuments.has(type));
  const dataQuality = {
    counts: qualityCounts,
    missingFields: values.filter(({ value }) => value.state === 'missing').map(({ path }) => path),
    disconnectedFields: values.filter(({ value }) => value.state === 'disconnected').map(({ path }) => path),
    requiredDocumentsMissing, reportReady: requiredDocumentsMissing.length === 0,
  };

  return {
    ...partial, documents, digitalTwin, verification, dataQuality, sources: { items: sourceItems, count: sourceItems.length },
    generated: {
      generatedAt: options.generatedAt ?? new Date().toISOString(),
      propertyUpdatedAt: property.updatedAt,
      engineVersion: REPORT_ENGINE_VERSION,
      templateId: options.templateId ?? PROFESSIONAL_REPORT_TEMPLATE_ID,
      templateVersion: options.templateVersion ?? PROFESSIONAL_REPORT_TEMPLATE_VERSION,
      dataPolicy: 'property-and-data-room-only',
    },
  };
}

export class ReportDataBuilder {
  constructor(private readonly now: () => string = () => new Date().toISOString()) {}

  async build(propertyId: string, options: Omit<BuilderOptions, 'generatedAt'> = {}): Promise<ProfessionalReportViewModel> {
    const [property, bundle] = await Promise.all([propertyRepository.getById(propertyId), propertyDataRoomRepository.getBundle(propertyId)]);
    if (!property) throw new Error('보고서를 생성할 물건을 찾을 수 없습니다.');
    return buildProfessionalReportViewModel(property, bundle, { ...options, generatedAt: this.now() });
  }
}

export const reportDataBuilder = new ReportDataBuilder();
