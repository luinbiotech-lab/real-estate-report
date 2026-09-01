import { kakaoMapProvider } from './kakaoMapService';
import { kakaoPoiProvider } from './kakaoPoiProvider';
import { naverMapProvider } from './naverMapProvider';
import type { AddressCandidate, Coordinates, MapProvider, PoiCandidate, ProviderStatus } from './types';
import { MapServiceError } from './types';
import { getProxyStatus, refreshProxyStatus } from './proxyClient';

const mapProviders: MapProvider[] = [naverMapProvider, kakaoMapProvider];
const activeMapProviders = () => mapProviders.filter((provider) => provider.isConfigured());
async function withMapFallback<T>(operation: (provider: MapProvider) => Promise<T>): Promise<T> {
  const providers = activeMapProviders();
  if (!providers.length) throw new MapServiceError('missing-key', 'NAVER Maps와 Kakao Maps 키가 모두 설정되지 않았습니다');
  let lastError: unknown;
  for (const provider of providers) { try { return await operation(provider); } catch (error) { lastError = error; } }
  throw lastError instanceof Error ? lastError : new MapServiceError('request-failed', '지도 공급자 요청에 실패했습니다.');
}
async function geocodeWithFallback(address: string): Promise<AddressCandidate[]> {
  const providers = activeMapProviders();
  if (!providers.length) throw new MapServiceError('missing-key', 'NAVER Maps와 Kakao Maps 키가 모두 설정되지 않았습니다');
  let lastError: unknown;
  for (const provider of providers) {
    try { const candidates = await provider.geocode(address); if (candidates.length) return candidates; }
    catch (error) { lastError = error; }
  }
  if (lastError instanceof Error) throw lastError;
  return [];
}

export const mapService = {
  refreshProviderStatus: refreshProxyStatus,
  isProxyConnected: () => getProxyStatus().proxyConnected,
  isMapConfigured: () => activeMapProviders().length > 0,
  isPoiConfigured: () => kakaoPoiProvider.isConfigured(),
  geocode: geocodeWithFallback,
  createStaticMap: (coordinates: Coordinates): Promise<string> => withMapFallback((provider) => provider.createStaticMap(coordinates)),
  searchNearby: (coordinates: Coordinates, radiusMeters: number): Promise<PoiCandidate[]> => kakaoPoiProvider.searchNearby(coordinates, radiusMeters),
  keywordSearch: (keyword: string, coordinates: Coordinates, radiusMeters: number): Promise<PoiCandidate[]> => kakaoPoiProvider.keywordSearch(keyword, coordinates, radiusMeters),
  getProviderStatus: (): ProviderStatus[] => [
    { id: 'naver-map', label: naverMapProvider.label, configured: naverMapProvider.isConfigured(), role: '주소 · 정적 지도' },
    { id: 'kakao-poi', label: kakaoPoiProvider.label, configured: kakaoPoiProvider.isConfigured(), role: '주변 POI' },
    { id: 'kakao-fallback', label: kakaoMapProvider.label, configured: kakaoMapProvider.isConfigured(), role: '지도 fallback' },
    { id: 'google-future', label: 'Google Maps', configured: false, role: '향후 해외용 Provider' },
  ],
};
