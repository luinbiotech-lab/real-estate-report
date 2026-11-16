import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { ChatBubbleOutlineRounded, DescriptionOutlined, FolderSharedOutlined, VisibilityOutlined } from '@mui/icons-material';
import { propertyRepository } from '../repositories/propertyRepository';
import { loadListingDetail, type ListingDetail } from '../services/platformListingService';
import { dueDiligenceProgress } from '../domain/platform/evidenceLedger';
import { formatUnitPricePerPyeong } from '../domain/propertyDetail/propertyDetailModel';
import { ADDRESS_LEVEL_LABEL, DEFAULT_ADDRESS_LEVEL, FACT_BADGE_LABEL, type AddressLevel } from '../domain/platform/publicListing';
import { buildPublicListingSnapshot } from '../domain/platform/publicListingSnapshot';
import { RECORD_CLASS_LABEL } from '../domain/sampleProperty';
import TrustGradeBadge, { TrustCriteriaList } from '../components/platform/TrustGradeBadge';
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

  const record = view.recordClass;

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
      <div className={`listing-photo ${view.photo ? 'has-photo' : ''}`}>{view.photo ? <img src={view.photo} alt="건물 외관" /> : <span><b>사진 미공개</b><small>{view.photoNote}</small></span>}</div>
      <div className="listing-summary">
        <div className="listing-tags"><TrustGradeBadge grade={view.grade} size="large" />{record !== 'operational' && <em className="explore-sample">{RECORD_CLASS_LABEL[record]}</em>}</div>
        <h1>{view.title}</h1>
        <p className="listing-price">{view.priceText}<small>{view.tradeType}</small></p>
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
        <dl>{view.facts.map((fact) => { const proof = fact.proof; return <div key={fact.key}><dt>{fact.label}</dt><dd>{fact.value}<span className={`fact-badge badge-${fact.badge}`}>{FACT_BADGE_LABEL[fact.badge]}</span></dd>{proof && <small className="fact-proof">근거: {proof.sources.length ? proof.sources.join(' / ') : '출처 기록 없음'}{proof.verifiedAt && ` · ${proof.verifiedAt} 담당자 확인`}</small>}{fact.badge === 'calculated' && <small className="fact-proof">매매가 ÷ 대지면적 계산값 (실거래가 아님)</small>}</div>; })}</dl>
        {view.pending.length > 0 && <p className="listing-pending"><b>확인 중</b> {view.pending.join(' · ')}</p>}
      </section>
      <aside className="panel listing-trust" aria-label="신뢰 등급 근거">
        <h2>신뢰 등급 근거</h2>
        {trust === undefined && <p className="trust-note">등급을 계산하는 중입니다.</p>}
        {trust === null && <p className="trust-note">자료실을 읽지 못해 등급을 계산하지 않았습니다. 추정 등급은 표시하지 않습니다.</p>}
        {trust && <>
          {view.grade && <><p className="trust-note">{view.grade.hint}</p>
          <TrustCriteriaList grade={view.grade} /></>}
          <p className="platform-footnote">등급은 자료실에 실제로 있는 서류와 사람이 확인한 값만으로 계산합니다. 자동 수집 값은 확인 전까지 등급을 올리지 않습니다.</p>
        </>}
      </aside>
    </div>

    <div className="listing-grid">
      <section className="panel listing-checklist" aria-label="매수 전 확인표">
        <h2>매수 전 확인표{view.checklist && <small>{dueDiligenceProgress(view.checklist).done}/{dueDiligenceProgress(view.checklist).total} 완료</small>}</h2>
        <p className="trust-note">사기 전에 확인해야 할 서류와 항목입니다. 끝나지 않은 항목도 숨기지 않습니다.</p>
        {trust === undefined && <p className="trust-note">확인표를 만드는 중입니다.</p>}
        {trust === null && <p className="trust-note">자료실을 읽지 못해 확인표를 만들지 않았습니다.</p>}
        {view.checklist && <ul className="checklist-rows">{view.checklist.map((row) => <li key={row.key} className={`state-${row.state}`}><span className="checklist-mark" aria-hidden="true">{row.state === 'done' ? '✓' : row.state === 'partial' ? '△' : '○'}</span><span><b>{row.label}</b><small>{row.detail}</small></span></li>)}</ul>}
      </section>
      <aside className="panel listing-market" aria-label="시세 위치">
        <h2>시세 위치</h2>
        {view.market && <>
          <p className="listing-market-head">{view.market.headline}</p>
          {view.market.count > 0 && <dl className="listing-market-range"><div><dt>비교 사례</dt><dd>{view.market.count}건</dd></div><div><dt>평당 범위</dt><dd>{formatUnitPricePerPyeong(view.market.min)} ~ {formatUnitPricePerPyeong(view.market.max)}</dd></div><div><dt>최근 거래일</dt><dd>{view.market.latestTradeDate}</dd></div></dl>}
          <ul className="listing-market-basis">{view.market.basis.map((line) => <li key={line}>{line}</li>)}</ul>
        </>}
        <h2 className="listing-report-head">전문 보고서</h2>
        <p className="trust-note">{view.readyReport ? `확정된 투자 분석 보고서 v${view.readyReport.version} (${view.readyReport.generatedAt}). 공개 게시 후 요청하면 받아 볼 수 있습니다.` : '아직 확정된 보고서가 없습니다. 확인된 자료만으로 1P 제안서·7P 상세보고서를 만듭니다.'}</p>
      </aside>
    </div>

    <p className="listing-staff-link"><FolderSharedOutlined /> <Link to={`/property/${encodeURIComponent(id)}`}>업무 화면에서 이 물건 열기</Link> <small>(내부 미리보기에만 보이는 링크)</small></p>
  </div>;
}
