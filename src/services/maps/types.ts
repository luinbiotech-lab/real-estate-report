import type { BriefingCategory } from '../../types';

export interface Coordinates { latitude: number; longitude: number }
export interface AddressCandidate extends Coordinates { id: string; officialAddress: string; roadAddress: string; lotAddress: string; provider?: string }
export interface PoiCandidate extends Coordinates { id: string; name: string; kakaoCategory: string; address: string; distanceMeters: number; briefingCategory: BriefingCategory; description: string; selected: boolean }
export type MapServiceErrorCode = 'missing-key' | 'no-results' | 'request-failed' | 'proxy-unavailable' | 'auth-failed';
export class MapServiceError extends Error { constructor(public code: MapServiceErrorCode, message: string) { super(message); } }

export interface MapProvider {
  readonly id: 'naver' | 'kakao' | 'google'; readonly label: string;
  isConfigured(): boolean;
  geocode(address: string): Promise<AddressCandidate[]>;
  createStaticMap(coordinates: Coordinates): Promise<string>;
}
export interface PoiProvider {
  readonly id: 'kakao' | 'google'; readonly label: string;
  isConfigured(): boolean;
  searchNearby(coordinates: Coordinates, radiusMeters: number): Promise<PoiCandidate[]>;
  keywordSearch(keyword: string, coordinates: Coordinates, radiusMeters: number): Promise<PoiCandidate[]>;
}
export interface ProviderStatus { id: string; label: string; configured: boolean; role: string }
