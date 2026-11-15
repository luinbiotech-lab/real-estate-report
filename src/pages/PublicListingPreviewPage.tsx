import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { ChatBubbleOutlineRounded, DescriptionOutlined, FolderSharedOutlined, VisibilityOutlined } from '@mui/icons-material';
import { propertyRepository } from '../repositories/propertyRepository';
import { loadListingTrust, type ListingTrust } from '../services/platformListingService';
import { ADDRESS_LEVEL_LABEL, DEFAULT_ADDRESS_LEVEL, FACT_BADGE_LABEL, maskAddress, publicFacts, type AddressLevel } from '../domain/platform/publicListing';
import { classifyPropertyRecord, RECORD_CLASS_LABEL } from '../domain/sampleProperty';
import { internalPhotoAllowed } from '../domain/professionalReport/reportAccessPolicy';
import TrustGradeBadge, { TrustCriteriaList } from '../components/platform/TrustGradeBadge';
import type { Property } from '../types';
import { formatWon } from '../utils/format';
import '../platform.css';

/*
 * Public listing page, previewed inside the workspace (2026-11-15 platform upgrade).
 * Benchmarked on Zillow / Rightmove listing pages (photo, price, key facts, contact) with DA:ON's own block on top:
 * the trust grade and its criteria, and a badge on every value (공식확인 / 중개사 입력 / 계산값).
 * Nothing is published: the banner says so, the address level is not saved yet (phase 2 stores it per listing), and
 * inquiry / report request stay disabled until public posting is approved.
 */

export default function PublicListingPreviewPage() {
  const { id = '' } = useParams();
  const [property, setProperty] = useState<Property | null>();
  const [trust, setTrust] = useState<ListingTrust | null>();
  const [level, setLevel] = useState<AddressLevel>(DEFAULT_ADDRESS_LEVEL);

  useEffect(() => {
    let active = true;
    setProperty(undefined); setTrust(undefined);
    propertyRepository.getById(id).then(async (value) => {
      if (!active) return;
      setProperty(value ?? null);
      if (!value) return;
      const result = await loadListingTrust(value).catch(() => null);
      if (active) setTrust(result);
    }).catch(() => { if (active) setProperty(null); });
    return () => { active = false; };
  }, [id]);

  const facts = useMemo(() => (property ? publicFacts(property, trust?.verifiedFieldKeys ?? new Set()) : undefined), [property, trust]);

  if (property === undefined) return <p className="home-empty">불러오는 중입니다.</p>;
  if (property === null) return <section className="panel"><h1>매물을 찾을 수 없습니다</h1><p><Link to="/explore">탐색으로 돌아가기</Link></p></section>;

  const record = classifyPropertyRecord(property).recordClass;
  const place = maskAddress(property.address, level) || '위치 확인 중';
  const showPhoto = Boolean(property.mainImage) && internalPhotoAllowed(property);

  return <div className="listing-page">
    <p className="listing-preview-banner" role="note"><VisibilityOutlined /> <span><b>공개 화면 미리보기</b> 아직 인터넷에 게시되지 않았습니다. 구매자에게는 이 화면이 이렇게 보입니다.</span></p>

    <div className="listing-controls">
      <span>주소 공개 범위</span>
      <ToggleButtonGroup size="small" exclusive value={level} onChange={(_, next: AddressLevel | null) => next && setLevel(next)} aria-label="주소 공개 범위">
        {(Object.keys(ADDRESS_LEVEL_LABEL) as AddressLevel[]).map((value) => <ToggleButton key={value} value={value}>{ADDRESS_LEVEL_LABEL[value]}</ToggleButton>)}
      </ToggleButtonGroup>
      <small>미리보기에서만 바뀝니다. 매물별 저장은 공개 게시(2단계) 때 함께 엽니다.</small>
    </div>

    <section className="listing-hero" aria-label="매물 개요">
      <div className={`listing-photo ${showPhoto ? 'has-photo' : ''}`}>{showPhoto ? <img src={property.mainImage} alt="건물 외관" /> : <span><b>사진 미공개</b><small>{internalPhotoAllowed(property) ? '권리가 확인된 외관 사진이 아직 없습니다.' : '이 매물은 사진 공개 제한 정책이 적용됩니다.'}</small></span>}</div>
      <div className="listing-summary">
        <div className="listing-tags"><TrustGradeBadge grade={trust?.grade} size="large" />{record !== 'operational' && <em className="explore-sample">{RECORD_CLASS_LABEL[record]}</em>}</div>
        <h1>{place} {property.mainUse || '건물'}</h1>
        <p className="listing-price">{property.salePrice > 0 ? formatWon(property.salePrice) : '가격 확인 중'}<small>{property.tradeType || '매매'}</small></p>
        <div className="listing-actions">
          <Button variant="contained" startIcon={<ChatBubbleOutlineRounded />} disabled>문의하기</Button>
          <Button variant="outlined" startIcon={<DescriptionOutlined />} disabled>투자 보고서 요청</Button>
        </div>
        <p className="platform-footnote">문의·보고서 요청은 공개 게시(2단계)를 승인한 뒤 열립니다. 지금은 눌러도 아무 곳에도 전송되지 않습니다.</p>
      </div>
    </section>

    <div className="listing-grid">
      <section className="panel listing-facts" aria-label="매물 정보">
        <h2>매물 정보</h2>
        <p className="trust-note">값마다 근거 표시가 붙습니다. <b>공식확인</b>은 공적서류로 확인한 값, <b>중개사 입력</b>은 아직 서류로 확인하지 않은 값, <b>계산값</b>은 입력값으로 계산한 값입니다.</p>
        <dl>{facts?.shown.map((fact) => <div key={fact.key}><dt>{fact.label}</dt><dd>{fact.value}<span className={`fact-badge badge-${fact.badge}`}>{FACT_BADGE_LABEL[fact.badge]}</span></dd></div>)}</dl>
        {facts && facts.pending.length > 0 && <p className="listing-pending"><b>확인 중</b> {facts.pending.join(' · ')}</p>}
      </section>
      <aside className="panel listing-trust" aria-label="신뢰 등급 근거">
        <h2>신뢰 등급 근거</h2>
        {trust === undefined && <p className="trust-note">등급을 계산하는 중입니다.</p>}
        {trust === null && <p className="trust-note">자료실을 읽지 못해 등급을 계산하지 않았습니다. 추정 등급은 표시하지 않습니다.</p>}
        {trust && <>
          <p className="trust-note">{trust.grade.hint}</p>
          <TrustCriteriaList grade={trust.grade} />
          <p className="platform-footnote">등급은 자료실에 실제로 있는 서류와 사람이 확인한 값만으로 계산합니다. 자동 수집 값은 확인 전까지 등급을 올리지 않습니다.</p>
        </>}
      </aside>
    </div>

    <p className="listing-staff-link"><FolderSharedOutlined /> <Link to={`/property/${encodeURIComponent(property.id)}`}>업무 화면에서 이 물건 열기</Link> <small>(내부 미리보기에만 보이는 링크)</small></p>
  </div>;
}
