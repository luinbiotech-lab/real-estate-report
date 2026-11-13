import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AssessmentRounded, DescriptionRounded, GavelRounded, FactCheckRounded, ImageRounded, MapRounded, PaidRounded, RateReviewRounded, ThreeDRotationRounded } from '@mui/icons-material';
import { Alert, Button, Chip, CircularProgress } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { VERIFICATION_LABELS } from '../domain/propertyDataRoom/labels';
import type { DataRoomBundle } from '../domain/propertyDataRoom/types';
import { propertyDataRoomService } from '../services/propertyDataRoomService';
import { scopeDataRoomBundle } from '../services/propertyReadinessService';
import { formatUnitPricePerPyeong, hubFactRows, selectHubHeroMedia, summarizeComparables } from '../domain/propertyDetail/propertyDetailModel';
import { propertyRepository } from '../repositories/propertyRepository';
import type { Property } from '../types';

const MASTHEAD_FACTS = new Set(['매매가', '대지면적', '연면적', '용도지역']);
const IN_TABS = new Set(['사진 · 미디어', '문서 · 공적자료', '비교거래', '보고서']);
const emptyBundle: DataRoomBundle = { documents: [], media: [], verifications: [], verificationCandidates: [], dataSources: [], reportSnapshots: [], digitalTwinAssets: [] };

// 2026-11-12 site redesign (owner approved): the property screen is one page. This component renders the 요약 tab
// (section="summary") and the 더 보기 tab (section="more") inside PropertyDataRoomPage; it no longer has its own route.
export default function PropertyHubPage({ section = 'summary' }: { section?: 'summary' | 'more' }) {
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
  const approvedRoomLinks = (bundle.spaceRoomLinks ?? []).filter((item) => item.decision === 'approved').length;
  const primaryMedia = property ? selectHubHeroMedia(bundle.media, property) : undefined;
  const [showAllFacts, setShowAllFacts] = useState(false);

  if (loading) return <div className="center"><CircularProgress /><p>물건 상세 허브를 준비하는 중입니다.</p></div>;
  if (!property) return <div className="property-hub"><Alert severity="error" action={<Button color="inherit" size="small" onClick={() => navigate('/properties')}>물건 목록</Button>}>{error || '물건을 찾을 수 없습니다.'}</Alert></div>;

  const factRows = hubFactRows(property);
  const missingFacts = factRows.filter((row) => row.missing).length;
  // The title band already shows 매매가·대지·연면적·용도지역 (benchmark redesign 2026-11-12), so the card leads with the rest.
  const keyFacts = new Set(factRows.filter((row) => !MASTHEAD_FACTS.has(row.label)).map((row) => row.label));
  const documentReadiness = `원본 ${summary?.requiredSourcePresent ?? 0}/${summary?.requiredDocumentTotal ?? 4} · 파일 ${summary?.requiredBinaryConnected ?? 0}/${summary?.requiredDocumentTotal ?? 4}`;
  // Only what still needs a person: blanks, documents, pending verification, floor data. Counts live on the 자료 tab.
  const checks = [
    missingFacts > 0 && { label: `미입력 ${missingFacts}개 항목`, detail: '물건 정보에서 입력하기', action: () => navigate(`/property/${property.id}/edit`) },
    !summary?.reportReady && { label: '문서 준비도', detail: documentReadiness, action: () => navigate(`/property/${id}?tab=documents`) },
    (summary?.verificationPending ?? 0) > 0 && { label: `검증 대기 ${summary?.verificationPending}건`, detail: '자료 검증에서 승인·반려', action: () => navigate(`/property/${id}?tab=verification`) },
    !floors.length && { label: '층별 데이터 미연결', detail: '도면·층별에서 연결', action: () => navigate(`/property/${id}?tab=spatial`) },
  ].filter(Boolean) as Array<{ label: string; detail: string; action: () => void }>;
  const cards = [
    { label: '사진 · 미디어', detail: `${summary?.media ?? 0}개 미디어 · 내부사진 정책 적용`, icon: <ImageRounded />, action: () => navigate(`/property/${id}?tab=media`) },
    { label: '문서 · 공적자료', detail: `${summary?.documents ?? 0}건 문서 · ${summary?.officiallyVerified ?? 0}건 공식확인`, icon: <DescriptionRounded />, action: () => navigate(`/property/${id}?tab=documents`) },
    { label: '비교거래', detail: market.count ? (market.pricedCount ? `${market.count}건 · ${formatUnitPricePerPyeong(market.min)} ~ ${formatUnitPricePerPyeong(market.max)}` : `${market.count}건 · 단가 정보 없음`) : '구조화 비교거래 미연결', icon: <AssessmentRounded />, action: () => navigate(`/property/${id}?tab=market`) },
    { label: '임대 · 수익 분석', detail: 'NOI · Cap Rate · Cash-on-Cash 시나리오', icon: <PaidRounded />, action: () => navigate(`/income?propertyId=${encodeURIComponent(id)}`) },
    { label: '검토 이력', detail: '자료 검증 · Agent · 보고서 · 외부 검토 통합', icon: <RateReviewRounded />, action: () => navigate(`/review-history?propertyId=${encodeURIComponent(id)}`) },
    { label: '보고서', detail: `${summary?.reports ?? 0}개 보고서 · 1P/7P 진입`, icon: <FactCheckRounded />, action: () => navigate(`/property/${id}?tab=reports`) },
    { label: '3D · 도면', detail: `${summary?.digitalTwin ?? 0}개 자산 · Digital Twin 연결`, icon: <ThreeDRotationRounded />, action: () => navigate(`/property/${id}?tab=digitalTwin`) },
    { label: '공간 인텔리전스', detail: `${floors.length}개 공간 · 승인된 3D 연결 ${approvedRoomLinks}건`, icon: <ThreeDRotationRounded />, action: () => navigate(`/room-ops?propertyId=${encodeURIComponent(id)}`) },
    { label: '실내 인텔리전스', detail: `${floors.length}개 공간 · 실내 증거·설비·공간 연결`, icon: <ImageRounded />, action: () => navigate(`/interior?propertyId=${encodeURIComponent(id)}`) },
    { label: '리스크 · 규제', detail: '규제·권리·현장 확인 항목 (물건 선택 후 검토)', icon: <GavelRounded />, action: () => navigate('/risk') },
    { label: '입지 브리핑', detail: property.nearbyStation ? `${property.nearbyStation} · 위치/교통 분석` : '지도·입지자료 확인', icon: <MapRounded />, action: () => navigate(`/properties/${id}/briefing`) },
  ];

  if (section === 'more') return <div className="property-hub property-hub-more">
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {/* Tabs already cover photos, documents, comparables and reports; 더 보기 lists the specialist workspaces. */}
    <MoreCards cards={cards.filter((card) => !IN_TABS.has(card.label))} />
  </div>;

  return <div className="property-hub">

    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

    <section className={`property-hub-overview ${primaryMedia?.url ? '' : 'no-media'}`}>
      {primaryMedia?.url ? <div className="property-hub-hero">
        <img src={primaryMedia.url} alt={primaryMedia.caption || property.name} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
        <Chip size="small" label={primaryMedia.verificationStatus === 'verified' ? '공식 확인 미디어' : VERIFICATION_LABELS[primaryMedia.verificationStatus]} sx={{ position: 'absolute', left: 12, top: 12, background: '#fff' }} />
      </div> : <button type="button" className="property-hub-media-missing" onClick={() => navigate(`/property/${id}?tab=media`)}><ImageRounded /><span><strong>대표 외관 미디어 미연결</strong><small>사진은 자료 탭에서 출처(provenance)와 함께 연결합니다.</small></span></button>}

      <div className={`property-hub-summary-card ${showAllFacts ? 'show-all' : ''}`}>
        <p className="eyebrow" style={{ marginTop: 0 }}>물건 개요</p><h2 style={{ marginTop: 4 }}>핵심 정보</h2>
        <dl className="property-hub-facts" data-testid="hub-core-facts">
          {/* Facts not in the title band are shown; the four already there open with '전체 항목 보기'. */}
          {factRows.map(({ label, value, missing }) => <div key={label} className={`hub-fact ${keyFacts.has(label) ? 'is-key' : 'is-extra'} ${missing ? 'is-missing' : ''}`}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
        {factRows.length > keyFacts.size && <button type="button" className="hub-facts-toggle" onClick={() => setShowAllFacts((value) => !value)}>{showAllFacts ? '핵심 항목만 보기' : `전체 항목 보기 (${factRows.length}개)`}</button>}
      </div>
    </section>

    {checks.length > 0 && <section className="property-hub-checks" aria-label="확인할 것">
      <h3>확인할 것</h3>
      <ul>{checks.map((check) => <li key={check.label}><button type="button" onClick={check.action}><span>{check.label}</span><small>{check.detail}</small></button></li>)}</ul>
    </section>}
  </div>;
}

function MoreCards({ cards }: { cards: Array<{ label: string; detail: string; icon: ReactNode; action: () => void }> }) {
  return <section style={{ marginBottom: 16 }}><div style={{ marginBottom: 10 }}><p className="eyebrow" style={{ margin: 0 }}>업무 바로가기</p><h2 style={{ margin: '4px 0 0' }}>더 보기</h2><small style={{ color: '#667085' }}>임대·수익, 3D·도면, 공간·실내, 검토 이력, 입지 브리핑 등 전문 기능입니다.</small></div>
    <div className="property-hub-cards">
      {cards.map((card) => <button type="button" key={card.label} onClick={card.action} style={{ border: '1px solid #d9e0e8', borderRadius: 12, background: '#fff', padding: 16, textAlign: 'left', cursor: 'pointer', minHeight: 96 }}><div style={{ color: '#073a69', marginBottom: 9 }}>{card.icon}</div><strong style={{ fontSize: 15 }}>{card.label}</strong><p style={{ margin: '7px 0 0', color: '#667085', fontSize: 12, lineHeight: 1.55 }}>{card.detail}</p></button>)}
    </div>
  </section>;
}
