import type { Property } from '../../types';

/*
 * Home 지역 필터 + 지도 핀 (2026-11-13, Redfin/직방/호갱노노 map+list benchmark).
 * Region = 시·군·구 token taken from the entered address only (no geocoding guess); no token → '지역 미확인'.
 * A pin needs real stored coordinates; a property without them is listed as 좌표 없음, never placed at a guessed point.
 */

export const UNKNOWN_REGION = '지역 미확인';

export function regionOf(property: Pick<Property, 'address'>): string {
  const parts = String(property.address || '').split(/\s+/).filter(Boolean);
  const gu = parts.find((part) => /^[가-힣]+[구군]$/.test(part));
  if (gu) return gu;
  const si = parts.find((part, index) => index > 0 && /^[가-힣]+시$/.test(part));
  return si || UNKNOWN_REGION;
}

export interface RegionCount { region: string; count: number }

/** Regions by count (desc), then name; 지역 미확인 always last. */
export function regionCounts(properties: Pick<Property, 'address'>[]): RegionCount[] {
  const counts = new Map<string, number>();
  properties.forEach((property) => counts.set(regionOf(property), (counts.get(regionOf(property)) ?? 0) + 1));
  return [...counts.entries()].map(([region, count]) => ({ region, count }))
    .sort((a, b) => (a.region === UNKNOWN_REGION ? 1 : 0) - (b.region === UNKNOWN_REGION ? 1 : 0) || b.count - a.count || a.region.localeCompare(b.region, 'ko'));
}

const validLat = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 33 && value <= 39;
const validLng = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 124 && value <= 132;

export interface MapPin { id: string; name: string; latitude: number; longitude: number; priceLabel: string }

/** Pins only for coordinates inside Korea's bounding box; the rest are counted as missing. */
export function mapPins(properties: Property[], priceLabel: (property: Property) => string): { pins: MapPin[]; missing: number } {
  const pins: MapPin[] = [];
  let missing = 0;
  properties.forEach((property) => {
    if (validLat(property.latitude) && validLng(property.longitude)) {
      pins.push({ id: property.id, name: property.name, latitude: property.latitude!, longitude: property.longitude!, priceLabel: priceLabel(property) });
    } else missing += 1;
  });
  return { pins, missing };
}

/** HTML-escape for map overlay content (names are user-entered). */
export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));

/** A selected region that no longer exists (e.g. its last property was deleted) falls back to 전체, so the list never sticks at 0 (루인 #61). */
export function effectiveRegion(selected: string, regions: RegionCount[]): string {
  return selected === '전체' || regions.some((item) => item.region === selected) ? selected : '전체';
}
