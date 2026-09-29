import type { Property } from '../types';
import type { PropertyDataSource, PropertyVerification } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';

const SOURCE_PREFIX = 'streetview-verification:';
const VERIFICATION_PREFIX = 'verification:streetview:';

export async function ensureStreetViewProvenance(property: Property) {
  const verification = property.streetViewVerification;
  if (!verification?.provider || !verification.panoId || !verification.checkedAt) return undefined;

  const now = new Date().toISOString();
  const sourceId = `${SOURCE_PREFIX}${property.id}`;
  const verificationId = `${VERIFICATION_PREFIX}${property.id}`;
  const sources = await propertyDataRoomRepository.getDataSources(property.id);
  const verifications = await propertyDataRoomRepository.getVerifications(property.id);
  const existingSource = sources.find((item) => item.id === sourceId);
  const existingVerification = verifications.find((item) => item.id === verificationId);
  const providerName = verification.provider === 'kakao' ? 'Kakao Roadview' : verification.provider;

  const source: PropertyDataSource = {
    id: sourceId,
    propertyId: property.id,
    fieldKey: 'streetViewVerification',
    resourceType: 'exterior_streetview_verification',
    sourceType: 'map_provider',
    sourceName: providerName,
    sourceReference: `${verification.provider}:pano:${verification.panoId}`,
    collectedAt: verification.checkedAt,
    sourceDate: verification.photoDate,
    verificationStatus: 'confirmed',
    metadata: {
      provider: verification.provider,
      panoId: verification.panoId,
      photoDate: verification.photoDate,
      checkedAt: verification.checkedAt,
      evidenceKind: 'interactive_street_view',
      reportImageAsset: false,
      note: '거리뷰 Human Review 기록이며 직접 촬영 대표사진 asset을 대체하지 않습니다.',
    },
    createdAt: existingSource?.createdAt ?? now,
  };

  const row: PropertyVerification = {
    id: verificationId,
    propertyId: property.id,
    fieldKey: 'streetViewVerification',
    status: 'confirmed',
    note: `${providerName} panoId ${verification.panoId} 외관 Human Review 확인. 대표사진 asset은 별도 연결 필요.`,
    verifiedBy: 'human_streetview_review',
    verifiedAt: verification.checkedAt,
    createdAt: existingVerification?.createdAt ?? now,
    updatedAt: now,
  };

  await propertyDataRoomRepository.saveDataSource(source);
  await propertyDataRoomRepository.saveVerification(row);
  return { source, verification: row };
}

export const streetViewProvenanceService = { ensure: ensureStreetViewProvenance };
