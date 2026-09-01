import { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, FormControlLabel, MenuItem, Radio, TextField } from '@mui/material';
import { AddLocationAltRounded, MapRounded, SearchRounded } from '@mui/icons-material';
import type { BriefingCategory, BriefingItem, Property } from '../types';
import { BRIEFING_CATEGORIES } from '../services/briefingService';
import { mapService } from '../services/maps/mapService';
import { mergePoiIntoBriefing } from '../services/maps/poiService';
import type { AddressCandidate, PoiCandidate } from '../services/maps/types';

type Props = { property: Property; change: (key: keyof Property, value: string | number | boolean | string[] | BriefingItem[]) => void };
const messageFor = (error: unknown) => error instanceof Error ? error.message : 'API 요청에 실패했습니다.';

export default function MapAutomationPanel({ property, change }: Props) {
  const [, setProviderRevision] = useState(0);
  useEffect(() => { void mapService.refreshProviderStatus().then(() => setProviderRevision((value) => value + 1)); }, []);
  const mapConfigured = mapService.isMapConfigured(); const poiConfigured = mapService.isPoiConfigured();
  const proxyConnected = mapService.isProxyConnected();
  const [addresses, setAddresses] = useState<AddressCandidate[]>([]); const [selectedAddress, setSelectedAddress] = useState('');
  const [pois, setPois] = useState<PoiCandidate[]>([]); const [radius, setRadius] = useState(1000); const [status, setStatus] = useState(''); const [busy, setBusy] = useState('');
  const coordinatesReady = Number.isFinite(property.latitude) && Number.isFinite(property.longitude);
  const findAddress = async () => { if (!property.address.trim()) { setStatus('주소를 먼저 입력해 주세요.'); return; } setBusy('address'); setStatus(''); setAddresses([]); try { const results = await mapService.geocode(property.address.trim()); if (!results.length) { setStatus('주소 검색 결과가 없습니다. 주소를 다시 확인해 주세요.'); return; } setAddresses(results); setSelectedAddress(results.length === 1 ? results[0].id : ''); setStatus(results.length === 1 ? '주소 후보를 확인한 뒤 좌표 적용을 눌러 주세요.' : `${results.length}개의 주소 후보가 있습니다. 정확한 주소를 선택해 주세요.`); } catch (error) { setStatus(messageFor(error)); } finally { setBusy(''); } };
  const applyAddress = () => { const candidate = addresses.find((item) => item.id === selectedAddress); if (!candidate) { setStatus('적용할 주소 후보를 선택해 주세요.'); return; } change('address', candidate.roadAddress || candidate.officialAddress); change('latitude', candidate.latitude); change('longitude', candidate.longitude); setStatus(`${candidate.provider || '지도 Provider'} 좌표 확인 완료`); };
  const makeMap = async () => { if (!coordinatesReady) { setStatus('먼저 위치정보 자동조회를 완료해 주세요.'); return; } if (property.mapImage && !confirm('기존 위치지도 이미지가 있습니다. 자동 생성 지도로 교체할까요?')) return; setBusy('map'); try { change('mapImage', await mapService.createStaticMap({ latitude: property.latitude!, longitude: property.longitude! })); setStatus('지도 생성 완료'); } catch (error) { setStatus(messageFor(error)); } finally { setBusy(''); } };
  const findPois = async () => { if (!coordinatesReady) { setStatus('먼저 위치정보 자동조회를 완료해 주세요.'); return; } setBusy('poi'); setPois([]); try { const results = await mapService.searchNearby({ latitude: property.latitude!, longitude: property.longitude! }, radius); setPois(results); setStatus(results.length ? `${results.length}개의 Kakao POI 후보를 거리순으로 찾았습니다.` : '주변 POI 검색 결과가 없습니다.'); } catch (error) { setStatus(messageFor(error)); } finally { setBusy(''); } };
  const updatePoi = (id: string, patch: Partial<PoiCandidate>) => setPois((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  const addSelected = () => { const selected = pois.filter((item) => item.selected); if (!selected.length) { setStatus('브리핑에 추가할 후보를 선택해 주세요.'); return; } change('briefingItems', mergePoiIntoBriefing(property, selected)); setStatus('선택한 후보를 브리핑에 추가했습니다. 중복 항목은 제외했습니다.'); };
  const applyStation = (poi: PoiCandidate) => { if (property.nearbyStation && !confirm(`기존 인근역 "${property.nearbyStation}"을(를) 교체할까요?`)) return; change('nearbyStation', poi.name); change('stationDistance', `${poi.distanceMeters.toLocaleString('ko-KR')}m`); setStatus('교통정보에 반영했습니다.'); };
  return <section className="form-section map-automation">
    <div className="section-heading-row"><div><h2>주소 · 지도 · 주변 시설 자동화</h2><p>NAVER가 주소·지도를 우선 처리하고 Kakao가 POI 후보를 제공합니다.</p></div></div>
    <div className="provider-statuses">{mapService.getProviderStatus().map((provider) => <div key={provider.id} className={provider.configured ? 'connected' : ''}><b>{provider.label}</b><span>{provider.configured ? '연결됨' : provider.id === 'google-future' ? '향후 지원' : '미설정'}</span><small>{provider.role}</small></div>)}</div>
    {!proxyConnected && <Alert severity="error">로컬 API proxy 연결을 확인하고 npm run dev를 다시 실행해 주세요.</Alert>}
    {!mapConfigured && <Alert severity="warning">NAVER Maps가 미설정이며 Kakao 지도 fallback도 사용할 수 없습니다.</Alert>}
    {!poiConfigured && <Alert severity="warning">Kakao POI가 미설정되었습니다. 주소 조회와 지도 생성은 계속 사용할 수 있습니다.</Alert>}
    <div className="automation-actions"><Button variant="outlined" startIcon={<AddLocationAltRounded />} disabled={!mapConfigured || busy === 'address'} onClick={findAddress}>위치정보 자동조회</Button><Button variant="outlined" startIcon={<MapRounded />} disabled={!mapConfigured || !coordinatesReady || busy === 'map'} onClick={makeMap}>{property.mapImage ? '기존 지도 교체' : '위치지도 생성'}</Button><TextField select size="small" label="검색 반경" value={radius} onChange={(event) => setRadius(Number(event.target.value))}>{[500, 1000, 2000].map((value) => <MenuItem key={value} value={value}>{value >= 1000 ? `${value / 1000}km` : `${value}m`}</MenuItem>)}</TextField><Button variant="contained" startIcon={<SearchRounded />} disabled={!poiConfigured || !coordinatesReady || busy === 'poi'} onClick={findPois}>주변 시설 검색</Button></div>
    {status && <Alert severity={status.includes('완료') || status.includes('추가') || status.includes('찾았습니다') ? 'success' : 'info'}>{status}</Alert>}
    {addresses.length > 0 && <div className="address-candidates"><h3>주소 후보</h3>{addresses.map((item) => <label key={item.id} className={selectedAddress === item.id ? 'selected' : ''}><Radio checked={selectedAddress === item.id} onChange={() => setSelectedAddress(item.id)} /><span><b>{item.roadAddress || item.officialAddress}</b><small>{item.provider} · 지번 {item.lotAddress || '-'} · 위도 {item.latitude} · 경도 {item.longitude}</small></span></label>)}<Button variant="contained" disabled={!selectedAddress} onClick={applyAddress}>선택 주소 좌표 적용</Button></div>}
    {coordinatesReady && <div className="coordinate-result"><b>좌표 확인 완료</b><span>정규화 주소 {property.address}</span><span>위도 {property.latitude}</span><span>경도 {property.longitude}</span></div>}
    {property.mapImage && <div className="generated-map-preview"><img src={property.mapImage} alt="현재 위치지도 미리보기" /><small>현재 위치지도 · 보고서, 제안서, 입지브리핑에서 공동 사용</small></div>}
    {pois.length > 0 && <div className="poi-results"><div className="poi-results-head"><div><h3>Kakao 주변 시설 후보</h3><p>자동 확정되지 않습니다. 의미 있는 장소만 선택하고 분류를 확인하세요.</p></div><Button variant="contained" onClick={addSelected}>선택 항목 브리핑에 추가</Button></div>{pois.map((poi) => <div className="poi-row" key={poi.id}><FormControlLabel control={<Checkbox checked={poi.selected} onChange={(event) => updatePoi(poi.id, { selected: event.target.checked })} />} label="" /><div className="poi-identity"><b>{poi.name}</b><small>{poi.distanceMeters.toLocaleString('ko-KR')}m · {poi.kakaoCategory}</small><span>{poi.address}</span></div><TextField select size="small" label="브리핑 카테고리" value={poi.briefingCategory} onChange={(event) => updatePoi(poi.id, { briefingCategory: event.target.value as BriefingCategory })}>{BRIEFING_CATEGORIES.map((category) => <MenuItem key={category.key} value={category.key}>{category.label}</MenuItem>)}</TextField><TextField size="small" label="간단 설명" value={poi.description} onChange={(event) => updatePoi(poi.id, { description: event.target.value })} />{poi.briefingCategory === 'transport' && <Button size="small" onClick={() => applyStation(poi)}>인근역 반영</Button>}</div>)}</div>}
  </section>;
}
