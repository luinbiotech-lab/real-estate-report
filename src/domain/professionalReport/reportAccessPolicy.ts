import type { Property } from '../../types';

type PropertyIdentityLike = Pick<Property, 'address' | 'detailAddress'> & Partial<Pick<Property, 'name'>>;
type PropertyMediaPolicyLike = PropertyIdentityLike & Pick<Property, 'internalPhotoAllowed'>;

const BANGBAE_815_11 = /방배동\s*815[-\s]11/;
const BANGBAE_ROAD_ADDRESS = /동광로\s*18길\s*7/;

export function isBangbae81511(property: PropertyIdentityLike): boolean {
  const identity = `${property.name || ''} ${property.address} ${property.detailAddress}`;
  return BANGBAE_815_11.test(identity) || BANGBAE_ROAD_ADDRESS.test(identity);
}

export function internalPhotoAllowed(property: PropertyMediaPolicyLike): boolean {
  if (typeof property.internalPhotoAllowed === 'boolean') return property.internalPhotoAllowed;
  return !isBangbae81511(property);
}
