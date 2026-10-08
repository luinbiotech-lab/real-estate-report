export const BANGBAE_815_11_PRODUCTION_PROPERTY_ID = 'sample-bangbae-815-11';
export const BANGBAE_815_11_LEGACY_LOCAL_PROPERTY_ID = 'daon-bangbae-815-11';

export const BANGBAE_815_11_PROPERTY_IDS = [
  BANGBAE_815_11_PRODUCTION_PROPERTY_ID,
  BANGBAE_815_11_LEGACY_LOCAL_PROPERTY_ID,
] as const;

export function isBangbae81511Property(input: {
  id?: string;
  address?: string;
  name?: string;
}) {
  if (input.id && BANGBAE_815_11_PROPERTY_IDS.includes(input.id as typeof BANGBAE_815_11_PROPERTY_IDS[number])) return true;
  const normalizedAddress = String(input.address ?? '').replace(/\s+/g, '');
  const normalizedName = String(input.name ?? '').replace(/\s+/g, '');
  return normalizedAddress.includes('방배동815-11') || normalizedName.includes('방배동815-11');
}
