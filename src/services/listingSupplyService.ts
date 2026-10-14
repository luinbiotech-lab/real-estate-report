import type { PropertyVerificationCandidate } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import type { ListingStatus, Property, TradeType } from '../types';

export type ListingObservationState = 'active' | 'inactive' | 'unknown';
export type ListingPropertyMatchLevel = 'exact_property' | 'exact_address_candidate' | 'address_candidate' | 'regional_candidate' | 'unmatched';

export interface ListingSupplyObservation {
  providerId: string;
  providerName: string;
  providerListingId: string;
  observedAt: string;
  state: ListingObservationState;
  matchLevel: ListingPropertyMatchLevel;
  matchConfidence?: number;
  sourceUrl?: string;
  address?: string;
  buildingName?: string;
  tradeType?: TradeType;
  askingPrice?: number;
  note?: string;
}

function safeId(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'unknown';
}

function canProposeExternalObserved(observation: ListingSupplyObservation) {
  return observation.state === 'active'
    && ['exact_property', 'exact_address_candidate'].includes(observation.matchLevel)
    && (observation.matchConfidence ?? 0) >= 0.9;
}

export const listingSupplyService = {
  async persistObservation(property: Property, observation: ListingSupplyObservation) {
    if (!observation.providerId.trim() || !observation.providerName.trim() || !observation.providerListingId.trim()) {
      throw new Error('매물 공급원/매물 ID가 필요합니다.');
    }
    if (!Number.isFinite(Date.parse(observation.observedAt))) throw new Error('매물 관측시점이 올바르지 않습니다.');

    const sourceId = `listing-supply:${safeId(observation.providerId)}:${safeId(observation.providerListingId)}:${property.id}`;
    await propertyDataRoomRepository.saveDataSource({
      id: sourceId,
      propertyId: property.id,
      fieldKey: 'listingStatus',
      resourceType: 'market_listing_observation',
      sourceType: 'market_data',
      sourceName: observation.providerName,
      sourceReference: observation.sourceUrl || observation.providerListingId,
      collectedAt: observation.observedAt,
      confidence: observation.matchConfidence,
      verificationStatus: 'imported',
      metadata: {
        ...observation,
        semantics: 'listing_observation_not_property_status_confirmation',
        propertyStatusAutoUpdated: false,
        offMarketConfirmed: false,
        explicitFields: [],
      },
      createdAt: observation.observedAt,
    });

    let candidate: PropertyVerificationCandidate | undefined;
    if (canProposeExternalObserved(observation) && (property.listingStatus || 'unknown') !== 'external_observed') {
      const existing = await propertyDataRoomRepository.getVerificationCandidates(property.id);
      const reference = observation.sourceUrl || observation.providerListingId;
      const duplicate = existing.some((item) =>
        item.fieldKey === 'listingStatus'
        && item.decisionStatus === 'pending'
        && item.candidateValue === 'external_observed'
        && item.sourceReference === reference
      );
      if (!duplicate) {
        candidate = {
          id: crypto.randomUUID(),
          propertyId: property.id,
          fieldKey: 'listingStatus',
          currentValue: property.listingStatus || 'unknown',
          candidateValue: 'external_observed' satisfies ListingStatus,
          sourceType: 'market_data',
          sourceName: observation.providerName,
          sourceReference: reference,
          confidence: observation.matchConfidence,
          decisionStatus: 'pending',
          note: '외부 공급원에서 활성 매물이 관측되었습니다. 동일 물건 여부를 검토한 뒤 매물상태에 반영합니다.',
          createdAt: observation.observedAt,
        };
        await propertyDataRoomRepository.saveVerificationCandidate(candidate);
      }
    }

    return { sourceId, candidateCreated: Boolean(candidate), candidate };
  },
};
