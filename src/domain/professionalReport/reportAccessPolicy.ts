import type { Property } from '../../types';

type PropertyIdentityLike = Pick<Property, 'address' | 'detailAddress'> & Partial<Pick<Property, 'name' | 'id'>>;
type PropertyMediaPolicyLike = PropertyIdentityLike & Pick<Property, 'internalPhotoAllowed'>;

const BANGBAE_815_11 = /방배동\s*815[-\s]11/;
const BANGBAE_ROAD_ADDRESS = /동광로\s*18길\s*7/;
const INTERNAL_MEDIA_CATEGORIES = new Set([
  'interior',
  'lobby',
  'office',
  'corridor',
  'restroom',
  'basement',
  'mechanical_room',
  'mechanical',
]);

export function isBangbae81511(property: PropertyIdentityLike): boolean {
  const identity = `${property.name || ''} ${property.address} ${property.detailAddress}`;
  return property.id === 'daon-bangbae-815-11' || BANGBAE_815_11.test(identity) || BANGBAE_ROAD_ADDRESS.test(identity);
}

export function internalPhotoAllowed(property: PropertyMediaPolicyLike): boolean {
  // Bangbae 815-11 is a hard report privacy restriction, not an editable preference.
  if (isBangbae81511(property)) return false;
  if (typeof property.internalPhotoAllowed === 'boolean') return property.internalPhotoAllowed;
  return !isBangbae81511(property);
}

// Stored snapshots may predate a property-specific privacy restriction.
// A saved media flag is not an authorization to show restricted interiors.
export function reportSnapshotInternalPhotoAllowed(
  identity: Partial<Pick<Property, 'id' | 'name' | 'address' | 'detailAddress'>>,
  storedFlag: boolean,
): boolean {
  if (!storedFlag) return false;
  return !isBangbae81511({
    id: identity.id,
    name: identity.name ?? '',
    address: identity.address ?? '',
    detailAddress: identity.detailAddress ?? '',
  });
}

export function isInternalMediaCategory(category: string): boolean {
  return INTERNAL_MEDIA_CATEGORIES.has(category);
}

// Unknown or mixed categories do not establish that a photo is exterior.
// Preserve only explicitly classified non-interior assets for restricted reports.
const NON_INTERIOR_MEDIA_CATEGORIES = new Set([
  'exterior', 'road', 'surroundings', 'facade_detail', 'aerial',
  'rooftop', 'roof', 'floor_plan', 'map', 'location_analysis',
]);

export function reportMediaCategoryAllowed(category: string, allowInternal: boolean): boolean {
  return allowInternal || NON_INTERIOR_MEDIA_CATEGORIES.has(category);
}
