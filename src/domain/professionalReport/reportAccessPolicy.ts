import type { Property } from '../../types';

const BANGBAE_815_11 = /방배동\s*815[-\s]11/;

export function isBangbae81511(property: Pick<Property, 'address' | 'detailAddress'>): boolean {
  return BANGBAE_815_11.test(`${property.address} ${property.detailAddress}`);
}

export function internalPhotoAllowed(property: Pick<Property, 'address' | 'detailAddress' | 'internalPhotoAllowed'>): boolean {
  if (typeof property.internalPhotoAllowed === 'boolean') return property.internalPhotoAllowed;
  return !isBangbae81511(property);
}
