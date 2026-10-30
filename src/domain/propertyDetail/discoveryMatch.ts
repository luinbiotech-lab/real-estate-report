import type { Property } from '../../types';

/*
 * Matching a discovery result (official/road/lot address) to already registered properties (2026-10-30).
 * Previously: exact whitespace-insensitive equality, first hit wins. "서울특별시 …" vs "서울 …" missed real
 * duplicates, and several matches silently opened the first one.
 */
const REGION_ALIASES: Array<[RegExp, string]> = [
  [/^서울특별시/, '서울'], [/^부산광역시/, '부산'], [/^대구광역시/, '대구'], [/^인천광역시/, '인천'],
  [/^광주광역시/, '광주'], [/^대전광역시/, '대전'], [/^울산광역시/, '울산'], [/^세종특별자치시/, '세종'],
  [/^경기도/, '경기'], [/^강원특별자치도|^강원도/, '강원'], [/^충청북도/, '충북'], [/^충청남도/, '충남'],
  [/^전북특별자치도|^전라북도/, '전북'], [/^전라남도/, '전남'], [/^경상북도/, '경북'], [/^경상남도/, '경남'],
  [/^제주특별자치도/, '제주'],
];

export function normalizeAddressForMatch(value: string | undefined | null) {
  let text = String(value ?? '').replace(/\s+/g, '').replace(/[()]/g, '').toLowerCase();
  for (const [pattern, alias] of REGION_ALIASES) {
    if (pattern.test(text)) { text = text.replace(pattern, alias); break; }
  }
  return text;
}

export interface DiscoveryAddressLike { officialAddress?: string; roadAddress?: string; lotAddress?: string }

export function findRegisteredMatches<T extends Pick<Property, 'id' | 'address'>>(address: DiscoveryAddressLike | undefined, rows: T[]): T[] {
  if (!address) return [];
  const targets = new Set([address.officialAddress, address.roadAddress, address.lotAddress].map(normalizeAddressForMatch).filter(Boolean));
  if (!targets.size) return [];
  return rows.filter((row) => targets.has(normalizeAddressForMatch(row.address)));
}
