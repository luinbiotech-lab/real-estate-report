import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { FolderSharedOutlined, VisibilityOutlined } from '@mui/icons-material';
import { propertyRepository } from '../repositories/propertyRepository';
import { loadListingDetail, type ListingDetail } from '../services/platformListingService';
import { ADDRESS_LEVEL_LABEL, DEFAULT_ADDRESS_LEVEL, type AddressLevel } from '../domain/platform/publicListing';
import { buildPublicListingSnapshot } from '../domain/platform/publicListingSnapshot';
import PublicListingView from '../components/platform/PublicListingView';
import PublishPanel from '../components/platform/PublishPanel';
import type { Property } from '../types';
import '../platform.css';

/*
 * Public listing page, previewed inside the workspace (2026-11-15 platform upgrade).
 * Benchmarked on Zillow / Rightmove listing pages (photo, price, key facts, contact) with DA:ON's own block on top:
 * the trust grade and its criteria, and a badge on every value (공식확인 / 중개사 입력 / 계산값).
 * Nothing is published: the banner says so, the address level is not saved yet (phase 2 stores it per listing), and
 * inquiry / report request stay disabled until public posting is approved.
 * 2026-11-15 differentiation (루치오: "직방, 다방, 네이버부동산 등과의 차별성"): portals verify that a listing exists; this page
 * shows, per value, the document behind it and when a person confirmed it, a buyer's 매수 전 확인표, the price position
 * against comparable candidates (never called same-building sales), and whether a confirmed MASTER report exists.
 * 2026-11-16 privacy (루인 #65): everything a buyer sees comes from buildPublicListingSnapshot (an allowlist), never from
 * the Property row or the Data Room bundle directly. The only internal value on this page is the staff link below,
 * which is part of the workspace preview and is not in the snapshot; phase 2 serves the snapshot without it.
 */

export default function PublicListingPreviewPage() {
  const { id = '' } = useParams();
  const [property, setProperty] = useState<Property | null>();
  const [trust, setTrust] = useState<ListingDetail | null>();
  const [level, setLevel] = useState<AddressLevel>(DEFAULT_ADDRESS_LEVEL);

  useEffect(() => {
    let active = true;
    setProperty(undefined); setTrust(undefined);
    propertyRepository.getById(id).then(async (value) => {
      if (!active) return;
      setProperty(value ?? null);
      if (!value) return;
      const result = await loadListingDetail(value).catch(() => null);
      if (active) setTrust(result);
    }).catch(() => { if (active) setProperty(null); });
    return () => { active = false; };
  }, [id]);

  const view = useMemo(() => (property ? buildPublicListingSnapshot(property, trust, level) : undefined), [property, trust, level]);

  if (property === undefined) return <p className="home-empty">불러오는 중입니다.</p>;
  if (property === null || !view) return <section className="panel"><h1>매물을 찾을 수 없습니다</h1><p><Link to="/explore">탐색으로 돌아가기</Link></p></section>;

  const trustState = trust === undefined ? 'loading' : trust === null ? 'error' : 'ready';

  return <div className="listing-page">
    <p className="listing-preview-banner" role="note"><VisibilityOutlined /> <span><b>공개 화면 미리보기</b> 구매자에게는 이 화면이 이렇게 보입니다. 아래 '게시'를 눌러야 인터넷 주소가 생깁니다.</span></p>

    <div className="listing-controls">
      <span>주소 공개 범위</span>
      <ToggleButtonGroup size="small" exclusive value={level} onChange={(_, next: AddressLevel | null) => next && setLevel(next)} aria-label="주소 공개 범위">
        {(Object.keys(ADDRESS_LEVEL_LABEL) as AddressLevel[]).map((value) => <ToggleButton key={value} value={value}>{ADDRESS_LEVEL_LABEL[value]}</ToggleButton>)}
      </ToggleButtonGroup>
      <small>게시할 때 고른 범위가 함께 저장됩니다. 전체 주소는 소유자 서면 동의가 필요해 게시할 수 없습니다.</small>
    </div>

    <PublishPanel property={property} view={view} level={level} ready={trust !== undefined} />

    <PublicListingView view={view} trustState={trustState}
      footnote={<p>미리보기에서는 문의·보고서 요청 버튼이 동작하지 않습니다. 게시된 주소에서 열립니다.</p>} />

    <p className="listing-staff-link"><FolderSharedOutlined /> <Link to={`/property/${encodeURIComponent(id)}`}>업무 화면에서 이 물건 열기</Link> <small>(내부 미리보기에만 보이는 링크)</small></p>
  </div>;
}

