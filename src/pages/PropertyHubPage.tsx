import { useEffect, useMemo, useState } from 'react';
import { AssessmentRounded, DescriptionRounded, FactCheckRounded, ImageRounded, MapRounded, PaidRounded, RateReviewRounded, ThreeDRotationRounded } from '@mui/icons-material';
import { Alert, Button, Chip, CircularProgress } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { VERIFICATION_LABELS } from '../domain/propertyDataRoom/labels';
import type { DataRoomBundle } from '../domain/propertyDataRoom/types';
import { propertyDataRoomService } from '../services/propertyDataRoomService';
import { scopeDataRoomBundle } from '../services/propertyReadinessService';
import { formatUnitPricePerPyeong, hubFactRows, selectHubHeroMedia, summarizeComparables } from '../domain/propertyDetail/propertyDetailModel';
import { propertyRepository } from '../repositories/propertyRepository';
import type { Property } from '../types';

const emptyBundle: DataRoomBundle = { documents: [], media: [], verifications: [], verificationCandidates: [], dataSources: [], reportSnapshots: [], digitalTwinAssets: [] };

export default function PropertyHubPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState<Property>();
  const [bundle, setBundle] = useState<DataRoomBundle>(emptyBundle);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Route changes A→B must never show A's record or Data Room under B (late responses are dropped).
    let cancelled = false;
    setLoading(true); setError(''); setProperty(undefined); setBundle(emptyBundle);
    (async () => {
      try {
        const item = await propertyRepository.getById(id);
        if (cancelled) return;
        if (!item || item.id !== id) { setError('요청한 물건을 찾을 수 없습니다.'); return; }
        setProperty(item);
        try {
          const loaded = await propertyDataRoomService.getBundle(id);
          if (!cancelled) setBundle(scopeDataRoomBundle(loaded, id));
        } catch (reason) {
          // The property itself is valid; show it with an explicit Data Room failure instead of stale/empty counts.
          if (!cancelled) setError(`Data Room 자료를 불러오지 못했습니다. 아래 자료 수치는 확인되지 않은 값입니다. (${reason instanceof Error ? reason.message : '알 수 없는 오류'})`);
        }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : '물건 상세 허브를 불러오지 못했습니다.');
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const summary = useMemo(() => property ? propertyDataRoomService.summarize(property, bundle) : undefined, [property, bundle]);
  const market = useMemo(() => summarizeComparables(bundle, id), [bundle, id]);
  const floors = bundle.spaces ?? [];
  const floorArea = floors.reduce((sum, item) => sum + (item.areaSqm || 0), 0);
  const distinctFloorCount = new Set(floors.map((item) => String(item.floor || '').trim().toUpperCase()).filter(Boolean)).size;
  const approvedRoomLinks = (bundle.spaceRoomLinks ?? []).filter((item) => item.decision === 'approved').length;
  const primaryMedia = property ? selectHubHeroMedia(bundle.media, property) : undefined;

  if (loading) return <div className="center"><CircularProgress /><p>물건 상세 허브를 준비하는 중입니다.</p></div>;
  if (!property) return <div className="property-hub"><Alert severity="error" action={<Button color="inherit" size="small" onClick={() => navigate('/')}>물건 목록</Button>}>{error || '물건을 찾을 수 없습니다.'}</Alert></div>;

  const factRows = hubFactRows(property);
  const missingFacts = factRows.filter((row) => row.missing).length;
  const cards = [
    { label: '사진 · 미디어', detail: `${summary?.media ?? 0}개 미디어 · 내부사진 정책 적용`, icon: <ImageRounded />, action: () => navigate(`/property/${id}/data-room?tab=media`) },
    { label: '문서 · 공적자료', detail: `${summary?.documents ?? 0}건 문서 · ${summary?.officiallyVerified ?? 0}건 공식확인`, icon: <DescriptionRounded />, action: () => navigate(`/property/${id}/data-room?tab=documents`) },
    { label: '비교거래', detail: market.count ? (market.pricedCount ? `${market.count}건 · ${formatUnitPricePerPyeong(market.min)} ~ ${formatUnitPricePerPyeong(market.max)}` : `${market.count}건 · 단가 정보 없음`) : '구조화 비교거래 미연결', icon: <AssessmentRounded />, action: () => navigate(`/property/${id}/data-room?tab=market`) },
    { label: '임대 · 수익 분석', detail: 'NOI · Cap Rate · Cash-on-Cash 시나리오', icon: <PaidRounded />, action: () => navigate(`/income?propertyId=${encodeURIComponent(id)}`) },
    { label: '검토 이력', detail: '자료 검증 · Agent · 보고서 · 외부 검토 통합', icon: <RateReviewRounded />, action: () => navigate(`/review-history?propertyId=${encodeURIComponent(id)}`) },
    { label: '보고서', detail: `${summary?.reports ?? 0}개 Snapshot · 1P/7P 진입`, icon: <FactCheckRounded />, action: () => navigate(`/property/${id}/data-room?tab=reports`) },
    { label: '3D · 도면', detail: `${summary?.digitalTwin ?? 0}개 자산 · Digital Twin 연결`, icon: <ThreeDRotationRounded />, action: () => navigate(`/property/${id}/data-room?tab=digitalTwin`) },
    { label: 'Room Intelligence', detail: `${floors.length}개 공간 · 승인된 3D 연결 ${approvedRoomLinks}건`, icon: <ThreeDRotationRounded />, action: () => navigate(`/room-ops?propertyId=${encodeURIComponent(id)}`) },
    { label: 'Interior Intelligence', detail: `${floors.length}개 공간 · 실내 증거·설비·공간 연결`, icon: <ImageRounded />, action: () => navigate(`/interior?propertyId=${encodeURIComponent(id)}`) },
    { label: '입지 브리핑', detail: property.nearbyStation ? `${property.nearbyStation} · 위치/교통 분석` : '지도·입지자료 확인', icon: <MapRounded />, action: () => navigate(`/properties/${id}/briefing`) },
  ];

  return <div className="property-hub">
    <header className="property-hub-header">
      <div><p className="eyebrow">PROPERTY DETAIL HUB</p><h1>{property.name}</h1><p style={{ margin: 0, color: '#667085' }}>{property.address} · {property.propertyNumber || '물건번호 미입력'}</p></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Button onClick={() => navigate('/')}>물건 목록</Button><Button variant="outlined" onClick={() => navigate(`/property/${id}/edit`)}>물건 수정</Button><Button variant="contained" onClick={() => navigate(`/property/${id}/data-room`)}>Data Room 전체보기</Button></div>
    </header>

    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

    <section className="property-hub-overview">
      <div className="property-hub-hero">
        {primaryMedia?.url ? <img src={primaryMedia.url} alt={primaryMedia.caption || property.name} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} /> : <div style={{ textAlign: 'center', color: '#667085', padding: 24 }}><ImageRounded sx={{ fontSize: 52, color: '#98a2b3' }} /><h3 style={{ margin: '8px 0 4px' }}>대표 외관 미디어 미연결</h3><p style={{ margin: 0 }}>샘플 또는 실제 외관사진은 Data Room에서 provenance와 함께 연결합니다.</p></div>}
        {primaryMedia && <Chip size="small" label={primaryMedia.verificationStatus === 'verified' ? '공식 확인 미디어' : VERIFICATION_LABELS[primaryMedia.verificationStatus]} sx={{ position: 'absolute', left: 12, top: 12, background: '#fff' }} />}
      </div>

      <div style={{ border: '1px solid #d9e0e8', borderRadius: 14, background: '#fff', padding: 18 }}>
        <p className="eyebrow" style={{ marginTop: 0 }}>CORE PROPERTY PROFILE</p><h2 style={{ marginTop: 4 }}>핵심 정보</h2>
        <dl className="property-hub-facts" data-testid="hub-core-facts">
          {factRows.map(({ label, value, missing }) => <div key={label} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', borderTop: '1px solid #edf0f4', padding: '10px 0' }}><dt style={{ color: '#667085', fontSize: 13 }}>{label}</dt><dd style={{ margin: 0, fontWeight: missing ? 500 : 700, color: missing ? '#98a2b3' : undefined }}>{value}</dd></div>)}
        </dl>
        {missingFacts > 0 && <button type="button" onClick={() => navigate(`/property/${property.id}/edit`)} style={{ marginTop: 8, border: 0, background: 'none', padding: 0, color: '#073a69', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>미입력 {missingFacts}개 항목 입력하기 →</button>}
        <div className="property-hub-readiness">
          {[
            ['층별 데이터', floors.length ? `${distinctFloorCount}개 층 · ${floors.length}개 공간` : '미연결'], ['층별 합계', floorArea ? `${floorArea.toFixed(2)}㎡` : '-'],
            ['문서 준비도', summary?.reportReady ? '필수자료 검증 완료' : `원본 ${summary?.requiredSourcePresent ?? 0}/${summary?.requiredDocumentTotal ?? 4} · 파일 ${summary?.requiredBinaryConnected ?? 0}/${summary?.requiredDocumentTotal ?? 4}`], ['검증 대기', `${summary?.verificationPending ?? 0}건`],
          ].map(([label, value]) => <div key={label} style={{ borderRadius: 9, background: '#f7f9fb', padding: 11 }}><small style={{ color: '#667085' }}>{label}</small><strong style={{ display: 'block', marginTop: 4 }}>{value}</strong></div>)}
        </div>
      </div>
    </section>

    <section style={{ marginBottom: 16 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'end', marginBottom: 10 }}><div><p className="eyebrow" style={{ margin: 0 }}>WORKSPACE NAVIGATION</p><h2 style={{ margin: '4px 0 0' }}>업무 항목</h2></div><small style={{ color: '#667085' }}>각 카드를 선택하면 해당 물건의 세부 Workspace로 이동합니다.</small></div>
      <div className="property-hub-cards">
        {cards.map((card) => <button type="button" key={card.label} onClick={card.action} style={{ border: '1px solid #d9e0e8', borderRadius: 12, background: '#fff', padding: 16, textAlign: 'left', cursor: 'pointer', minHeight: 118 }}><div style={{ color: '#073a69', marginBottom: 9 }}>{card.icon}</div><strong style={{ fontSize: 15 }}>{card.label}</strong><p style={{ margin: '7px 0 0', color: '#667085', fontSize: 12, lineHeight: 1.55 }}>{card.detail}</p></button>)}
      </div>
    </section>

    <section className="property-hub-counts" aria-label="자료 수">
      {[
        ['사진/미디어', summary?.media ?? 0], ['문서', summary?.documents ?? 0], ['DataSource', bundle.dataSources.length], ['Digital Twin', summary?.digitalTwin ?? 0],
      ].map(([label, value]) => <div key={String(label)} style={{ border: '1px solid #d9e0e8', borderRadius: 12, background: '#fff', padding: 15 }}><small style={{ color: '#667085' }}>{label}</small><strong style={{ display: 'block', fontSize: 27, marginTop: 4 }}>{value}</strong></div>)}
    </section>
  </div>;
}
