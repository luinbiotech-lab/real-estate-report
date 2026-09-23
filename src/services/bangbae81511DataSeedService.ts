import type { PropertyDataSource, PropertySpace, PropertyVerification } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { comparableTransactionService, type ComparableTransactionInput } from './comparableTransactionService';

const PROPERTY_ID = 'daon-bangbae-815-11';
const BUILDING_SOURCE_ID = 'bangbae-815-11-building-register-source';
const BUILDING_SOURCE_NAME = '방배동 815-11 건축물대장';
const BUILDING_SOURCE_REFERENCE = '방배동 815-11 건축물대장.pdf';
const COMPARABLE_SOURCE_ID = `market-comparables:${PROPERTY_ID}`;
const SOURCE_DOCUMENT_INVENTORY: Array<{
  id: string;
  sourceName: string;
  sourceReference?: string;
  resourceType: 'source_document_inventory';
  documentType: string;
  sourceDate?: string;
  originalSourcePresence: 'confirmed' | 'unconfirmed';
  sourceReviewed: boolean;
}> = [
  {
    id: 'bangbae-815-11-building-register-inventory',
    sourceName: '방배동 815-11 건축물대장',
    sourceReference: '방배동 815-11 건축물대장.pdf',
    resourceType: 'source_document_inventory',
    documentType: 'building_register',
    sourceDate: '2026-09-02',
    originalSourcePresence: 'confirmed',
    sourceReviewed: true,
  },
  {
    id: 'bangbae-815-11-land-registry-inventory',
    sourceName: '방배동 815-11 토지등기부',
    sourceReference: '방배동815-11 토지등기부.pdf',
    resourceType: 'source_document_inventory',
    documentType: 'registry_land',
    sourceDate: '2026-09-02',
    originalSourcePresence: 'confirmed',
    sourceReviewed: true,
  },
  {
    id: 'bangbae-815-11-building-registry-inventory',
    sourceName: '방배동 815-11 건물등기부',
    sourceReference: '방배동 815-11 건물등기부.pdf',
    resourceType: 'source_document_inventory',
    documentType: 'registry_building',
    sourceDate: '2026-09-02',
    originalSourcePresence: 'confirmed',
    sourceReviewed: true,
  },
  {
    id: 'bangbae-815-11-land-register-inventory',
    sourceName: '방배동 815-11 토지대장',
    resourceType: 'source_document_inventory',
    documentType: 'land_register',
    originalSourcePresence: 'unconfirmed',
    sourceReviewed: false,
  },
  {
    id: 'bangbae-815-11-land-use-plan-inventory',
    sourceName: '방배동 815-11 토지이용계획확인서',
    resourceType: 'source_document_inventory',
    documentType: 'land_use_plan',
    originalSourcePresence: 'unconfirmed',
    sourceReviewed: false,
  },
  {
    id: 'bangbae-815-11-cadastral-map-inventory',
    sourceName: '방배동 815-11 지적도',
    resourceType: 'source_document_inventory',
    documentType: 'cadastral_map',
    originalSourcePresence: 'unconfirmed',
    sourceReviewed: false,
  },
];

const EXTERIOR_MEDIA_EVIDENCE_ID = 'bangbae-815-11-exterior-report-evidence';
const EXTERIOR_MEDIA_EVIDENCE_REFERENCE = '방배동_815-11_DAON_ASSET_세부보고서_전면재작성.pdf';

const BUILDING_SOURCE_DATE = '2026-09-02';
const BUILDING_ID = '2120041230002444';
const BUILDING_UNIQUE_NO = '1165010100-1-08150011';
const BUILDING_ROAD_ADDRESS = '서울특별시 서초구 동광로18길 7 (방배동)';

const floorSeed = [
  { key: '3f', floor: '3F', name: '주택', spaceType: 'residential' as const, areaSqm: 81.98 },
  { key: '2f', floor: '2F', name: '주택', spaceType: 'residential' as const, areaSqm: 81.98 },
  { key: '1f', floor: '1F', name: '제2종근린생활시설(부동산중개업소)', spaceType: 'retail' as const, areaSqm: 40.99 },
  { key: '1f-shop', floor: '1F', name: '점포', spaceType: 'retail' as const, areaSqm: 40.99 },
  { key: 'b1', floor: 'B1', name: '다가구용단독주택(1가구)', spaceType: 'residential' as const, areaSqm: 103.14 },
] satisfies Array<Pick<PropertySpace, 'floor' | 'name' | 'spaceType' | 'areaSqm'> & { key: string }>;

const comparableSeed: ComparableTransactionInput[] = [
  { label: '방배동 811-20', sourceRow: 11, sourceRecordLabel: '방배동 811-20', salePrice: 4_500_000_000, landAreaPyeong: 56.29, landUnitPrice: 79_050_000, approvalYear: 1986, tradeDate: '2025-11-25' },
  { label: '방배동 2112', sourceRow: 10, sourceRecordLabel: '방배동 2112', salePrice: 5_100_000_000, landAreaPyeong: 59.89, landUnitPrice: 85_160_000, approvalYear: 1989, tradeDate: '2025-10-24' },
  { label: '방배동 811-19', sourceRow: 13, sourceRecordLabel: '방배동 811-19', salePrice: 4_100_000_000, landAreaPyeong: 69.09, landUnitPrice: 58_620_000, approvalYear: 1985, tradeDate: '2025-11-25' },
  { label: '유한빌딩 882-25', sourceRow: 12, sourceRecordLabel: '유한빌딩', salePrice: 4_200_000_000, landAreaPyeong: 58.89, landUnitPrice: 70_810_000, approvalYear: 1992, tradeDate: '2026-06-02' },
  { label: '더코너스톤 456-30', sourceRow: 14, sourceRecordLabel: '주식회사더코너스톤', salePrice: 3_500_000_000, landAreaPyeong: 50.76, landUnitPrice: 68_950_000, approvalYear: 2022, tradeDate: '2025-11-18' },
  { label: '방배동 448-37', sourceRow: 9, sourceRecordLabel: '방배동 448-37', salePrice: 5_800_000_000, landAreaPyeong: 66, landUnitPrice: 87_880_000, approvalYear: 1987, tradeDate: '2026-02-13' },
];

function spaceId(key: string) {
  return `bangbae-815-11-space-${key}`;
}

function floorFieldKey(id: string) {
  return `space:${id}`;
}

export const bangbae81511DataSeedService = {
  async ensure() {
    const [spaces, sources, verifications] = await Promise.all([
      propertyDataRoomRepository.getSpaces(PROPERTY_ID),
      propertyDataRoomRepository.getDataSources(PROPERTY_ID),
      propertyDataRoomRepository.getVerifications(PROPERTY_ID),
    ]);
    const now = new Date().toISOString();

    for (const seed of floorSeed) {
      const id = spaceId(seed.key);
      const fieldKey = floorFieldKey(id);
      const existingSpace = spaces.find((space) => space.id === id);
      const existingSource = sources.find((item) => item.id === `${BUILDING_SOURCE_ID}-${seed.key}`);
      const existingVerification = verifications.find((item) => item.id === `verification:${id}`);
      const space: PropertySpace = {
        ...existingSpace,
        id,
        propertyId: PROPERTY_ID,
        name: seed.name,
        spaceType: seed.spaceType,
        floor: seed.floor,
        areaSqm: seed.areaSqm,
        currentCondition: existingSpace?.currentCondition ?? '',
        recommendedUse: existingSpace?.recommendedUse || seed.name,
        sourceType: 'manual',
        verificationStatus: 'verified',
        createdAt: existingSpace?.createdAt ?? now,
        updatedAt: now,
      };
      const source: PropertyDataSource = {
        id: `${BUILDING_SOURCE_ID}-${seed.key}`,
        propertyId: PROPERTY_ID,
        fieldKey,
        resourceType: 'property_space',
        sourceType: 'official_document',
        sourceName: BUILDING_SOURCE_NAME,
        sourceReference: BUILDING_SOURCE_REFERENCE,
        collectedAt: existingSource?.collectedAt ?? now,
        sourceDate: BUILDING_SOURCE_DATE,
        verificationStatus: 'verified',
        metadata: {
          spaceId: id,
          floor: seed.floor,
          officialUse: seed.name,
          areaSqm: seed.areaSqm,
          buildingId: BUILDING_ID,
          uniqueNumber: BUILDING_UNIQUE_NO,
          roadAddress: BUILDING_ROAD_ADDRESS,
          issueDate: BUILDING_SOURCE_DATE,
          bootstrap: true,
          sourceVerified: true,
        },
        createdAt: existingSource?.createdAt ?? now,
      };
      const verification: PropertyVerification = {
        id: `verification:${id}`,
        propertyId: PROPERTY_ID,
        fieldKey,
        status: 'verified',
        note: `${BUILDING_SOURCE_NAME} 원본(${BUILDING_SOURCE_DATE} 발급) 대조 완료 · 건물ID ${BUILDING_ID}`,
        verifiedBy: 'source_document_review',
        verifiedAt: existingVerification?.verifiedAt ?? now,
        createdAt: existingVerification?.createdAt ?? now,
        updatedAt: now,
      };
      await propertyDataRoomRepository.saveSpace(space);
      await propertyDataRoomRepository.saveDataSource(source);
      await propertyDataRoomRepository.saveVerification(verification);
    }

    for (const inventory of SOURCE_DOCUMENT_INVENTORY) {
      const existing = sources.find((item) => item.id === inventory.id);
      const existingMetadata = existing?.metadata ?? {};
      const existingPresence = existingMetadata.originalSourcePresence === 'confirmed'
        ? 'confirmed'
        : existingMetadata.originalSourcePresence === 'unconfirmed'
          ? 'unconfirmed'
          : undefined;
      const originalSourcePresence = inventory.originalSourcePresence === 'confirmed' || existingPresence === 'confirmed'
        ? 'confirmed'
        : 'unconfirmed';
      const binaryStorageStatus = existingMetadata.binaryStorageStatus === 'connected' ? 'connected' : 'not_connected';
      const sourceReviewed = inventory.sourceReviewed || existingMetadata.sourceReviewed === true;
      const existingNote = typeof existingMetadata.note === 'string' ? existingMetadata.note : '';
      const source: PropertyDataSource = {
        id: inventory.id,
        propertyId: PROPERTY_ID,
        fieldKey: `source_inventory:${inventory.documentType}`,
        resourceType: inventory.resourceType,
        sourceType: 'official_document',
        sourceName: inventory.sourceName,
        sourceReference: existing?.sourceReference || inventory.sourceReference,
        collectedAt: existing?.collectedAt ?? now,
        sourceDate: existing?.sourceDate ?? inventory.sourceDate,
        verificationStatus: existing?.verificationStatus === 'verified'
          ? 'verified'
          : originalSourcePresence === 'confirmed'
            ? 'confirmed'
            : 'missing',
        metadata: {
          ...existingMetadata,
          documentType: inventory.documentType,
          originalSourcePresence,
          binaryStorageStatus,
          storagePath: existingMetadata.storagePath ?? null,
          sourceReviewed,
          note: existingNote || (originalSourcePresence === 'confirmed'
            ? '원본 파일 존재는 확인했으나 private Storage 문서 asset으로는 아직 연결하지 않았습니다.'
            : '현재 Project/Library에서 원본 존재를 확인하지 못했습니다. 부재로 단정하지 않고 최신 공식 원본 확보가 필요합니다.'),
        },
        createdAt: existing?.createdAt ?? now,
      };
      await propertyDataRoomRepository.saveDataSource(source);
    }

    const exteriorEvidence = sources.find((item) => item.id === EXTERIOR_MEDIA_EVIDENCE_ID);
    const exteriorMetadata = exteriorEvidence?.metadata ?? {};
    await propertyDataRoomRepository.saveDataSource({
      id: EXTERIOR_MEDIA_EVIDENCE_ID,
      propertyId: PROPERTY_ID,
      fieldKey: 'exteriorMediaEvidence',
      resourceType: 'exterior_photo_embedded_report_evidence',
      sourceType: 'external',
      sourceName: '기존 DA:ON 상세보고서 외관 사진 증거',
      sourceReference: exteriorEvidence?.sourceReference || EXTERIOR_MEDIA_EVIDENCE_REFERENCE,
      collectedAt: exteriorEvidence?.collectedAt ?? now,
      verificationStatus: exteriorEvidence?.verificationStatus === 'verified' ? 'verified' : 'confirmed',
      metadata: {
        ...exteriorMetadata,
        sourcePages: [1, 3],
        evidenceType: 'embedded_exterior_photo',
        directMediaAssetConnected: exteriorMetadata.directMediaAssetConnected === true,
        privateStorageStatus: exteriorMetadata.privateStorageStatus === 'connected' ? 'connected' : 'not_connected',
        sellerPolicy: 'exterior_only',
        interiorMediaExcluded: true,
        note: typeof exteriorMetadata.note === 'string' && exteriorMetadata.note
          ? exteriorMetadata.note
          : '기존 보고서 1·3페이지에서 방배동 815-11 외관 사진을 확인했으나 원본/파생 이미지 asset은 아직 private Storage에 연결되지 않았습니다.',
      },
      createdAt: exteriorEvidence?.createdAt ?? now,
    });

    const comparableSource = sources.find((item) => item.id === COMPARABLE_SOURCE_ID);
    if (!comparableSource || (
      comparableSource.sourceReference === '방배동 실거래사례1년간.pdf' &&
      comparableSource.verificationStatus !== 'verified'
    )) {
      await comparableTransactionService.replace(PROPERTY_ID, comparableSeed, {
        sourceName: '방배동 실거래사례 1년간',
        sourceReference: '방배동 실거래사례1년간.pdf',
        verificationStatus: 'verified',
      });
    }
  },
};
