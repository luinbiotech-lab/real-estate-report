import type { AddressCandidate, Coordinates, MapProvider } from './types';
import { MapServiceError } from './types';
import { getProxyStatus, proxyFetch } from './proxyClient';

const configured = () => getProxyStatus().naverConfigured;
const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });

export const naverMapProvider: MapProvider = {
  id: 'naver', label: 'NAVER Maps', isConfigured: configured,
  async geocode(address: string): Promise<AddressCandidate[]> {
    if (!configured()) throw new MapServiceError('missing-key', 'NAVER Maps API 설정이 없습니다.');
    const response = await proxyFetch('/api/maps/geocode', { provider: 'naver', query: address });
    const data = await response.json() as { addresses?: Array<{ roadAddress: string; jibunAddress: string; x: string; y: string }> };
    return (data.addresses ?? []).map((item, index) => ({ id: `naver-${item.x}-${item.y}-${index}`, officialAddress: item.roadAddress || item.jibunAddress, roadAddress: item.roadAddress || '', lotAddress: item.jibunAddress || '', latitude: Number(item.y), longitude: Number(item.x), provider: 'NAVER' }));
  },
  async createStaticMap({ latitude, longitude }: Coordinates): Promise<string> {
    if (!configured()) throw new MapServiceError('missing-key', 'NAVER Maps API 설정이 없습니다.');
    const response = await proxyFetch('/api/maps/static', { provider: 'naver', latitude: String(latitude), longitude: String(longitude) });
    return blobToDataUrl(await response.blob());
  },
};
