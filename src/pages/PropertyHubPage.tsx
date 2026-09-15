import { useEffect, useMemo, useState } from 'react';
import { AssessmentRounded, DescriptionRounded, FactCheckRounded, ImageRounded, MapRounded, PaidRounded, RateReviewRounded, ThreeDRotationRounded } from '@mui/icons-material';
import { Alert, Button, Chip, CircularProgress } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { VERIFICATION_LABELS } from '../domain/propertyDataRoom/labels';
import type { DataRoomBundle } from '../domain/propertyDataRoom/types';
import { propertyDataRoomService } from '../services/propertyDataRoomService';
import { propertyRepository } from '../repositories/propertyRepository';
import type { Property } from '../types';
import { formatArea, formatWon } from '../utils/format';

const emptyBundle: DataRoomBundle = { documents: [], media: [], verifications: [], verificationCandidates: [], dataSources: [], reportSnapshots: [], digitalTwinAssets: [] };

function comparableSummary(bundle: DataRoomBundle) {
  const source = bundle.dataSources.find((item) => item.resourceType === 'comparable_transaction_set' && item.fieldKey === 'nearbyTransactions');
  const rows = Array.isArray(source?.metadata?.rows) ? source!.metadata.rows as Array<Record<string, unknown>> : [];
  const unitPrices = rows.map((row) => Number(row.landUnitPrice)).filter((value) => Number.isFinite(value) && value > 0);
  return {
    count: rows.length,
    min: unitPrices.length ? Math.min(...unitPrices) : 0,
    max: unitPrices.length ? Math.max(...unitPrices) : 0,
    status: source?.verificationStatus,
  };
}

function unitPrice(value: number) {
  if (!value) return '-';
  return `${Math.round(value / 10_000).toLocaleString('ko-KR')}만/평`;
}

export default function PropertyHubPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState<Property>();
  const [bundle, setBundle] = useState<DataRoomBundle>(emptyBundle);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true); setError('');
      try {
        const item = await propertyRepository.getById(id);
        if (!item) { setError('요청한 물건을 찾을 수 없습니다.'); return; }
        setProperty(item);
        setBundle(await propertyDataRoomService.getBundle(id));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '물건 상세 허브를 불러오지 못했습니다.');
      } finally { setLoading(false); }
    })();
  }, [id]);

  const summary = useMemo(() => property ? propertyDataRoomService.summarize(property, bundle) : undefined, [property, bundle]);
  const market = useMemo(() => comparableSummary(bundle), [bundle]);
  const floors = bundle.spaces ?? [];
  const floorArea = floors.reduce((sum, item) => sum + (item.areaSqm || 0), 0);
  const primaryMedia = bundle.media.find((item) => item.isPrimary && item.url) || bundle.media.find((item) => item.category === 'exterior' && item.url) || bundle.media.find((item) => item.url);

  if (loading) return <div className="center"><CircularProgress /><p>물건 상세 허브를 준비하는 중입니다.</p></div>;
  if (!property) return <main style={{ padding: 28 }}><Alert severity="error">{error || '물건을 찾을 수 없습니다.'}</Alert></main>;

  const cards = [
    { label: '사진 · 미디어', detail: `${summary?.media ?? 0}개 미디어 · 내부사진 정책 적용`, icon: <ImageRounded />, action: () => navigate(`/property/${id}/data-room?tab=media`) },
    { label: '문서 · 공적자료', detail: `${summary?.documents ?? 0}건 문서 · ${summary?.officiallyVerified ?? 0}건 공식확인`, icon: <DescriptionRounded />, action: () => navigate(`/property/${id}/data-room?tab=documents`) },
    { label: '비교거래', detail: market.count ? `${market.count}건 · ${unitPrice(market.min)} ~ ${unitPrice(market.max)}` : '구조화 비교거래 미연결', icon: <AssessmentRounded />, action: () => navigate(`/property/${id}/data-room?tab=market`) },
    { label: '임대 · 수익 분석', detail: 'NOI · Cap Rate · Cash-on-Cash 시나리오', icon: <PaidRounded />, action: () => navigate(`/income?propertyId=${encodeURIComponent(id)}`) },
    { label: '검토 이력', detail: '자료 검증 · Agent · 보고서 · 외부 검토 통합', icon: <RateReviewRounded />, action: () => navigate(`/review-history?propertyId=${encodeURIComponent(id)}`) },
    { label: '보고서', detail: `${summary?.reports ?? 0}개 Snapshot · 1P/7P 진입`, icon: <FactCheckRounded />, action: () => navigate(`/property/${id}/data-room?tab=reports`) },
    { label: '3D · 도면', detail: `${summary?.digitalTwin ?? 0}개 자산 · Digital Twin 연결`, icon: <ThreeDRotationRounded />, action: () => navigate(`/property/${id}/data-room?tab=digitalTwin`) },
    { label: '입지 브리핑', detail: property.nearbyStation ? `${property.nearbyStation} · 위치/교통 분석` : '지도·입지자료 확인', icon: <MapRounded />, action: () => navigate(`/properties/${id}/briefing`) },
  ];

  return <main style={{ padding: 28, maxWidth: 1420, margin: '0 auto' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 18 }}>
      <div><p className="eyebrow">PROPERTY DETAIL HUB</p><h1 style={{ margin: '4px 0' }}>{property.name}</h1><p style={{ margin: 0, color: '#667085' }}>{property.address} · {property.propertyNumber || '물건번호 미입력'}</p></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Button onClick={() => navigate('/')}>물건 목록</Button><Button variant="outlined" onClick={() => navigate(`/property/${id}/edit`)}>물건 수정</Button><Button variant="contained" onClick={() => navigate(`/property/${id}/data-room`)}>Data Room 전체보기</Button></div>
    </header>

    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

    <section style={{ display: 'grid', gridTemplateColumns: 'minmax(300px,.9fr) minmax(0,1.1fr)', gap: 16, marginBottom: 16 }}>
      <div style={{ minHeight: 320, borderRadius: 14, overflow: 'hidden', border: '1px solid #d9e0e8', background: '#eef2f6', display: 'grid', placeItems: 'center', position: 'relative' }}>
        {primaryMedia?.url ? <img src={primaryMedia.url} alt={primaryMedia.caption || property.name} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} /> : <div style={{ textAlign: 'center', color: '#667085', padding: 24 }}><ImageRounded sx={{ fontSize: 52, color: '#98a2b3' }} /><h3 style={{ margin: '8px 0 4px' }}>대표 외관 미디어 미연결</h3><p style={{ margin: 0 }}>샘플 또는 실제 외관사진은 Data Room에서 provenance와 함께 연결합니다.</p></div>}
        {primaryMedia && <Chip size="small" label={primaryMedia.verificationStatus === 'verified' ? '공식 확인 미디어' : VERIFICATION_LABELS[primaryMedia.verificationStatus]} sx={{ position: 'absolute', left: 12, top: 12, background: '#fff' }} />}
      </div>

      <div style={{ border: '1px solid #d9e0e8', borderRadius: 14, background: '#fff', padding: 18 }}>
        <p className="eyebrow" style={{ marginTop: 0 }}>CORE PROPERTY PROFILE</p><h2 style={{ marginTop: 4 }}>핵심 정보</h2>
        <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '0 18px', margin: 0 }}>
          {[
            ['매매가', formatWon(property.salePrice)], ['대지면적', formatArea(property.landAreaPyeong)],
            ['연면적', property.totalFloorAreaSqm ? `${property.totalFloorAreaSqm.toFixed(2)}㎡` : '-'], ['용도지역', property.zoning || '-'],
            ['주용도', property.mainUse || '-'], ['구조', property.structure || '-'],
            ['층수', `지하 ${property.basementFloors || 0}층 · 지상 ${property.groundFloors || 0}층`], ['인근역', property.nearbyStation || '-'],
          ].map(([label, value]) => <div key={label} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', borderTop: '1px solid #edf0f4', padding: '10px 0' }}><dt style={{ color: '#667085', fontSize: 13 }}>{label}</dt><dd style={{ margin: 0, fontWeight: 700 }}>{value}</dd></div>)}
        </dl>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8, marginTop: 14 }}>
          {[
            ['층별 데이터', floors.length ? `${floors.length}개 층` : '미연결'], ['층별 합계', floorArea ? `${floorArea.toFixed(2)}㎡` : '-'],
            ['보고서 준비도', summary?.reportReady ? '핵심자료 충족' : `${summary?.missingDocumentTypes.length ?? 0}개 자료 필요`], ['검증 대기', `${summary?.verificationPending ?? 0}건`],
          ].map(([label, value]) => <div key={label} style={{ borderRadius: 9, background: '#f7f9fb', padding: 11 }}><small style={{ color: '#667085' }}>{label}</small><strong style={{ display: 'block', marginTop: 4 }}>{value}</strong></div>)}
        </div>
      </div>
    </section>

    <section style={{ marginBottom: 16 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'end', marginBottom: 10 }}><div><p className="eyebrow" style={{ margin: 0 }}>WORKSPACE NAVIGATION</p><h2 style={{ margin: '4px 0 0' }}>업무 항목</h2></div><small style={{ color: '#667085' }}>각 카드를 선택하면 해당 물건의 세부 Workspace로 이동합니다.</small></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 10 }}>
        {cards.map((card) => <button key={card.label} onClick={card.action} style={{ border: '1px solid #d9e0e8', borderRadius: 12, background: '#fff', padding: 16, textAlign: 'left', cursor: 'pointer', minHeight: 118 }}><div style={{ color: '#073a69', marginBottom: 9 }}>{card.icon}</div><strong style={{ fontSize: 15 }}>{card.label}</strong><p style={{ margin: '7px 0 0', color: '#667085', fontSize: 12, lineHeight: 1.55 }}>{card.detail}</p></button>)}
      </div>
    </section>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 10 }}>
      {[
        ['사진/미디어', summary?.media ?? 0], ['문서', summary?.documents ?? 0], ['DataSource', bundle.dataSources.length], ['Digital Twin', summary?.digitalTwin ?? 0],
      ].map(([label, value]) => <div key={String(label)} style={{ border: '1px solid #d9e0e8', borderRadius: 12, background: '#fff', padding: 15 }}><small style={{ color: '#667085' }}>{label}</small><strong style={{ display: 'block', fontSize: 27, marginTop: 4 }}>{value}</strong></div>)}
    </section>
  </main>;
}
