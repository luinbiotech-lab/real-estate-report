import type { Property } from '../types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';

export const LISTING_STATUS_LABEL: Record<string, string> = {
  unknown: '미확인',
  daon_exclusive: 'DA:ON 전속',
  daon_active: 'DA:ON 매물',
  external_observed: '외부 매물 확인',
  off_market_confirmed: '비매물 확인',
};

export const marketPresenceService = {
  async persist(property: Property) {
    const status = property.listingStatus || 'unknown';
    if (status === 'unknown') return;
    const now = property.listingStatusCheckedAt || new Date().toISOString();
    const source = property.listingStatusSource?.trim() || '사용자 확인';
    await propertyDataRoomRepository.saveDataSource({
      id: `listing-status:${property.id}`,
      propertyId: property.id,
      fieldKey: 'listingStatus',
      resourceType: 'market_listing_status',
      sourceType: 'manual',
      sourceName: source,
      sourceReference: property.listingStatusNote || undefined,
      collectedAt: now,
      verificationStatus: property.listingStatusSource?.trim() ? 'confirmed' : 'unverified',
      metadata: {
        listingStatus: status,
        label: LISTING_STATUS_LABEL[status] || status,
        checkedAt: now,
        note: property.listingStatusNote || '',
        externalProviderConnected: false,
        explicitFields: ['listingStatus'],
      },
      createdAt: now,
    });
  },
};
