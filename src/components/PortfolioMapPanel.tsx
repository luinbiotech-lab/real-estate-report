import { useEffect, useRef, useState } from 'react';
import { escapeHtml, type MapPin } from '../domain/propertyDetail/portfolioMap';
import { getKakaoJavascriptKey, loadScript } from '../services/streetView/sdkLoader';

type LatLng = object;
type KakaoMaps = {
  load(callback: () => void): void;
  LatLng: new (lat: number, lng: number) => LatLng;
  LatLngBounds: new () => { extend(value: LatLng): void };
  Map: new (node: HTMLElement, options: object) => { setBounds(bounds: unknown, padding?: number): void; setCenter(value: LatLng): void; setLevel(level: number): void };
  CustomOverlay: new (options: object) => { setMap(map: unknown): void };
};
const runtime = () => (window as typeof window & { kakao?: { maps: KakaoMaps } }).kakao?.maps;

/** Shown only when a Kakao JavaScript key is configured; otherwise the home keeps the list + 지역 필터 without an empty map box. */
const MAP_INIT_ERROR = '지도 SDK를 초기화하지 못했습니다(Kakao 지도 키·도메인 등록 확인 필요).';

export const portfolioMapAvailable = () => Boolean(getKakaoJavascriptKey());

export default function PortfolioMapPanel({ pins, missing, activeId, onOpen }: {
  pins: MapPin[]; missing: number; activeId?: string; onOpen: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let active = true;
    node.replaceChildren();
    setError('');
    if (!pins.length) return;
    const key = getKakaoJavascriptKey();
    loadScript('kakao-maps-sdk', `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`).then(() => {
      // Script loaded but no kakao.maps (blocked key/domain): say so instead of leaving an empty map (루인 #61).
      const sdk = runtime();
      if (!sdk) { if (active) setError(MAP_INIT_ERROR); return; }
      sdk.load(() => {
      const maps = runtime();
      if (!active || !maps) { if (active) setError(MAP_INIT_ERROR); return; }
      const first = new maps.LatLng(pins[0].latitude, pins[0].longitude);
      const map = new maps.Map(node, { center: first, level: 6 });
      const bounds = new maps.LatLngBounds();
      pins.forEach((pin) => {
        const position = new maps.LatLng(pin.latitude, pin.longitude);
        bounds.extend(position);
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'portfolio-map-pin';
        el.dataset.pinId = pin.id;
        el.innerHTML = `<b>${escapeHtml(pin.priceLabel)}</b><span>${escapeHtml(pin.name)}</span>`;
        el.addEventListener('click', () => onOpen(pin.id));
        new maps.CustomOverlay({ map, position, yAnchor: 1.15, content: el });
      });
      if (pins.length > 1) map.setBounds(bounds, 48);
      else map.setLevel(4);
    }); }).catch(() => { if (active) setError('지도를 불러오지 못했습니다(Kakao 지도 키·도메인 등록 확인 필요).'); });
    return () => { active = false; node.replaceChildren(); };
  }, [pins, onOpen]);

  // Card hover highlights its pin without rebuilding the map.
  useEffect(() => {
    ref.current?.querySelectorAll<HTMLElement>('[data-pin-id]').forEach((el) => el.classList.toggle('is-active', el.dataset.pinId === activeId));
  }, [activeId, pins]);

  return <aside className="portfolio-map" aria-label="물건 지도">
    <div ref={ref} className="portfolio-map-canvas" hidden={!pins.length || Boolean(error)} />
    {!pins.length && <p className="portfolio-map-note">좌표가 저장된 물건이 없습니다. 물건 정보에서 주소 좌표를 적용하면 지도에 표시됩니다.</p>}
    {error && <p className="portfolio-map-note">{error} · 목록은 그대로 사용할 수 있습니다.</p>}
    <p className="portfolio-map-foot">{error ? '지도 미표시' : `지도 표시 ${pins.length}건`}{missing ? ` · 좌표 없음 ${missing}건(목록에만 표시)` : ''}</p>
  </aside>;
}
