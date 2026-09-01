import type { Coordinates, PoiCandidate, PoiProvider } from './types';
import { kakaoCategorySearch, kakaoIsConfigured, kakaoKeywordSearch, kakaoSearchNearby } from './kakaoMapService';

export const kakaoPoiProvider: PoiProvider & { categorySearch(categoryCode: string, coordinates: Coordinates, radiusMeters: number): Promise<PoiCandidate[]> } = {
  id: 'kakao', label: 'Kakao POI', isConfigured: kakaoIsConfigured,
  searchNearby: kakaoSearchNearby,
  keywordSearch: kakaoKeywordSearch,
  categorySearch: kakaoCategorySearch,
};
