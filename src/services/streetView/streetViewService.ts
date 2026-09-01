import type { Coordinates } from '../maps/types';
import { getProxyStatus } from '../maps/proxyClient';
import { getKakaoJavascriptKey, loadScript } from './sdkLoader';
import type { StreetViewProvider, StreetViewSession } from './types';

type KakaoLatLngLike = { getLat(): number; getLng(): number };
type KakaoRuntime = {
  maps: {
    load(callback: () => void): void;
    LatLng: new (latitude: number, longitude: number) => unknown;
    Roadview: new (element: HTMLElement) => { setPanoId(id: number, position: unknown): void; getPosition?(): KakaoLatLngLike };
    RoadviewClient: new () => { getNearestPanoId(position: unknown, radius: number, callback: (panoId: number | null) => void): void };
    event: { addListener(target: object, event: string, callback: () => void): void };
  };
};

const browserWindow = window as typeof window & { kakao?: KakaoRuntime };
const distance = (a: Coordinates, b: Coordinates) => {
  const rad = Math.PI / 180; const dLat = (b.latitude - a.latitude) * rad; const dLng = (b.longitude - a.longitude) * rad;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)));
};

const naverProvider: StreetViewProvider = {
  id: 'naver', label: 'NAVER Panorama', isAvailable: () => false,
  async openViewer() { throw new Error('현재 NAVER Maps JavaScript SDK에서 Panorama를 지원하지 않습니다.'); },
};

const getKakaoPano = (client: InstanceType<KakaoRuntime['maps']['RoadviewClient']>, position: unknown, radii: number[]) => new Promise<{ panoId: number; radius: number } | null>((resolve) => {
  const search = (index: number) => {
    if (index >= radii.length) { resolve(null); return; }
    client.getNearestPanoId(position, radii[index], (panoId) => panoId ? resolve({ panoId, radius: radii[index] }) : search(index + 1));
  };
  search(0);
});

const kakaoProvider: StreetViewProvider = {
  id: 'kakao', label: 'Kakao 로드뷰', isAvailable: () => getProxyStatus().kakaoRoadviewConfigured,
  async openViewer(container, coordinates) {
    const javascriptKey = getKakaoJavascriptKey();
    if (!javascriptKey) throw new Error('Kakao 로드뷰용 JavaScript 키가 설정되지 않았습니다.');
    await loadScript('kakao-maps-sdk', `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(javascriptKey)}&autoload=false`);
    const runtime = browserWindow.kakao;
    if (!runtime) throw new Error('Kakao 로드뷰 모듈을 초기화하지 못했습니다.');
    await new Promise<void>((resolve) => runtime.maps.load(resolve));
    const position = new runtime.maps.LatLng(coordinates.latitude, coordinates.longitude);
    const nearest = await getKakaoPano(new runtime.maps.RoadviewClient(), position, [50, 100, 250]);
    if (!nearest) throw new Error('이 위치 주변에 거리뷰가 없습니다.');
    container.replaceChildren();
    const roadview = new runtime.maps.Roadview(container);
    roadview.setPanoId(nearest.panoId, position);
    return new Promise<StreetViewSession>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('Kakao 로드뷰를 표시하지 못했습니다.')), 8000);
      runtime.maps.event.addListener(roadview, 'init', () => {
        clearTimeout(timeout);
        const panoPosition = roadview.getPosition?.();
        const distanceMeters = panoPosition ? distance(coordinates, { latitude: panoPosition.getLat(), longitude: panoPosition.getLng() }) : undefined;
        resolve({ metadata: { provider: 'kakao', panoId: String(nearest.panoId), distanceMeters, searchRadiusMeters: nearest.radius }, destroy: () => container.replaceChildren() });
      });
    });
  },
};

export const streetViewService = {
  providers: [kakaoProvider, naverProvider],
  getProvider(id: 'naver' | 'kakao') { return id === 'naver' ? naverProvider : kakaoProvider; },
};
