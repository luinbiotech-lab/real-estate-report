import { useMemo, useRef, useState } from 'react';
import { Alert, Button, Chip } from '@mui/material';
import { ArrowForwardRounded, RefreshRounded, SearchRounded } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import PropertyPublicDiscoveryPanel from '../components/PropertyPublicDiscoveryPanel';
import { emptyProperty, type Property } from '../types';
import { publicPropertyDiscoveryService, type PropertyDiscoveryResult } from '../services/publicPropertyDiscoveryService';
import { propertyRepository } from '../repositories/propertyRepository';
import { LISTING_STATUS_LABEL } from '../services/marketPresenceService';
import { findRegisteredMatches } from '../domain/propertyDetail/discoveryMatch';
import { classifyPropertyRecord, RECORD_CLASS_LABEL } from '../domain/sampleProperty';
import { createPropertyFromDiscovery, quickCreateBlockReason } from '../services/propertyQuickCreateService';

export default function PropertyDiscoveryPage() {
  const navigate = useNavigate();
  const [preview, setPreview] = useState<Property>({ ...emptyProperty });
  const [result, setResult] = useState<PropertyDiscoveryResult>();
  const [existing, setExisting] = useState<Property>();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [matches, setMatches] = useState<Property[]>([]);
  const [matchError, setMatchError] = useState('');
  const [matchChecked, setMatchChecked] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const matchRequestRef = useRef(0);

  const patch = useMemo(() => result ? publicPropertyDiscoveryService.patchFrom(result) : undefined, [result]);
  const canRegister = Boolean(result?.address);

  const blockReason = quickCreateBlockReason({ result, matchCount: matches.length, matchError, matchChecked });

  // Phase 3: one tap from a confirmed address to the property screen. The full form stays available for detailed entry.
  const createNow = async () => {
    if (!result || blockReason || creating) return;
    setCreating(true); setCreateError('');
    try {
      const created = await createPropertyFromDiscovery(result);
      navigate(`/property/${encodeURIComponent(created.id)}`);
    } catch (reason) {
      setCreateError(reason instanceof Error ? reason.message : '물건을 만들지 못했습니다.');
    } finally { setCreating(false); }
  };

  const goRegister = () => {
    if (existing) {
      navigate(`/property/${encodeURIComponent(existing.id)}`);
      return;
    }
    if (!result || !patch) return;
    navigate('/property/new', {
      state: {
        discoveryResult: result,
        discoveryPatch: patch,
      },
    });
  };

  const resolveExisting = async (value: PropertyDiscoveryResult) => {
    // A late lookup for an earlier search must not attach the wrong registered property to the current result.
    const requestId = ++matchRequestRef.current;
    setExisting(undefined); setMatches([]); setMatchError(''); setRefreshMessage(''); setMatchChecked(false); setCreateError('');
    if (!value.address) return;
    try {
      const found = findRegisteredMatches(value.address, await propertyRepository.getAll());
      if (requestId !== matchRequestRef.current) return;
      setMatches(found);
      // Only a single unambiguous match may be opened directly; several matches must be chosen by a person.
      setExisting(found.length === 1 ? found[0] : undefined);
      setMatchChecked(true);
    } catch (reason) {
      if (requestId === matchRequestRef.current) setMatchError(reason instanceof Error ? reason.message : '등록 물건과 대조하지 못했습니다.');
    }
  };

  const refreshExisting = async () => {
    if (!existing || !result) return;
    setRefreshing(true);
    setRefreshMessage(''); setRefreshFailed(false);
    try {
      const outcome = await publicPropertyDiscoveryService.refreshExisting(existing, result);
      setRefreshMessage(outcome.candidateCount
        ? `공공자료를 Data Room에 저장했고 현재값과 다른 ${outcome.candidateCount}개 필드를 검증후보로 생성했습니다.`
        : '공공자료를 Data Room에 저장했습니다. 현재 Property와 다른 신규 검증후보는 없습니다.');
    } catch (reason) {
      setRefreshFailed(true);
      setRefreshMessage(reason instanceof Error ? reason.message : '공공자료 저장에 실패했습니다.');
    } finally {
      setRefreshing(false);
    }
  };

  return <>
    <header className="page-header">
      <div>
        <h1>주소 · 지번으로 물건 조회</h1>
        <p>주소를 확인하면 바로 물건으로 등록하고 자료 수집을 시작합니다.</p>
      </div>
      <div className="actions">
        {existing
          ? <Button variant="contained" endIcon={<ArrowForwardRounded />} onClick={goRegister}>등록된 물건 열기</Button>
          : <Button variant="contained" endIcon={<ArrowForwardRounded />} disabled={Boolean(blockReason) || creating} onClick={() => void createNow()}>{creating ? '등록 중…' : '이 주소로 물건 등록'}</Button>}
        {!existing && <Button variant="outlined" disabled={!canRegister} onClick={goRegister}>자세히 입력해서 등록</Button>}
      </div>
    </header>
    {createError && <Alert severity="error" sx={{ mb: 2 }}>{createError}</Alert>}
    {result?.address && !existing && blockReason && matchChecked && <Alert severity="info" sx={{ mb: 2 }}>{blockReason} 아래에서 기존 물건을 고르거나 '자세히 입력해서 등록'을 사용하세요.</Alert>}
    <div role="group" className="discover-more-links" aria-label="대량 등록">
      <Button size="small" startIcon={<SearchRounded />} onClick={() => navigate('/import')}>엑셀 대량 등록</Button>
      <Button size="small" onClick={() => navigate('/bulk-intake')}>대량 자료 등록 · 검증</Button>
    </div>

    <PropertyPublicDiscoveryPanel
      property={preview}
      onResolved={(value) => {
        setResult(value);
        setPreview((previous) => ({ ...previous, ...publicPropertyDiscoveryService.patchFrom(value) }));
        void resolveExisting(value);
      }}
      onApply={(value) => setPreview((previous) => ({ ...previous, ...value }))}
    />

    {result?.address && <section className="panel">
      <div className="section-heading-row">
        <div><p className="eyebrow">정보 구분</p><h2>통합 정보 판정</h2><p>공적 사실·시장 관측·사용 evidence·매물 상태를 서로 다른 신뢰수준으로 분리합니다.</p></div>
        <Chip size="small" label="과장 판정 방지" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 10 }}>
        <div style={{ border: '1px solid #d9e0e8', borderRadius: 10, padding: 12 }}>
          <small style={{ color: '#667085' }}>공적정보</small>
          <strong style={{ display: 'block', marginTop: 5 }}>{result.building || result.landProfile ? '공적자료 관측' : result.publicDataConfigured || result.vworldConfigured ? '조회 결과 없음/부분' : '공급원 키 필요'}</strong>
          <span style={{ display: 'block', marginTop: 5, color: '#667085', fontSize: 12 }}>건축물대장·공시지가·토지특성·토지이용계획</span>
        </div>
        <div style={{ border: '1px solid #d9e0e8', borderRadius: 10, padding: 12 }}>
          <small style={{ color: '#667085' }}>시장정보</small>
          <strong style={{ display: 'block', marginTop: 5 }}>{result.market?.summary ? `실거래 후보 ${result.market.summary.totalCandidates}건 · 동일지번 ${result.market.summary.exactLotCount}건` : result.publicDataConfigured ? '실거래 후보 없음' : '공급원 키 필요'}</strong>
          <span style={{ display: 'block', marginTop: 5, color: '#667085', fontSize: 12 }}>동일지번도 동일건물 확정 거래로 승격하지 않음</span>
        </div>
        <div style={{ border: '1px solid #d9e0e8', borderRadius: 10, padding: 12 }}>
          <small style={{ color: '#667085' }}>사용상태</small>
          <strong style={{ display: 'block', marginTop: 5 }}>{result.operatingBusinessEvidence?.state === 'operating_business_observed'
            ? '영업업소 evidence 관측'
            : result.kakaoPoiEvidence?.state === 'same_address_poi_observed'
              ? '동일주소 POI evidence 관측'
              : result.usageEvidence?.state === 'energy_usage_observed'
                ? '에너지 사용 evidence 관측'
                : '미확인'}</strong>
          <span style={{ display: 'block', marginTop: 5, color: '#667085', fontSize: 12 }}>점유 확정값이 아니며 현장확인 필요</span>
        </div>
        <div style={{ border: '1px solid #d9e0e8', borderRadius: 10, padding: 12 }}>
          <small style={{ color: '#667085' }}>매물상태</small>
          <strong style={{ display: 'block', marginTop: 5 }}>{existing ? (LISTING_STATUS_LABEL[existing.listingStatus || 'unknown'] || '미확인') : '미확인'}</strong>
          <span style={{ display: 'block', marginTop: 5, color: '#667085', fontSize: 12 }}>{existing?.listingStatusSource ? `출처: ${existing.listingStatusSource}` : '외부 매물 공급원 관측은 검증후보로만 반영'}</span>
        </div>
      </div>
    </section>}

    {matchError && <Alert severity="error" sx={{ mb: 2 }}>등록 물건 대조 실패: {matchError} — 중복 등록 여부를 확인할 수 없으니 물건 목록에서 직접 확인하세요.</Alert>}
    {matches.length > 1 && <Alert severity="warning" sx={{ mb: 2 }}>같은 주소로 등록된 물건이 {matches.length}건 있습니다. 자동으로 열지 않습니다: {matches.map((item) => <Button key={item.id} size="small" onClick={() => navigate(`/property/${encodeURIComponent(item.id)}`)}>{item.name || item.id}{classifyPropertyRecord(item).recordClass !== 'operational' ? ` (${RECORD_CLASS_LABEL[classifyPropertyRecord(item).recordClass]})` : ''}</Button>)}</Alert>}
    {existing && classifyPropertyRecord(existing).recordClass !== 'operational' && <Alert severity="info" sx={{ mb: 2 }}>일치한 등록 물건은 {RECORD_CLASS_LABEL[classifyPropertyRecord(existing).recordClass]}로 분류된 기록입니다.</Alert>}
    {existing && <section className="panel">
      <div className="section-heading-row">
        <div><p className="eyebrow">등록된 물건</p><h2>이미 등록된 물건입니다</h2><p>중복으로 만들지 않고 기존 물건의 자료를 사용합니다.</p></div>
        <div className="actions">
          <Chip size="small" color="primary" label={LISTING_STATUS_LABEL[existing.listingStatus || 'unknown'] || '미확인'} />
          <Button size="small" variant="outlined" startIcon={<RefreshRounded />} disabled={refreshing || !result} onClick={() => void refreshExisting()}>
            {refreshing ? '저장 중' : '공공자료 저장'}
          </Button>
        </div>
      </div>
      {refreshMessage && <Alert severity={refreshFailed ? 'error' : 'success'} sx={{ mb: 1.5 }}>{refreshMessage}</Alert>}
      <div className="detail-grid">
        <div><small>물건명</small><strong>{existing.name}</strong></div>
        <div><small>물건번호</small><strong>{existing.propertyNumber || '-'}</strong></div>
        <div><small>주소</small><strong>{existing.address}</strong></div>
        <div><small>현재 매물상태</small><strong>{LISTING_STATUS_LABEL[existing.listingStatus || 'unknown'] || '미확인'}</strong></div>
        <div><small>매매가</small><strong>{existing.salePrice ? new Intl.NumberFormat('ko-KR').format(existing.salePrice) + '원' : '-'}</strong></div>
        <div><small>대지면적</small><strong>{existing.landAreaSqm ? existing.landAreaSqm.toLocaleString('ko-KR') + '㎡' : existing.landAreaPyeong ? existing.landAreaPyeong.toLocaleString('ko-KR') + '평' : '-'}</strong></div>
        <div><small>연면적</small><strong>{existing.totalFloorAreaSqm ? existing.totalFloorAreaSqm.toLocaleString('ko-KR') + '㎡' : existing.totalFloorAreaPyeong ? existing.totalFloorAreaPyeong.toLocaleString('ko-KR') + '평' : '-'}</strong></div>
        <div><small>주용도</small><strong>{existing.mainUse || '-'}</strong></div>
        <div><small>구조</small><strong>{existing.structure || '-'}</strong></div>
        <div><small>층수</small><strong>지상 {existing.groundFloors || 0} / 지하 {existing.basementFloors || 0}</strong></div>
        <div><small>사용승인일</small><strong>{existing.completionDate || '-'}</strong></div>
        <div><small>점유/명도</small><strong>{existing.occupancyStatus || '미확인'}</strong></div>
      </div>
    </section>}

    {result?.address && <section className="panel">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">등록 전 확인</p>
          <h2>등록 전 식별 결과</h2>
        </div>
        <Chip size="small" color="success" label="주소 확인됨" />
      </div>
      <div className="detail-grid">
        <div><small>물건명 후보</small><strong>{patch?.name || '-'}</strong></div>
        <div><small>도로명주소</small><strong>{result.address.roadAddress || '-'}</strong></div>
        <div><small>지번주소</small><strong>{result.address.lotAddress || '-'}</strong></div>
        <div><small>법정동코드</small><strong>{result.address.bCode || '-'}</strong></div>
        <div><small>PNU</small><strong>{result.landProfile?.pnu || 'VWorld 키 필요'}</strong></div>
        <div><small>개별공시지가</small><strong>{result.landProfile?.officialLandPricePerSqm ? new Intl.NumberFormat('ko-KR').format(result.landProfile.officialLandPricePerSqm) + '원/㎡' : '-'}</strong></div>
        <div><small>지목 / 토지이용</small><strong>{[result.landProfile?.landCategory, result.landProfile?.landUseSituation].filter(Boolean).join(' · ') || '-'}</strong></div>
        <div><small>건축물대장</small><strong>{result.building ? '조회됨' : result.publicDataConfigured ? '해당 표제부 없음' : '공공데이터 키 필요'}</strong></div>
        <div><small>최근 실거래 후보</small><strong>{(result.market?.commercial.length || 0) + (result.market?.land.length || 0)}건</strong></div>
        <div><small>매물 여부</small><strong>미확인 · 별도 공급원 필요</strong></div>
        <div><small>점유/사용</small><strong>{result.operatingBusinessEvidence?.state === 'operating_business_observed'
          ? '공공 영업업소 evidence 있음'
          : result.kakaoPoiEvidence?.state === 'same_address_poi_observed'
            ? `Kakao 동일주소 POI ${result.kakaoPoiEvidence.sameAddress.length}건`
            : result.usageEvidence?.state === 'energy_usage_observed'
              ? '에너지 사용 evidence 있음'
              : '미확인'}</strong></div>
      </div>
    </section>}
  </>;
}
