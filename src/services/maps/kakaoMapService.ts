import type { AddressCandidate, Coordinates, PoiCandidate } from './types';
import { MapServiceError } from './types';
import { getProxyStatus, proxyFetch } from './proxyClient';

const request = async (path: string, params: Record<string, string>) => {
  if (!getProxyStatus().kakaoConfigured) throw new MapServiceError('missing-key', 'Kakao REST API 설정이 없습니다.');
  const mode = path.includes('address') ? 'address' : path.includes('staticmap') ? 'static' : path.includes('category') ? 'category' : 'keyword';
  const endpoint = mode === 'address' ? '/api/maps/geocode' : mode === 'static' ? '/api/maps/static' : '/api/poi/search';
  return proxyFetch(endpoint, { provider: 'kakao', mode, ...params });
};
const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob);
});

export const kakaoIsConfigured = () => getProxyStatus().kakaoConfigured;
export async function kakaoSearchAddress(address: string): Promise<AddressCandidate[]> {
  const response = await request('/v2/local/search/address.json', { query: address, size: '10' });
  const data = await response.json() as { documents: Array<{ address_name: string; x: string; y: string; address?: { address_name?: string }; road_address?: { address_name?: string } }> };
  return data.documents.map((item, index) => ({ id: `${item.x}-${item.y}-${index}`, officialAddress: item.address_name, roadAddress: item.road_address?.address_name || '', lotAddress: item.address?.address_name || '', latitude: Number(item.y), longitude: Number(item.x) }));
}
export async function kakaoCreateStaticMap({ latitude, longitude }: Coordinates): Promise<string> {
  if (!getProxyStatus().kakaoConfigured) throw new MapServiceError('missing-key', 'Kakao REST API 설정이 없습니다.');
  const response = await proxyFetch('/api/maps/static', { provider: 'kakao', latitude: String(latitude), longitude: String(longitude) });
  return blobToDataUrl(await response.blob());
}

type KakaoPlace = { id: string; place_name: string; category_name: string; address_name: string; road_address_name: string; distance: string; x: string; y: string };
const toPoi = (place: KakaoPlace, briefingCategory: PoiCandidate['briefingCategory'] = 'other'): PoiCandidate => ({ id: place.id, name: place.place_name, kakaoCategory: place.category_name, address: place.road_address_name || place.address_name, distanceMeters: Number(place.distance), latitude: Number(place.y), longitude: Number(place.x), briefingCategory, description: '', selected: false });
export async function kakaoKeywordSearch(keyword: string, { latitude, longitude }: Coordinates, radiusMeters: number): Promise<PoiCandidate[]> {
  const response = await request('/v2/local/search/keyword.json', { query: keyword, x: String(longitude), y: String(latitude), radius: String(radiusMeters), sort: 'distance', size: '15' });
  const data = await response.json() as { documents: KakaoPlace[] };
  return data.documents.map((place) => toPoi(place));
}
export async function kakaoCategorySearch(categoryCode: string, { latitude, longitude }: Coordinates, radiusMeters: number): Promise<PoiCandidate[]> {
  const response = await request('/v2/local/search/category.json', { category_group_code: categoryCode, x: String(longitude), y: String(latitude), radius: String(radiusMeters), sort: 'distance', size: '15' });
  const data = await response.json() as { documents: KakaoPlace[] };
  return data.documents.map((place) => toPoi(place));
}
const SEARCHES = [
  ['패션', 'fashion'], ['뷰티', 'beauty'], ['카페', 'food'], ['음식점', 'food'],
  ['문화시설', 'officeCulture'], ['오피스', 'officeCulture'], ['지하철역', 'transport'], ['개발', 'development'],
] as const;
export async function kakaoSearchNearby({ latitude, longitude }: Coordinates, radiusMeters: number): Promise<PoiCandidate[]> {
  const pages = await Promise.all(SEARCHES.map(async ([query, category]) => {
    const response = await request('/v2/local/search/keyword.json', { query, x: String(longitude), y: String(latitude), radius: String(radiusMeters), sort: 'distance', size: '8' });
    const data = await response.json() as { documents: KakaoPlace[] };
    return data.documents.map((place) => ({ id: place.id, name: place.place_name, kakaoCategory: place.category_name, address: place.road_address_name || place.address_name, distanceMeters: Number(place.distance), latitude: Number(place.y), longitude: Number(place.x), briefingCategory: category, description: '', selected: false } satisfies PoiCandidate));
  }));
  const unique = new Map<string, PoiCandidate>();
  pages.flat().sort((a, b) => a.distanceMeters - b.distanceMeters).forEach((item) => { if (!unique.has(item.id || `${item.name}-${item.latitude}-${item.longitude}`)) unique.set(item.id || item.name, item); });
  return [...unique.values()].slice(0, 60);
}

// 기존 Kakao geocode/static map 구현은 NAVER 장애 또는 미설정 시 사용하는 fallback이다.
export const kakaoMapProvider = {
  id: 'kakao' as const, label: 'Kakao Maps fallback', isConfigured: kakaoIsConfigured,
  geocode: kakaoSearchAddress, createStaticMap: kakaoCreateStaticMap,
};
