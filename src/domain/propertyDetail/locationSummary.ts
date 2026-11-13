import type { BriefingCategory, BriefingItem, Property } from '../../types';

/*
 * 입지 · 주변 (location) summary for the property screen, benchmarked on Redfin "Around this home" / Rightmove "Nearby"
 * (2026-11-13). Rules (MASTER/locked policy):
 *  - coordinates are used only when stored and inside Korea; nothing is placed at a guessed point;
 *  - 인근역/거리 are entered values (입력값), shown as typed, never recalculated into a confirmed figure;
 *  - nearby places from Kakao are POI candidates (activity evidence) — never confirmed tenancy/occupancy;
 *  - a manually entered place keeps its 'manual' source label.
 */

export const LOCATION_CATEGORY_LABEL: Record<BriefingCategory, string> = {
  transport: '교통', food: '음식 · 카페', fashion: '패션 · 생활', beauty: '뷰티', officeCulture: '업무 · 문화', development: '개발 · 호재', other: '기타',
};
const ORDER: BriefingCategory[] = ['transport', 'food', 'officeCulture', 'fashion', 'beauty', 'development', 'other'];

export const SOURCE_LABEL = { kakao: '카카오 POI 후보', manual: '직접 입력' } as const;

export interface NearbyGroup { category: BriefingCategory; label: string; count: number; items: Array<BriefingItem & { sourceLabel: string }> }

export interface LocationSummary {
  coordinates: { latitude: number; longitude: number } | null;
  station: { name: string; distance: string } | null;
  groups: NearbyGroup[];
  nearbyCount: number;
  kakaoCount: number;
  headline: string;
  basis: string[];
}

export const validCoordinates = (latitude: unknown, longitude: unknown) =>
  typeof latitude === 'number' && typeof longitude === 'number' && Number.isFinite(latitude) && Number.isFinite(longitude)
  && latitude >= 33 && latitude <= 39 && longitude >= 124 && longitude <= 132;

export function formatDistance(meters: number | undefined) {
  if (typeof meters !== 'number' || !Number.isFinite(meters) || meters < 0) return '';
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${Math.round(meters)}m`;
}

export function groupNearby(items: BriefingItem[], perGroup = 3): NearbyGroup[] {
  const clean = items.filter((item) => item && String(item.name || '').trim());
  return ORDER.map((category) => {
    const inGroup = clean.filter((item) => (item.category in LOCATION_CATEGORY_LABEL ? item.category : 'other') === category)
      .sort((a, b) => (a.distanceMeters ?? Number.POSITIVE_INFINITY) - (b.distanceMeters ?? Number.POSITIVE_INFINITY) || a.name.localeCompare(b.name, 'ko'));
    return {
      category, label: LOCATION_CATEGORY_LABEL[category], count: inGroup.length,
      items: inGroup.slice(0, perGroup).map((item) => ({ ...item, sourceLabel: SOURCE_LABEL[item.source === 'kakao' ? 'kakao' : 'manual'] })),
    };
  }).filter((group) => group.count > 0);
}

export function locationSummary(property: Pick<Property, 'latitude' | 'longitude' | 'nearbyStation' | 'stationDistance' | 'briefingItems'>): LocationSummary {
  const coordinates = validCoordinates(property.latitude, property.longitude) ? { latitude: property.latitude!, longitude: property.longitude! } : null;
  const stationName = String(property.nearbyStation || '').trim();
  const station = stationName ? { name: stationName, distance: String(property.stationDistance || '').trim() } : null;
  const items = Array.isArray(property.briefingItems) ? property.briefingItems : [];
  const groups = groupNearby(items);
  const nearbyCount = groups.reduce((sum, group) => sum + group.count, 0);
  const kakaoCount = items.filter((item) => item?.source === 'kakao' && String(item.name || '').trim()).length;

  const parts = [station ? `${station.name}${station.distance ? ` ${station.distance}` : ''}` : '인근역 미입력', nearbyCount ? `주변 시설 ${nearbyCount}곳` : '주변 시설 미연결'];
  const headline = coordinates ? parts.join(' · ') : `좌표 미저장 · ${parts.join(' · ')}`;
  const basis = [
    '인근역·거리는 입력값이며 실측 도보 거리가 아닙니다.',
    '주변 업소는 카카오 POI 후보(활동 증거)이며 실제 임차·영업을 확정하지 않습니다.',
  ];
  if (!coordinates) basis.push('좌표가 저장되지 않아 지도·로드뷰를 표시하지 않습니다(추정 위치 사용 안 함).');
  return { coordinates, station, groups, nearbyCount, kakaoCount, headline, basis };
}
