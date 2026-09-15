import type { PropertyDataSource, PropertySpace, PropertyVerification } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { comparableTransactionService, type ComparableTransactionInput } from './comparableTransactionService';

const PROPERTY_ID = 'daon-bangbae-815-11';
const BUILDING_SOURCE_ID = 'bangbae-815-11-building-register-source';
const BUILDING_SOURCE_NAME = '방배동 815-11 건축물대장';
const BUILDING_SOURCE_REFERENCE = '방배동 815-11 건축물대장.pdf';
const COMPARABLE_SOURCE_ID = `market-comparables:${PROPERTY_ID}`;

const floorSeed = [
  { floor: '3F', name: '주택', spaceType: 'residential' as const, areaSqm: 81.98 },
  { floor: '2F', name: '주택', spaceType: 'residential' as const, areaSqm: 81.98 },
  { floor: '1F', name: '제2종근린생활시설(부동산중개업소) + 점포', spaceType: 'retail' as const, areaSqm: 81.98 },
  { floor: 'B1', name: '다가구용단독주택(1가구)', spaceType: 'residential' as const, areaSqm: 103.14 },
] satisfies Array<Pick<PropertySpace, 'floor' | 'name' | 'spaceType' | 'areaSqm'>>;

const comparableSeed: ComparableTransactionInput[] = [
  { label: '방배동 811-20', salePrice: 4_500_000_000, landAreaPyeong: 56.29, landUnitPrice: 79_050_000, approvalYear: 1986, tradeDate: '2025-11-25' },
  { label: '방배동 2112', salePrice: 5_100_000_000, landAreaPyeong: 59.89, landUnitPrice: 85_160_000, approvalYear: 1989, tradeDate: '2025-10-24' },
  { label: '방배동 811-19', salePrice: 4_100_000_000, landAreaPyeong: 69.09, landUnitPrice: 58_620_000, approvalYear: 1985, tradeDate: '2025-11-25' },
  { label: '유한빌딩 882-25', salePrice: 4_200_000_000, landAreaPyeong: 58.89, landUnitPrice: 70_810_000, approvalYear: 1992, tradeDate: '2026-06-02' },
  { label: '더코너스톤 456-30', salePrice: 3_500_000_000, landAreaPyeong: 50.76, landUnitPrice: 68_950_000, approvalYear: 2022, tradeDate: '2025-11-18' },
  { label: '방배동 448-37', salePrice: 5_800_000_000, landAreaPyeong: 66, landUnitPrice: 87_880_000, approvalYear: 1987, tradeDate: '2026-02-13' },
];

function spaceId(floor: string) {
  return `bangbae-815-11-space-${floor.toLowerCase()}`;
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

    if (!spaces.length) {
      for (const seed of floorSeed) {
        const id = spaceId(seed.floor!);
        const fieldKey = floorFieldKey(id);
        const space: PropertySpace = {
          id,
          propertyId: PROPERTY_ID,
          name: seed.name,
          spaceType: seed.spaceType,
          floor: seed.floor,
          areaSqm: seed.areaSqm,
          currentCondition: '',
          recommendedUse: seed.name,
          sourceType: 'manual',
          verificationStatus: 'imported',
          createdAt: now,
          updatedAt: now,
        };
        const source: PropertyDataSource = {
          id: `${BUILDING_SOURCE_ID}-${seed.floor!.toLowerCase()}`,
          propertyId: PROPERTY_ID,
          fieldKey,
          resourceType: 'property_space',
          sourceType: 'official_document',
          sourceName: BUILDING_SOURCE_NAME,
          sourceReference: BUILDING_SOURCE_REFERENCE,
          collectedAt: now,
          verificationStatus: 'imported',
          metadata: {
            spaceId: id,
            floor: seed.floor,
            officialUse: seed.name,
            areaSqm: seed.areaSqm,
            bootstrap: true,
          },
          createdAt: now,
        };
        const verification: PropertyVerification = {
          id: `verification:${id}`,
          propertyId: PROPERTY_ID,
          fieldKey,
          status: 'imported',
          note: `${BUILDING_SOURCE_NAME} 기재사항 초기 연결. 원본 문서 검증 시 verified/confirmed로 승격합니다.`,
          createdAt: now,
          updatedAt: now,
        };
        await propertyDataRoomRepository.saveSpace(space);
        if (!sources.some((item) => item.id === source.id)) await propertyDataRoomRepository.saveDataSource(source);
        if (!verifications.some((item) => item.id === verification.id)) await propertyDataRoomRepository.saveVerification(verification);
      }
    }

    if (!sources.some((item) => item.id === COMPARABLE_SOURCE_ID)) {
      await comparableTransactionService.replace(PROPERTY_ID, comparableSeed, {
        sourceName: '방배동 실거래사례 1년간',
        sourceReference: '방배동 실거래사례1년간.pdf',
        verificationStatus: 'imported',
      });
    }
  },
};
