import type { PropertyDocument, PropertySpace, SpaceType, VerificationStatus } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';

export interface OfficialBuildingFloorInput {
  floor: string;
  officialUse: string;
  areaSqm: number;
  spaceType?: SpaceType;
}

const normalizedFloor = (floor: string) => floor.trim().toUpperCase().replace(/\s+/g, '');
const stableKey = (value: string) => encodeURIComponent(value).replace(/%/g, '').toLowerCase();

function inferSpaceType(officialUse: string): SpaceType {
  if (/주택|주거|다가구|다세대|아파트/i.test(officialUse)) return 'residential';
  if (/점포|근린생활|상가|판매|소매/i.test(officialUse)) return 'retail';
  if (/사무|업무|오피스/i.test(officialUse)) return 'office';
  if (/주차/i.test(officialUse)) return 'parking';
  if (/창고/i.test(officialUse)) return 'storage';
  if (/기계|전기실/i.test(officialUse)) return 'mechanical';
  return 'other';
}

function sourceStatus(document: PropertyDocument): VerificationStatus {
  return document.verificationStatus === 'verified' || document.verificationStatus === 'confirmed'
    ? document.verificationStatus
    : 'unverified';
}

export const buildingRegisterFloorService = {
  async saveOfficialFloorComposition(
    propertyId: string,
    document: PropertyDocument,
    floors: OfficialBuildingFloorInput[],
  ): Promise<PropertySpace[]> {
    if (document.propertyId !== propertyId) throw new Error('건축물대장과 물건 ID가 일치하지 않습니다.');
    if (document.documentType !== 'building_register') throw new Error('건축물대장 문서만 층별 구성 출처로 사용할 수 있습니다.');
    if (!floors.length) return [];

    const now = new Date().toISOString();
    const verificationStatus = sourceStatus(document);
    const saved: PropertySpace[] = [];

    for (const input of floors) {
      const floor = normalizedFloor(input.floor);
      const officialUse = input.officialUse.trim();
      if (!floor || !officialUse || !Number.isFinite(input.areaSqm) || input.areaSqm <= 0) {
        throw new Error(`층별 구성 값이 올바르지 않습니다: ${input.floor || '층 미지정'}`);
      }

      const spaceId = `official-floor:${stableKey(propertyId)}:${stableKey(document.id)}:${stableKey(floor)}`;
      const sourceId = `source:${spaceId}`;
      const verificationId = `verification:${spaceId}`;
      const fieldKey = `space:${spaceId}`;
      const existing = (await propertyDataRoomRepository.getSpaces(propertyId)).find((item) => item.id === spaceId);
      const space: PropertySpace = {
        id: spaceId,
        propertyId,
        name: officialUse,
        spaceType: input.spaceType ?? inferSpaceType(officialUse),
        floor,
        areaSqm: input.areaSqm,
        sourceType: 'manual',
        verificationStatus,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      await propertyDataRoomRepository.saveSpace(space);
      await propertyDataRoomRepository.saveDataSource({
        id: sourceId,
        propertyId,
        fieldKey,
        resourceType: 'property_space',
        sourceType: 'official_document',
        sourceName: document.title,
        sourceReference: document.id,
        collectedAt: document.uploadedAt || now,
        sourceDate: document.issuedAt,
        verificationStatus,
        metadata: {
          spaceId,
          floor,
          officialUse,
          areaSqm: input.areaSqm,
          documentId: document.id,
          documentType: document.documentType,
        },
        createdAt: now,
      });
      await propertyDataRoomRepository.saveVerification({
        id: verificationId,
        propertyId,
        fieldKey,
        status: verificationStatus,
        note: `건축물대장 층별 현황 확인: ${floor} · ${officialUse} · ${input.areaSqm}㎡`,
        verifiedAt: verificationStatus === 'verified' || verificationStatus === 'confirmed'
          ? document.verifiedAt ?? now
          : undefined,
        createdAt: now,
        updatedAt: now,
      });
      saved.push(space);
    }

    return saved;
  },
};
