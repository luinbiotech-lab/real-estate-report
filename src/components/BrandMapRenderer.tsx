import { useEffect, useMemo, useRef, useState } from 'react';
import type { BrandMapModel } from '../services/locationIntelligence/types';
import { BRIEFING_CATEGORIES } from '../services/briefingService';
import { getKakaoJavascriptKey, loadScript } from '../services/streetView/sdkLoader';

type LatLng = { getLat(): number; getLng(): number };
type KakaoMaps = { load(callback: () => void): void; LatLng: new (lat: number, lng: number) => LatLng; LatLngBounds: new () => { extend(value: LatLng): void }; Map: new (node: HTMLElement, options: object) => { setBounds(bounds: unknown, padding?: number): void }; CustomOverlay: new (options: object) => { setMap(map: unknown): void } };
const runtime = () => (window as typeof window & { kakao?: { maps: KakaoMaps } }).kakao?.maps;
const label = (key: string) => BRIEFING_CATEGORIES.find((item) => item.key === key)?.label ?? key;

export default function BrandMapRenderer({ model, fallbackImage, interactive = true }: { model: BrandMapModel; fallbackImage?: string; interactive?: boolean }) {
  const mapRef = useRef<HTMLDivElement>(null); const [error, setError] = useState('');
  const groups = useMemo(() => BRIEFING_CATEGORIES.map((category) => ({ ...category, markers: model.markers.filter((marker) => marker.category === category.key) })).filter((group) => group.markers.length), [model]);
  useEffect(() => { if (!interactive || !mapRef.current) return; let active = true; const node = mapRef.current; node.replaceChildren(); setError(''); const key = getKakaoJavascriptKey(); if (!key) { setError('인터랙티브 지도 설정이 없습니다.'); return; }
    loadScript('kakao-maps-sdk', `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`).then(() => runtime()?.load(() => {
      if (!active) return; const maps = runtime(); if (!maps) { setError('지도 SDK를 초기화하지 못했습니다.'); return; }
      const center = new maps.LatLng(model.property.latitude, model.property.longitude); const map = new maps.Map(node, { center, level: 4 }); const bounds = new maps.LatLngBounds(); bounds.extend(center);
      new maps.CustomOverlay({ map, position: center, yAnchor: 1, content: `<div class="brand-map-pin property-pin"><strong>★ 대상 물건</strong><span>${model.property.name}</span></div>` });
      model.markers.forEach((marker) => { const position = new maps.LatLng(marker.latitude, marker.longitude); bounds.extend(position); new maps.CustomOverlay({ map, position, yAnchor: .5, content: `<div class="brand-map-pin poi-pin category-${marker.category}" title="${marker.name.replaceAll('"', '&quot;')}">${String(marker.number).padStart(2, '0')}</div>` }); });
      map.setBounds(bounds, 48);
    })).catch((reason: unknown) => active && setError(reason instanceof Error ? reason.message : '지도를 불러오지 못했습니다.')); return () => { active = false; node.replaceChildren(); };
  }, [interactive, model]);
  return <div className="brand-map-renderer"><aside className="brand-map-directory"><div className="directory-head"><small>POI DIRECTORY</small><b>{model.markers.length} SELECTED LOCATIONS</b></div>{groups.length ? groups.map((group) => <section key={group.key}><h3>{group.label}</h3>{group.markers.map((marker) => <div className="directory-marker" key={marker.id}><span>{String(marker.number).padStart(2, '0')}</span><div><b>{marker.name}</b><small>{marker.distanceMeters.toLocaleString('ko-KR')}m · {label(marker.category)}</small>{marker.description && <p>{marker.description}</p>}</div></div>)}</section>) : <p className="brand-map-empty">좌표가 확인된 표시 항목이 없습니다.</p>}</aside><div className="brand-map-canvas">{fallbackImage && <img src={fallbackImage} alt="공식 정적 위치지도" />}{interactive && <div ref={mapRef} className="interactive-map" aria-label="대상 물건과 선택 POI 지도" />}{error && <div className="map-load-note">{error}<small>공식 정적 지도와 POI Directory를 표시합니다.</small></div>}<div className="property-map-label"><small>SUBJECT PROPERTY</small><b>{model.property.name}</b><span>{model.property.address}</span></div></div></div>;
}
