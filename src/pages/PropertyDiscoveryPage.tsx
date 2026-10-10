import { useMemo, useState } from 'react';
import { Button, Chip } from '@mui/material';
import { ArrowForwardRounded, SearchRounded } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import PropertyPublicDiscoveryPanel from '../components/PropertyPublicDiscoveryPanel';
import { emptyProperty, type Property } from '../types';
import { publicPropertyDiscoveryService, type PropertyDiscoveryResult } from '../services/publicPropertyDiscoveryService';
import { propertyRepository } from '../repositories/propertyRepository';
import { LISTING_STATUS_LABEL } from '../services/marketPresenceService';

export default function PropertyDiscoveryPage() {
  const navigate = useNavigate();
  const [preview, setPreview] = useState<Property>({ ...emptyProperty });
  const [result, setResult] = useState<PropertyDiscoveryResult>();
  const [existing, setExisting] = useState<Property>();

  const patch = useMemo(() => result ? publicPropertyDiscoveryService.patchFrom(result) : undefined, [result]);
  const canRegister = Boolean(result?.address);

  const goRegister = () => {
    if (existing) {
      navigate(`/property/${existing.id}`);
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
    if (!value.address) { setExisting(undefined); return; }
    const normalize = (text: string) => text.replace(/\s+/g, '').toLowerCase();
    const targets = [value.address.officialAddress, value.address.roadAddress, value.address.lotAddress].filter(Boolean).map(normalize);
    const rows = await propertyRepository.getAll();
    setExisting(rows.find((item) => targets.includes(normalize(item.address))));
  };

  return <>
    <header className="page-header">
      <div>
        <p className="eyebrow">PROPERTY DISCOVERY</p>
        <h1>주소 · 지번으로 물건 조회</h1>
        <p>건물을 먼저 확인한 뒤 등록합니다. 공적정보·시장정보·사용증거의 출처와 확인 수준을 분리해 표시합니다.</p>
      </div>
      <div className="actions">
        <Chip icon={<SearchRounded />} label="주소 우선 탐색" />
        <Button variant="contained" endIcon={<ArrowForwardRounded />} disabled={!canRegister} onClick={goRegister}>{existing ? '기존 Data Room 열기' : '이 물건 등록'}</Button>
      </div>
    </header>

    <PropertyPublicDiscoveryPanel
      property={preview}
      onResolved={(value) => {
        setResult(value);
        setPreview((previous) => ({ ...previous, ...publicPropertyDiscoveryService.patchFrom(value) }));
        void resolveExisting(value);
      }}
      onApply={(value) => setPreview((previous) => ({ ...previous, ...value }))}
    />

    {existing && <section className="panel">
      <div className="section-heading-row">
        <div><p className="eyebrow">EXISTING PROPERTY</p><h2>이미 등록된 물건입니다</h2><p>중복 생성하지 않고 기존 Data Room과 최신 검증자료를 사용합니다.</p></div>
        <Chip size="small" color="primary" label={LISTING_STATUS_LABEL[existing.listingStatus || 'unknown'] || '미확인'} />
      </div>
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
          <p className="eyebrow">REGISTRATION PREVIEW</p>
          <h2>등록 전 식별 결과</h2>
        </div>
        <Chip size="small" color="success" label="주소 확인됨" />
      </div>
      <div className="detail-grid">
        <div><small>물건명 후보</small><strong>{patch?.name || '-'}</strong></div>
        <div><small>도로명주소</small><strong>{result.address.roadAddress || '-'}</strong></div>
        <div><small>지번주소</small><strong>{result.address.lotAddress || '-'}</strong></div>
        <div><small>법정동코드</small><strong>{result.address.bCode || '-'}</strong></div>
        <div><small>건축물대장</small><strong>{result.building ? '조회됨' : result.publicDataConfigured ? '해당 표제부 없음' : '공공데이터 키 필요'}</strong></div>
        <div><small>최근 실거래 후보</small><strong>{(result.market?.commercial.length || 0) + (result.market?.land.length || 0)}건</strong></div>
        <div><small>매물 여부</small><strong>미확인 · 별도 공급원 필요</strong></div>
        <div><small>점유/사용</small><strong>{result.operatingBusinessEvidence?.state === 'operating_business_observed' ? '영업 업소 evidence 있음' : result.usageEvidence?.state === 'energy_usage_observed' ? '에너지 사용 evidence 있음' : '미확인'}</strong></div>
      </div>
    </section>}
  </>;
}
