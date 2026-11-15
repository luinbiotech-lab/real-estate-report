/*
 * Trust grade + public facts for one or many properties (2026-11-15 platform upgrade).
 * Reads the Data Room only; writes nothing. A property whose Data Room fails to load gets no grade (shown as
 * '등급 확인 불가'), never a guessed one.
 */
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { propertyDataRoomService } from './propertyDataRoomService';
import { factCompleteness } from '../domain/platform/publicListing';
import { trustGrade, type TrustGradeResult } from '../domain/platform/trustGrade';
import type { Property } from '../types';

export interface ListingTrust {
  propertyId: string;
  grade: TrustGradeResult;
  verifiedFieldKeys: Set<string>;
}

export async function loadListingTrust(property: Property): Promise<ListingTrust> {
  const bundle = await propertyDataRoomRepository.getBundle(property.id);
  const summary = propertyDataRoomService.summarize(property, bundle);
  const facts = factCompleteness(property);
  const verifiedFieldKeys = new Set(bundle.verifications
    .filter((row) => row.propertyId === property.id && row.status === 'verified')
    .map((row) => row.fieldKey));
  return {
    propertyId: property.id,
    verifiedFieldKeys,
    grade: trustGrade({
      factsFilled: facts.filled,
      factsTotal: facts.total,
      requiredSourcePresent: summary.requiredSourcePresent,
      requiredOfficiallyVerified: summary.requiredOfficiallyVerified,
      requiredDocumentTotal: summary.requiredDocumentTotal,
      verificationPending: summary.verificationPending,
    }),
  };
}

/** Grades for a list (bounded). Failures are left out of the map, so callers show '확인 불가' for them. */
export async function loadListingTrustMany(properties: Property[], limit = 200): Promise<Map<string, ListingTrust>> {
  const settled = await Promise.allSettled(properties.slice(0, limit).map(loadListingTrust));
  const map = new Map<string, ListingTrust>();
  for (const result of settled) if (result.status === 'fulfilled') map.set(result.value.propertyId, result.value);
  return map;
}
