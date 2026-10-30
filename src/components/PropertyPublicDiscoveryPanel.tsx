import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Tab, Tabs } from '@mui/material';
import SearchRounded from '@mui/icons-material/SearchRounded';
import VerifiedRounded from '@mui/icons-material/VerifiedRounded';
import type { Property } from '../types';
import { publicPropertyDiscoveryService, type PropertyDiscoveryResult } from '../services/publicPropertyDiscoveryService';
import { buildDiscoverySummary, groupIdenticalTrades, registerValue } from '../domain/propertyDetail/discoverySummary';

type DiscoveryTab = 'summary' | 'official' | 'market' | 'activity';

const won = (value?: number) => value ? new Intl.NumberFormat('ko-KR').format(value) + '원' : '-';
const sqm = (value?: number) => value != null ? new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(value) + '㎡' : '-';

export default function PropertyPublicDiscoveryPanel({
  property,
  onApply,
  onResolved,
}: {
  property: Property;
  onApply: (patch: Partial<Property>) => void;
  onResolved: (result: PropertyDiscoveryResult) => void;
}) {
  const [query, setQuery] = useState(property.address || '');
  const [result, setResult] = useState<PropertyDiscoveryResult>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const searchRequestRef = useRef(0);
  // Issue #37: mobile first screen = summary; details live in tabs. Building choice when one lot has several register titles.
  const [tab, setTab] = useState<DiscoveryTab>('summary');
  const [buildingIndex, setBuildingIndex] = useState(0);

  useEffect(() => {
    if (!query && property.address) setQuery(property.address);
  }, [property.address, query]);

  const search = async () => {
    const value = query.trim();
    // Enter bypasses the disabled button; never run overlapping searches or let a late result win.
    if (!value || loading) return;
    const requestId = ++searchRequestRef.current;
    setLoading(true); setError('');
    try {
      const next = await publicPropertyDiscoveryService.discover(value);
      if (requestId !== searchRequestRef.current) return;
      setResult(next);
      setTab('summary'); setBuildingIndex(0);
      onResolved(next);
    } catch (reason) {
      if (requestId === searchRequestRef.current) setError(reason instanceof Error ? reason.message : '부동산 공공데이터 조회에 실패했습니다.');
    } finally {
      if (requestId === searchRequestRef.current) setLoading(false);
    }
  };

  const candidates = result?.buildingCandidates ?? [];
  const building = candidates.length > 1 ? candidates[Math.min(buildingIndex, candidates.length - 1)] : result?.building;
  const summary = result?.address ? buildDiscoverySummary(result) : undefined;
  const trades = [...(result?.market?.exactLot || []), ...(result?.market?.commercial || []), ...(result?.market?.land || [])]
    .filter((trade, index, rows) => rows.findIndex((candidate) => candidate.type === trade.type && candidate.dealDate === trade.dealDate && candidate.jibun === trade.jibun && candidate.dealAmount === trade.dealAmount) === index)
    .sort((a, b) => b.dealDate.localeCompare(a.dealDate));
  const groupedTrades = groupIdenticalTrades(trades).slice(0, 8);
  const marketSummary = result?.market?.summary;
  const applyPublicFacts = () => {
    if (!result) return;
    // Apply the building the user chose when the lot has several register titles.
    const patch = publicPropertyDiscoveryService.patchFrom(building && building !== result.building ? { ...result, building } : result);
    if (property.name) patch.name = property.name;
    onApply(patch);
  };

  return <section className="form-section">
    <div className="section-heading-row">
      <div>
        <p className="eyebrow">PROPERTY DISCOVERY</p>
        <h2>주소 · 지번으로 건물 자동조회</h2>
        <p>주소를 입력하면 필지/건물을 먼저 식별하고 공적 장부와 최근 실거래를 조회합니다. 조회값은 확인 후 적용됩니다.</p>
      </div>
      <Chip size="small" icon={<VerifiedRounded />} label="출처 추적" />
    </div>

    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr auto' }, gap: 1 }}>
      <input
        aria-label="건물 조회 주소"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void search(); } }}
        placeholder="예: 서울 서초구 방배동 815-11"
        style={{ minHeight: 44, border: '1px solid #c8d0da', borderRadius: 8, padding: '0 12px', fontSize: 15 }}
      />
      <Button variant="contained" startIcon={loading ? <CircularProgress size={16} /> : <SearchRounded />} disabled={loading || !query.trim()} onClick={() => void search()}>
        건물 조회
      </Button>
    </Box>

    {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
    {result?.status === 'not_found' && <Alert severity="warning" sx={{ mt: 1.5 }}>주소/지번에 해당하는 위치를 찾지 못했습니다.</Alert>}
    {result?.address && <Box sx={{ mt: 1.5, border: '1px solid #dce2e9', borderRadius: 2, p: 1.5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <strong>{result.address.officialAddress}</strong>
          <div style={{ color: '#667085', fontSize: 13, marginTop: 4 }}>
            지번 {result.address.lotAddress || '-'} · 법정동코드 {result.address.bCode || '-'} · 좌표 {result.address.latitude.toFixed(6)}, {result.address.longitude.toFixed(6)}
          </div>
        </div>
        <Chip size="small" color="success" label="주소 식별 완료" />
      </div>

      {summary && <Box data-testid="discovery-summary" sx={{ mt: 1.25, border: '1px solid #c9d7e8', background: '#f5f9ff', borderRadius: 2, p: 1.25 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Chip size="small" color={summary.typeConfidence === 'none' ? 'default' : 'primary'} label={`유형: ${summary.typeLabel}`} />
          <small style={{ color: '#667085' }}>{summary.typeConfidence === 'register' ? '건축물대장 기준' : summary.typeConfidence === 'parcel_evidence' ? '토지특성 기준' : summary.typeConfidence === 'partial' ? '일부 근거' : '판정 근거 부족'}</small>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, minmax(0, 1fr))' }, gap: 1, mt: 1 }}>
          {summary.facts.map((fact) => <div key={fact.label} style={{ background: '#fff', borderRadius: 8, padding: 8, minWidth: 0 }}>
            <small style={{ color: '#667085' }}>{fact.label}</small>
            <div style={{ fontWeight: 700, marginTop: 2, overflowWrap: 'anywhere' }}>{fact.value}</div>
            {fact.note && <small style={{ color: '#8a94a3', display: 'block', overflowWrap: 'anywhere' }}>{fact.note}</small>}
          </div>)}
        </Box>
        {summary.cautions.length > 0 && <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: '#7a4b00', fontSize: 12.5 }}>
          {summary.cautions.map((caution) => <li key={caution}>{caution}</li>)}
        </ul>}
      </Box>}

      {summary?.needsBuildingChoice && <Box data-testid="discovery-building-choice" sx={{ mt: 1.25 }}>
        <strong>대상 건물 선택</strong>
        <div style={{ color: '#667085', fontSize: 12, marginTop: 2 }}>이 지번에 건축물대장 표제부가 {candidates.length}건 있습니다. 적용할 건물을 고르세요.</div>
        <Box sx={{ display: 'grid', gap: 0.75, mt: 0.75 }}>
          {candidates.map((candidate, index) => <Button key={`${candidate.rawPk}-${index}`} variant={index === buildingIndex ? 'contained' : 'outlined'} onClick={() => setBuildingIndex(index)} sx={{ justifyContent: 'flex-start', textAlign: 'left' }}>
            {[candidate.dongName, candidate.buildingName?.trim(), candidate.mainUse, candidate.detailUse].filter(Boolean).join(' · ') || `표제부 ${index + 1}`}
          </Button>)}
        </Box>
      </Box>}

      <Tabs value={tab} onChange={(_, value: DiscoveryTab) => setTab(value)} variant="scrollable" allowScrollButtonsMobile sx={{ mt: 1.25, borderBottom: '1px solid #e4e7ec', minHeight: 40 }} aria-label="조회 결과 구분">
        <Tab value="summary" label="요약" sx={{ minHeight: 40 }} />
        <Tab value="official" label="공적자료" sx={{ minHeight: 40 }} />
        <Tab value="market" label={`실거래${result.market?.summary ? ` ${result.market.summary.comparableCount ?? result.market.summary.totalCandidates}` : ''}`} sx={{ minHeight: 40 }} />
        <Tab value="activity" label="사용·매물" sx={{ minHeight: 40 }} />
      </Tabs>

      {tab === 'summary' && <>

      {!result.publicDataConfigured && <Alert severity="info" sx={{ mt: 1.25 }}>
        주소·좌표 식별은 완료했습니다. 건축물대장/국토부 실거래 자동조회는 공공데이터포털 서비스키 등록 후 활성화됩니다.
      </Alert>}
      {!result.vworldConfigured && <Alert severity="info" sx={{ mt: 1.25 }}>
        개별공시지가·토지특성·토지이용계획은 VWorld 키 등록 후 활성화됩니다.
      </Alert>}
      {result.publicDataConfigured && result.status === 'partial' && <Alert severity="warning" sx={{ mt: 1.25 }}>
        공공데이터 서비스키는 연결됐지만 일부 공급원 응답 또는 활용권한이 부족합니다. 성공한 항목은 유지하며 실패 공급원만 재확인합니다.
        {result.providerStatus ? <div style={{ marginTop: 6, fontSize: 12 }}>
          {Object.entries(result.providerStatus).filter(([, state]) => !state.ok).map(([name, state]) => <div key={name}>· {name}: {state.error || '응답 없음'}</div>)}
        </div> : null}
      </Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1, mt: 1.25 }}>
        <div style={{ background: '#f8fafc', border: '1px solid #e4e7ec', borderRadius: 8, padding: 10 }}>
          <small style={{ color: '#667085' }}>현재 매물 여부</small>
          <div style={{ fontWeight: 700, marginTop: 3 }}>미확인</div>
          <div style={{ color: '#667085', fontSize: 12, marginTop: 3 }}>국토부 공공데이터는 현재 매물 등록 여부를 제공하지 않습니다. 별도 매물 공급원 연동이 필요합니다.</div>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e4e7ec', borderRadius: 8, padding: 10 }}>
          <small style={{ color: '#667085' }}>실제 사용 / 점유 상태</small>
          <div style={{ fontWeight: 700, marginTop: 3 }}>
            {result.operatingBusinessEvidence?.state === 'operating_business_observed'
              ? `공공 상가업소 ${result.operatingBusinessEvidence.sameAddress.length}건 관측`
              : result.kakaoPoiEvidence?.state === 'same_address_poi_observed'
                ? `Kakao 동일주소 POI ${result.kakaoPoiEvidence.sameAddress.length}건 관측`
                : result.usageEvidence?.state === 'energy_usage_observed'
                  ? '에너지 사용 흔적 있음'
                  : result.usageEvidence?.state === 'no_public_record'
                    ? '공개 사용량 자료 없음'
                    : '미확인'}
          </div>
          <div style={{ color: '#667085', fontSize: 12, marginTop: 3 }}>
            {result.operatingBusinessEvidence?.state === 'operating_business_observed'
              ? result.operatingBusinessEvidence.interpretation
              : result.kakaoPoiEvidence?.state === 'same_address_poi_observed'
                ? result.kakaoPoiEvidence.interpretation
                : result.usageEvidence?.interpretation || '건축물대장의 용도와 실제 점유·영업 상태는 다를 수 있어 현장/별도 데이터로 확인합니다.'}
            {result.usageEvidence?.latestObservedMonth ? ` · 최근 에너지 관측 ${result.usageEvidence.latestObservedMonth}` : ''}
          </div>
        </div>
      </Box>

      <Button sx={{ mt: 1.25 }} variant={building ? 'text' : 'outlined'} onClick={() => onApply({
        address: result.address!.officialAddress || result.address!.lotAddress,
        latitude: result.address!.latitude,
        longitude: result.address!.longitude,
      })}>주소·좌표 적용</Button>
      </>}

      {tab === 'official' && <>

      {result.landProfile && <Box sx={{ mt: 1.5 }}>
        <div className="section-heading-row">
          <div>
            <strong>토지 공적정보</strong>
            <div style={{ color: '#667085', fontSize: 12, marginTop: 3 }}>VWorld NED · PNU {result.landProfile.pnu}</div>
          </div>
          <Chip size="small" color="success" label={result.landProfile.standardYear ? `${result.landProfile.standardYear} 기준` : '공적자료'} />
        </div>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1, mt: 1 }}>
          {[
            ['개별공시지가', result.landProfile.officialLandPricePerSqm ? won(result.landProfile.officialLandPricePerSqm) + '/㎡' : '-'],
            ['공시지가 기준 토지가액', result.landProfile.estimatedOfficialLandValue ? won(result.landProfile.estimatedOfficialLandValue) + ' · 계산값' : '-'],
            ['토지면적', sqm(result.landProfile.landAreaSqm)],
            ['지목', result.landProfile.landCategory || '-'],
            ['토지이용상황', result.landProfile.landUseSituation || '-'],
            ['용도지역', result.landProfile.primaryUseZone || result.landProfile.useZones?.join(', ') || '-'],
            ['지형', [result.landProfile.terrainHeight, result.landProfile.terrainShape].filter(Boolean).join(' · ') || '-'],
            ['도로접면', result.landProfile.roadSide || '-'],
          ].map(([label, value]) => <div key={label} style={{ background: '#f7f9fb', borderRadius: 8, padding: 10 }}>
            <small style={{ color: '#667085' }}>{label}</small><div style={{ marginTop: 3, fontWeight: 700 }}>{value}</div>
          </div>)}
        </Box>
        <small style={{ display: 'block', marginTop: 7, color: '#667085' }}>공시지가 기준 토지가액은 개별공시지가(원/㎡) × 공개 토지면적의 계산값이며 감정가·시세가 아닙니다.</small>
        <Button sx={{ mt: 1.25 }} variant="outlined" onClick={applyPublicFacts}>토지 공적정보 적용</Button>
      </Box>}

      </>}

      {tab === 'activity' && <>
      {result.kakaoPoiEvidence?.sameAddress?.length ? <Box sx={{ mt: 1.5 }}>
        <strong>Kakao Local 동일 주소 활동</strong>
        <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
          {result.kakaoPoiEvidence.sameAddress.slice(0, 8).map((place) => <div key={place.placeId || place.placeName} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr) minmax(48px, auto)', gap: 8, padding: '8px 10px', border: '1px solid #e4e7ec', borderRadius: 8, fontSize: 13 }}>
            <strong>{place.placeName}</strong>
            <span>{place.categoryGroupName || place.categoryName || '-'}</span>
            <span>{place.distanceMeters != null ? `${place.distanceMeters}m` : '-'}</span>
          </div>)}
        </div>
        <small style={{ display: 'block', marginTop: 7, color: '#667085' }}>Kakao Local POI 관측값입니다. 사업체/시설 존재의 보조 evidence이며 실제 점유율·임대차·영업 지속 여부를 확정하지 않습니다.</small>
      </Box> : null}

      {result.operatingBusinessEvidence?.sameAddress?.length ? <Box sx={{ mt: 1.5 }}>
        <strong>동일 주소 영업 업소 관측</strong>
        <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
          {result.operatingBusinessEvidence.sameAddress.slice(0, 8).map((business) => <div key={business.businessId || business.businessName} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr) minmax(56px, auto)', gap: 8, padding: '8px 10px', border: '1px solid #e4e7ec', borderRadius: 8, fontSize: 13 }}>
            <strong>{business.businessName}{business.branchName ? ` · ${business.branchName}` : ''}</strong>
            <span>{business.industrySmall || business.industryMiddle || business.industryLarge || '-'}</span>
            <span>{business.floor ? `${business.floor}층` : business.unit || '-'}</span>
          </div>)}
        </div>
        <small style={{ display: 'block', marginTop: 7, color: '#667085' }}>소상공인시장진흥공단의 영업 중 상가업소 관측값입니다. 미등록 사업자·공실·주거·사무실 점유를 모두 설명하지 않으므로 건물 전체 사용상태 확정값으로 사용하지 않습니다.</small>
      </Box> : null}

      {!result.kakaoPoiEvidence?.sameAddress?.length && !result.operatingBusinessEvidence?.sameAddress?.length && <Alert severity="info" sx={{ mt: 1.25 }}>동일 주소의 영업·활동 관측 기록이 없습니다. 공실을 뜻하지 않으며 현장 확인이 필요합니다.</Alert>}
      </>}

      {tab === 'official' && <>
      {building && <Box sx={{ mt: 1.5 }}>
        <h3 style={{ margin: '0 0 8px' }}>{building.buildingName || '건축물대장 조회 건물'}</h3>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1 }}>
          {[
            ['대지면적', registerValue(building, 'landAreaSqm')],
            ['연면적', registerValue(building, 'totalFloorAreaSqm')],
            ['건축면적', registerValue(building, 'buildingAreaSqm')],
            ['층수', `지상 ${building.groundFloors} / 지하 ${building.basementFloors}`],
            ['주용도', [building.mainUse, building.detailUse].filter(Boolean).join(' · ') || '미기재'],
            ['용도지역·지구', result.landUseZones?.map((zone) => zone.name).filter(Boolean).join(', ') || '-'],
            ['구조', building.structure || '-'],
            ['건폐율', registerValue(building, 'buildingCoverageRate', '%')],
            ['용적률', registerValue(building, 'floorAreaRatio', '%')],
            ['사용승인일', building.completionDate || '-'],
            ['주차', building.parkingOfficial != null ? building.parkingOfficial + '대' : '-'],
            ['승강기', building.elevatorCount != null ? building.elevatorCount + '대' : '-'],
            ['층별개요', (result.floors?.length || 0) + '건'],
          ].map(([label, value]) => <div key={label} style={{ background: '#f7f9fb', borderRadius: 8, padding: 10 }}>
            <small style={{ color: '#667085' }}>{label}</small><div style={{ marginTop: 3, fontWeight: 700 }}>{value}</div>
          </div>)}
        </Box>
        <Button sx={{ mt: 1.5 }} variant="outlined" onClick={applyPublicFacts}>공적정보 적용</Button>
      </Box>}

      {result.publicDataConfigured && !building && <Alert severity="warning" sx={{ mt: 1.25 }}>
        이 지번에서 건축물대장 표제부가 조회되지 않았습니다(미확인). 건물이 없다는 뜻이 아니며 나대지·부속지번·집합건물 여부를 추가 확인해야 합니다.
      </Alert>}

      </>}

      {tab === 'market' && <>
      {marketSummary && <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1 }}>
        {[
          ['최근 6개월 후보', `${marketSummary.totalCandidates}건${marketSummary.comparableCount !== undefined ? ` · 비교가능 ${marketSummary.comparableCount}건` : ''}`],
          ['동일 지번', marketSummary.exactLotCount + '건'],
          ['거래가 중앙값', won(marketSummary.medianDealAmount)],
          ['토지 평당가 중앙값', won(marketSummary.medianLandPricePerPyeong ?? marketSummary.medianPricePerPyeong)],
        ].map(([label, value]) => <div key={label} style={{ background: '#f8fafc', border: '1px solid #e4e7ec', borderRadius: 8, padding: 10 }}>
          <small style={{ color: '#667085' }}>{label}</small><div style={{ fontWeight: 700, marginTop: 4 }}>{value}</div>
        </div>)}
      </Box>}

      {groupedTrades.length > 0 && <Box sx={{ mt: 1.5 }}>
        <strong>최근 실거래 후보</strong>
        <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
          {groupedTrades.map(({ trade, count }, index) => <div key={index} style={{ display: 'grid', gridTemplateColumns: 'minmax(72px, auto) minmax(0, 1fr) minmax(96px, auto)', gap: 8, padding: '8px 10px', border: '1px solid #e4e7ec', borderRadius: 8, fontSize: 13 }}>
            <span>{trade.dealDate || '-'}</span>
            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{trade.matchLevel === 'exact_lot' ? '● 동일 지번 · ' : ''}{trade.legalDong} {trade.jibun} {trade.buildingName}{count > 1 ? ` · 동일 거래 ${count}건` : ''}</span>
            <strong style={{ textAlign: 'right' }}>{won(trade.dealAmount)}{trade.landPricePerPyeong ? <small style={{ display: 'block', fontWeight: 400 }}>토지 {won(trade.landPricePerPyeong)}/평</small> : trade.pricePerPyeong ? <small style={{ display: 'block', fontWeight: 400 }}>{won(trade.pricePerPyeong)}/평</small> : null}{trade.comparableExclusion ? <small style={{ display: 'block', fontWeight: 400, color: '#b54708' }}>{trade.comparableExclusion === 'cancelled' ? '해제 거래' : trade.comparableExclusion === 'share_deal' ? '지분 거래' : '집합건물 호실'} · 비교 제외</small> : null}</strong>
          </div>)}
        </div>
        <small style={{ display: 'block', marginTop: 7, color: '#667085' }}>{marketSummary?.excluded && (marketSummary.excluded.cancelled + marketSummary.excluded.share_deal + marketSummary.excluded.collective_unit) > 0 ? `중앙값에서 제외: 해제 ${marketSummary.excluded.cancelled}건 · 지분거래 ${marketSummary.excluded.share_deal}건 · 집합건물 호실 ${marketSummary.excluded.collective_unit}건. ` : ''}동일 건물 확정 거래가 아니라 법정동·최근기간 기준 후보입니다. 지번/면적/용도 일치도를 추가 검증해 비교거래로 승격합니다.</small>
      </Box>}
      {!marketSummary && <Alert severity="info" sx={{ mt: 1.25 }}>실거래 데이터가 연결되지 않았거나 조회된 후보가 없습니다.</Alert>}
      </>}
    </Box>}
  </section>;
}
