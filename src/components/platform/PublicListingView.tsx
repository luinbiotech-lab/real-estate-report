import type { ReactNode } from 'react';
import { Button } from '@mui/material';
import { ChatBubbleOutlineRounded, DescriptionOutlined, VerifiedOutlined } from '@mui/icons-material';
import { dueDiligenceProgress } from '../../domain/platform/evidenceLedger';
import { formatUnitPricePerPyeong } from '../../domain/propertyDetail/propertyDetailModel';
import { FACT_BADGE_LABEL } from '../../domain/platform/publicListing';
import type { PublicListingSnapshot } from '../../domain/platform/publicListingSnapshot';
import { RECORD_CLASS_LABEL } from '../../domain/sampleProperty';
import TrustGradeBadge, { TrustCriteriaList } from './TrustGradeBadge';
import BuildingPlaceholder from './BuildingPlaceholder';
import '../../public-listing.css';

/*
 * Buyer-facing listing layout (2026-11-18 design pass, 루치오: "디자인이 최우선, 첫인상"). Benchmarked on Zillow /
 * Rightmove detail pages: full-width visual, big price and key-fact chips, a sticky contact card on PC, sections below.
 * DA:ON's own blocks (값별 근거, 매수 전 확인표, 시세 위치, 신뢰 등급 근거) keep their content and wording.
 * Renders ONLY the allowlist snapshot, in the workspace preview and on the public page alike (루인 #65).
 */

export type TrustState = 'loading' | 'error' | 'ready';

const KEY_FACTS = ['landAreaPyeong', 'totalFloorAreaSqm', 'unitPrice', 'zoning', 'groundFloors', 'completionDate'];

export default function PublicListingView({ view, trustState = 'ready', actions, footnote, banner }: {
  view: PublicListingSnapshot;
  trustState?: TrustState;
  /** Contact buttons. Omitted = the disabled preview buttons. */
  actions?: ReactNode;
  footnote?: ReactNode;
  banner?: ReactNode;
}) {
  const record = view.recordClass;
  const progress = view.checklist ? dueDiligenceProgress(view.checklist) : undefined;
  const verifiedCount = view.facts.filter((fact) => fact.badge === 'verified').length;
  const chips = KEY_FACTS.map((key) => view.facts.find((fact) => fact.key === key)).filter((fact): fact is NonNullable<typeof fact> => Boolean(fact));
  const contact = actions ?? <>
    <Button variant="contained" size="large" startIcon={<ChatBubbleOutlineRounded />} disabled>문의하기</Button>
    <Button variant="outlined" size="large" startIcon={<DescriptionOutlined />} disabled>투자 보고서 요청</Button>
  </>;

  return <article className="pl">
    {banner}
    <div className={`pl-gallery listing-photo ${view.photo ? 'has-photo' : ''}`}>
      {view.photo ? <img src={view.photo} alt="건물 외관" /> : <BuildingPlaceholder note={view.photoNote} place={view.place} />}
    </div>

    <div className="pl-body">
      <div className="pl-main">
        <header className="pl-head">
          <div className="pl-tags">
            <TrustGradeBadge grade={view.grade} size="large" />
            {verifiedCount > 0 && <span className="pl-verified"><VerifiedOutlined /> 공적서류 확인 {verifiedCount}개 값</span>}
            {record !== 'operational' && <em className="explore-sample">{RECORD_CLASS_LABEL[record]}</em>}
          </div>
          <h1>{view.title}</h1>
          <p className="pl-price">{view.priceText}<small>{view.tradeType}</small></p>
          {chips.length > 0 && <ul className="pl-chips" aria-label="핵심 정보">{chips.map((fact) => <li key={fact.key}><small>{fact.label}</small><b>{fact.value}</b></li>)}</ul>}
        </header>

        <section className="pl-section listing-facts" aria-label="매물 정보">
          <h2>매물 정보</h2>
          <p className="pl-lead">값마다 근거 표시가 붙습니다. <b>공식확인</b>은 공적서류로 확인한 값, <b>중개사 입력</b>은 아직 서류로 확인하지 않은 값, <b>계산값</b>은 입력값으로 계산한 값입니다.</p>
          <dl>{view.facts.map((fact) => { const proof = fact.proof; return <div key={fact.key}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}<span className={`fact-badge badge-${fact.badge}`}>{FACT_BADGE_LABEL[fact.badge]}</span></dd>
            {proof && <small className="fact-proof">근거: {proof.sources.length ? proof.sources.join(' / ') : '출처 기록 없음'}{proof.verifiedAt && ` · ${proof.verifiedAt} 담당자 확인`}</small>}
            {fact.badge === 'calculated' && <small className="fact-proof">매매가 ÷ 대지면적 계산값 (실거래가 아님)</small>}
          </div>; })}</dl>
          {view.pending.length > 0 && <p className="listing-pending"><b>확인 중</b> {view.pending.join(' · ')}</p>}
        </section>

        <section className="pl-section listing-checklist" aria-label="매수 전 확인표">
          <h2>매수 전 확인표{progress && <small>{progress.done}/{progress.total} 완료</small>}</h2>
          {progress && <div className="pl-progress" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}><span style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }} /></div>}
          <p className="pl-lead">사기 전에 확인해야 할 서류와 항목입니다. 끝나지 않은 항목도 숨기지 않습니다.</p>
          {trustState === 'loading' && <p className="pl-lead">확인표를 만드는 중입니다.</p>}
          {trustState === 'error' && <p className="pl-lead">자료실을 읽지 못해 확인표를 만들지 않았습니다.</p>}
          {view.checklist && <ul className="checklist-rows">{view.checklist.map((row) => <li key={row.key} className={`state-${row.state}`}><span className="checklist-mark" aria-hidden="true">{row.state === 'done' ? '✓' : row.state === 'partial' ? '△' : '○'}</span><span><b>{row.label}</b><small>{row.detail}</small></span></li>)}</ul>}
        </section>

        <section className="pl-section listing-market" aria-label="시세 위치">
          <h2>시세 위치</h2>
          {view.market ? <>
            <p className="listing-market-head">{view.market.headline}</p>
            {view.market.count > 0 && <dl className="listing-market-range"><div><dt>비교 사례</dt><dd>{view.market.count}건</dd></div><div><dt>평당 범위</dt><dd>{formatUnitPricePerPyeong(view.market.min)} ~ {formatUnitPricePerPyeong(view.market.max)}</dd></div><div><dt>최근 거래일</dt><dd>{view.market.latestTradeDate}</dd></div></dl>}
            <ul className="listing-market-basis">{view.market.basis.map((line) => <li key={line}>{line}</li>)}</ul>
          </> : <p className="pl-lead">비교할 거래 후보가 아직 없습니다. 추정 시세는 표시하지 않습니다.</p>}
        </section>

        <section className="pl-section listing-trust" aria-label="신뢰 등급 근거">
          <h2>신뢰 등급 근거</h2>
          {trustState === 'loading' && <p className="pl-lead">등급을 계산하는 중입니다.</p>}
          {trustState === 'error' && <p className="pl-lead">자료실을 읽지 못해 등급을 계산하지 않았습니다. 추정 등급은 표시하지 않습니다.</p>}
          {trustState === 'ready' && view.grade && <><p className="pl-lead">{view.grade.hint}</p><TrustCriteriaList grade={view.grade} /></>}
          <p className="platform-footnote">등급은 자료실에 실제로 있는 서류와 사람이 확인한 값만으로 계산합니다. 자동 수집 값은 확인 전까지 등급을 올리지 않습니다.</p>
        </section>
      </div>

      <aside className="pl-side" aria-label="문의">
        <div className="pl-card">
          <p className="pl-card-price">{view.priceText}<small>{view.tradeType}</small></p>
          <p className="pl-card-place">{view.title}</p>
          <div className="pl-card-actions listing-actions">{contact}</div>
          {view.office && <dl className="pl-office" aria-label="중개사무소 정보">
            <div><dt>중개사무소</dt><dd>{view.office.name}</dd></div>
            <div><dt>대표</dt><dd>{view.office.representative}</dd></div>
            <div><dt>등록번호</dt><dd>{view.office.registrationNumber}</dd></div>
            <div><dt>소재지</dt><dd>{view.office.address}</dd></div>
            <div><dt>전화</dt><dd><a href={`tel:${view.office.phone.replace(/[^0-9+]/g, '')}`}>{view.office.phone}</a></dd></div>
          </dl>}
          {footnote && <div className="pl-card-note">{footnote}</div>}
          <div className="pl-card-report">
            <DescriptionOutlined />
            <span><b>전문 보고서</b>{view.readyReport ? `확정된 투자 분석 보고서 v${view.readyReport.version} (${view.readyReport.generatedAt})가 있습니다.` : '확인된 자료만으로 1P 제안서·7P 상세보고서를 만듭니다.'}</span>
          </div>
        </div>
      </aside>
    </div>
  </article>;
}
