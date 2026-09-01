import type { BriefingItem, Property } from '../../types';
import type { PoiCandidate } from './types';

const closeCoordinates = (a: BriefingItem, b: PoiCandidate) => a.latitude != null && a.longitude != null && Math.abs(a.latitude - b.latitude) < 0.00015 && Math.abs(a.longitude - b.longitude) < 0.00015;
export function mergePoiIntoBriefing(property: Property, candidates: PoiCandidate[]): BriefingItem[] {
  const existing = property.briefingItems ?? [];
  const additions = candidates.filter((candidate) => candidate.selected && !existing.some((item) => item.name.trim().toLowerCase() === candidate.name.trim().toLowerCase() || closeCoordinates(item, candidate))).map((candidate) => ({ category: candidate.briefingCategory, name: candidate.name, description: candidate.description || `${candidate.distanceMeters.toLocaleString('ko-KR')}m · ${candidate.kakaoCategory}`, source: 'kakao' as const, distanceMeters: candidate.distanceMeters, latitude: candidate.latitude, longitude: candidate.longitude }));
  return [...existing, ...additions];
}
