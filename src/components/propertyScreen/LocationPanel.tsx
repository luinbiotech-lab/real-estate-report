import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, CircularProgress } from '@mui/material';
import { MapOutlined, PlaceRounded, StreetviewRounded, TravelExploreRounded, TrainRounded } from '@mui/icons-material';
import type { Property } from '../../types';
import { formatDistance, groupNearby, locationSummary, validCoordinates } from '../../domain/propertyDetail/locationSummary';
import type { MapPin } from '../../domain/propertyDetail/portfolioMap';
import PortfolioMapPanel, { portfolioMapAvailable } from '../PortfolioMapPanel';
import { getKakaoJavascriptKey } from '../../services/streetView/sdkLoader';
import { streetViewService } from '../../services/streetView/streetViewService';
import type { StreetViewSession } from '../../services/streetView/types';
import { mapService } from '../../services/maps/mapService';
import { mergePoiIntoBriefing } from '../../services/maps/poiService';
import type { PoiCandidate } from '../../services/maps/types';
import { propertyRepository } from '../../repositories/propertyRepository';

/*
 * 입지 · 주변 panel on the property screen (2026-11-13, Redfin "Around this home" / Rightmove "Nearby" / 디스코 로드뷰 benchmark).
 * Map + 로드뷰 need stored coordinates and the Kakao JavaScript key; without them the panel says so instead of drawing a guess.
 * A live 주변 시설 조회 is shown as '저장 안 됨' until the user saves it; saved rows keep source 'kakao' (POI 후보, not tenancy).
 */

const SEARCH_RADIUS = 500;

export default function LocationPanel({ property, onOpenBriefing, onEdit, onSaved }: {
  property: Property; onOpenBriefing: () => void; onEdit: () => void; onSaved: () => void;
}) {
  const summary = useMemo(() => locationSummary(property), [property]);
  const mapReady = portfolioMapAvailable() && Boolean(summary.coordinates);
  const roadviewKey = Boolean(getKakaoJavascriptKey());

  const [roadviewOpen, setRoadviewOpen] = useState(false);
  const [roadviewState, setRoadviewState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [roadviewNote, setRoadviewNote] = useState('');
  const roadviewRef = useRef<HTMLDivElement>(null);

  const [poiStatus, setPoiStatus] = useState<'unknown' | 'ready' | 'off'>('unknown');
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<PoiCandidate[] | null>(null);
  const [searchError, setSearchError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { let active = true; void mapService.refreshProviderStatus().then(() => { if (active) setPoiStatus(mapService.isPoiConfigured() ? 'ready' : 'off'); }); return () => { active = false; }; }, []);

  useEffect(() => {
    const node = roadviewRef.current;
    if (!roadviewOpen || !node || !summary.coordinates) return;
    let session: StreetViewSession | undefined; let active = true;
    setRoadviewState('loading'); setRoadviewNote('');
    streetViewService.getProvider('kakao').openViewer(node, summary.coordinates)
      .then((value) => {
        session = value;
        if (!active) { value.destroy(); return; }
        setRoadviewState('ready');
        const meters = value.metadata.distanceMeters;
        setRoadviewNote(`카카오 로드뷰 · 대상 좌표에서 ${typeof meters === 'number' ? `${meters}m` : '거리 미확인'} 지점 촬영분 · 현장 사진이 아닌 참고 화면입니다.`);
      })
      .catch((reason: unknown) => { if (active) { setRoadviewState('error'); setRoadviewNote(reason instanceof Error ? reason.message : '로드뷰를 표시하지 못했습니다.'); } });
    return () => { active = false; session?.destroy(); };
  }, [roadviewOpen, summary.coordinates]);

  const pins = useMemo<MapPin[]>(() => {
    if (!summary.coordinates) return [];
    const nearby = [...(property.briefingItems ?? []), ...(found ?? []).map((item) => ({ name: item.name, latitude: item.latitude, longitude: item.longitude, category: item.briefingCategory }))]
      .filter((item) => validCoordinates(item.latitude, item.longitude)).slice(0, 12)
      .map((item, index) => ({ id: `poi-${index}`, name: item.name, latitude: item.latitude!, longitude: item.longitude!, priceLabel: '주변' }));
    return [{ id: property.id, name: property.name || '대상 물건', latitude: summary.coordinates.latitude, longitude: summary.coordinates.longitude, priceLabel: '대상' }, ...nearby];
  }, [summary.coordinates, property, found]);
  const noop = useMemo(() => () => undefined, []);

  const search = async () => {
    if (!summary.coordinates) return;
    setSearching(true); setSearchError(''); setFound(null);
    try { setFound((await mapService.searchNearby(summary.coordinates, SEARCH_RADIUS)).map((item) => ({ ...item, selected: true }))); }
    catch (reason) { setSearchError(reason instanceof Error ? reason.message : '주변 시설을 조회하지 못했습니다.'); }
    finally { setSearching(false); }
  };
  const save = async () => {
    if (!found?.length) return;
    setSaving(true); setSearchError('');
    try {
      await propertyRepository.update({ ...property, briefingItems: mergePoiIntoBriefing(property, found), briefingUpdatedAt: new Date().toISOString() });
      setFound(null); onSaved();
    } catch (reason) { setSearchError(reason instanceof Error ? reason.message : '저장하지 못했습니다.'); }
    finally { setSaving(false); }
  };

  const foundGroups = found ? groupNearby(found.map((item) => ({ category: item.briefingCategory, name: item.name, description: item.kakaoCategory, source: 'kakao' as const, distanceMeters: item.distanceMeters }))) : [];

  return <section className="location-panel" aria-label="입지 · 주변">
    <header className="market-position-head">
      <div><p className="eyebrow">LOCATION</p><h2>입지 · 주변</h2></div>
      <span className="market-position-tags">
        <span className="tag">{summary.coordinates ? '좌표 저장됨' : '좌표 미저장'}</span>
        {summary.kakaoCount > 0 && <span className="tag">카카오 POI 후보 {summary.kakaoCount}</span>}
      </span>
    </header>
    <p className="location-headline">{summary.headline}</p>

    <div className="location-grid">
      <div className="location-visual">
        {mapReady && <PortfolioMapPanel pins={pins} missing={0} activeId={property.id} onOpen={noop} />}
        {!mapReady && <div className="location-visual-empty"><MapOutlined /><p>{!summary.coordinates ? '좌표가 저장되지 않아 지도를 표시하지 않습니다.' : '지도 키(Kakao JavaScript)가 설정되지 않아 지도를 표시하지 않습니다.'}</p>
          {!summary.coordinates && <Button size="small" onClick={onEdit}>정보 수정에서 주소 좌표 적용</Button>}</div>}
        {summary.coordinates && roadviewKey && <Button className="location-roadview-toggle" size="small" variant={roadviewOpen ? 'contained' : 'outlined'} startIcon={<StreetviewRounded />} onClick={() => setRoadviewOpen((value) => !value)} aria-expanded={roadviewOpen}>{roadviewOpen ? '로드뷰 닫기' : '로드뷰 보기'}</Button>}
        {summary.coordinates && !roadviewKey && <small className="location-note">로드뷰는 Kakao 지도 키 등록 후 표시됩니다.</small>}
        {roadviewOpen && <div className="location-roadview">
          <div ref={roadviewRef} className="location-roadview-canvas" aria-label="카카오 로드뷰" />
          {roadviewState === 'loading' && <p className="location-note"><CircularProgress size={14} /> 로드뷰를 불러오는 중입니다.</p>}
          {roadviewNote && <p className={`location-note ${roadviewState === 'error' ? 'is-error' : ''}`}>{roadviewNote}</p>}
        </div>}
      </div>

      <div className="location-facts">
        <div className="location-station"><TrainRounded /><span><small>인근역 <em>입력값</em></small><strong>{summary.station ? summary.station.name : '미입력'}</strong>{summary.station?.distance && <small>{summary.station.distance}</small>}</span></div>
        {summary.groups.length > 0 ? <ul className="location-groups">{summary.groups.map((group) => <li key={group.category}>
          <h3>{group.label} <small>{group.count}곳</small></h3>
          <ul>{group.items.map((item) => <li key={`${item.name}-${item.distanceMeters ?? ''}`}><PlaceRounded /><span>{item.name}</span><small>{formatDistance(item.distanceMeters) || '거리 미입력'} · {item.sourceLabel}</small></li>)}</ul>
        </li>)}</ul> : <p className="location-note">저장된 주변 시설이 없습니다.</p>}

        {summary.coordinates && poiStatus === 'ready' && <div className="location-search">
          <Button size="small" variant="outlined" startIcon={searching ? <CircularProgress size={14} /> : <TravelExploreRounded />} disabled={searching} onClick={() => { void search(); }}>주변 시설 조회 (반경 {SEARCH_RADIUS}m)</Button>
          {found && <div className="location-found" aria-label="주변 시설 조회 결과">
            <p className="location-note"><strong>조회 결과 {found.length}곳 · 저장 안 됨</strong> — 카카오 POI 후보입니다. 저장하면 입지 브리핑과 보고서 주변 정보에 쓰입니다.</p>
            <ul className="location-groups">{foundGroups.map((group) => <li key={group.category}><h3>{group.label} <small>{group.count}곳</small></h3>
              <ul>{group.items.map((item) => <li key={`${item.name}-${item.distanceMeters}`}><PlaceRounded /><span>{item.name}</span><small>{formatDistance(item.distanceMeters)}</small></li>)}</ul></li>)}</ul>
            {found.length > 0 && <Button size="small" variant="contained" disabled={saving} onClick={() => { void save(); }}>{saving ? '저장 중…' : '물건 정보에 저장'}</Button>}
          </div>}
        </div>}
        {summary.coordinates && poiStatus === 'off' && <small className="location-note">주변 시설 자동 조회는 서버의 Kakao 연결 후 사용할 수 있습니다.</small>}
        {searchError && <Alert severity="warning">{searchError}</Alert>}
      </div>
    </div>

    <ul className="market-position-basis">{summary.basis.map((line) => <li key={line}>{line}</li>)}</ul>
    <button type="button" className="market-position-link" onClick={onOpenBriefing}>입지 브리핑 열기</button>
  </section>;
}
