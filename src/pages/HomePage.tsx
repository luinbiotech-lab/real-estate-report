import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, CircularProgress } from '@mui/material';
import { AddRounded, AnalyticsRounded, ArrowForwardRounded, DescriptionOutlined, FactCheckRounded, FormatListBulletedRounded, GavelRounded, HistoryRounded, SearchRounded, ShareRounded, SourceRounded, UploadFileRounded, VerifiedUserRounded } from '@mui/icons-material';
import { propertyRepository } from '../repositories/propertyRepository';
import { reportSnapshotHistoryService } from '../services/reportSnapshotHistoryService';
import { compareByUpdatedAtDesc } from '../domain/propertyRecordGuard';
import { classifyPropertyRecord, RECORD_CLASS_LABEL, splitSampleProperties } from '../domain/sampleProperty';
import { isCoreProfileReady } from '../components/PortfolioOperationsHub';
import { activeBrand } from '../brand/activeBrand';
import type { ReportSnapshot } from '../domain/propertyDataRoom/types';
import type { Property } from '../types';
import { formatWon } from '../utils/format';
import { PROPERTY_LIST_PATH } from '../navigation/navConfig';

/*
 * Site main page (2026-11-13, 루치오: "사이트 메인페이지도 있어야지. 바로 본론부터 들어가면 안돼").
 * Benchmarked on the landing pages of Redfin / Rightmove (hero + search entry + recent activity),
 * 디스코 / 밸류맵 (address lookup first, then my items) and CoStar (data-source trust band):
 *   1) hero with what DA:ON is and the two first actions, 2) 근거·검증·리포트 values,
 *   3) the work flow as entry cards, 4) recent properties and reports, 5) data sources and principles.
 * Rules: counts exclude sample/test records and say so when only samples exist; no figure is shown that was not loaded.
 * Live connection status belongs to 설정 (회사 설정 › 데이터 연결), not the main page (coordinator review, PR #62).
 */

type LoadState = 'loading' | 'ready' | 'error';
type RecentReport = { snapshot: ReportSnapshot; property: Property };

const STATUS_LABEL: Record<ReportSnapshot['status'], string> = { draft: '초안', ready: '확정', archived: '보관', failed: '실패' };

const VALUES = [
  { icon: <SourceRounded />, title: '근거', body: '공식 자료·제공 문서마다 출처와 수집 시점을 남깁니다. 실제값·계산값·추정값을 섞지 않습니다.' },
  { icon: <VerifiedUserRounded />, title: '검증', body: '자동 수집 결과는 후보로만 올라오고, 사람이 확인해야 확정됩니다. 비교거래는 동일 건물로 단정하지 않습니다.' },
  { icon: <DescriptionOutlined />, title: '리포트', body: '확정된 자료만 1P 제안서·7P 상세보고서(MASTER)로 만들고, 버전별 스냅샷으로 보관·공유합니다.' },
];

const FLOW: Array<{ step: string; title: string; detail: string; to: string; icon: ReactNode; more?: Array<{ label: string; to: string }> }> = [
  { step: '1', title: '물건', detail: '주소로 조회해 등록하고 목록·지도에서 관리', to: PROPERTY_LIST_PATH, icon: <FormatListBulletedRounded />, more: [{ label: '주소 조회', to: '/discover' }, { label: '엑셀 대량 등록', to: '/import' }] },
  { step: '2', title: '자료 · 검증', detail: '공적자료·문서·사진을 붙이고 검증 후보를 확인', to: '/bulk-intake', icon: <FactCheckRounded />, more: [{ label: '검토 이력', to: '/review-history' }] },
  { step: '3', title: '분석', detail: '준비도·시세 위치·리스크·임대수익 검토', to: '/readiness', icon: <AnalyticsRounded />, more: [{ label: '리스크 · 규제', to: '/risk' }, { label: '임대 · 수익', to: '/income' }] },
  { step: '4', title: '보고서 · 공유', detail: '1P·7P 보고서 생성, 버전 이력, 외부 공유', to: '/report-history', icon: <ShareRounded />, more: [{ label: '외부 공유', to: '/external-shares' }] },
];

/** Sources DA:ON reads from (what each is used for). Their live connection status is shown in 설정, not here. */
const SOURCES = [
  { name: '국토교통부 실거래가', use: '공공데이터포털 · 비교거래 후보' },
  { name: '건축물대장 (건축HUB)', use: '공공데이터포털 · 건물 공식 정보' },
  { name: 'VWorld 토지정보', use: '공시지가 · 토지 특성 · 용도지역' },
  { name: '카카오 주소 · 지도', use: '주소 → 좌표 · 법정동 · 지도' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Property[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [reports, setReports] = useState<RecentReport[]>([]);
  const [reportState, setReportState] = useState<LoadState>('loading');

  useEffect(() => {
    let active = true;
    propertyRepository.getAll().then(async (values) => {
      if (!active) return;
      const sorted = [...values].sort(compareByUpdatedAtDesc);
      setItems(sorted); setLoadState('ready');
      // Recent reports: the latest snapshots across the most recently updated properties (bounded, one failure never blanks the list).
      const settled = await Promise.allSettled(sorted.slice(0, 30).map(async (property) => (await reportSnapshotHistoryService.list(property.id)).map(({ snapshot }) => ({ snapshot, property }))));
      if (!active) return;
      const rows = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
        .filter((row) => row.snapshot.status !== 'archived')
        .sort((a, b) => String(b.snapshot.generatedAt).localeCompare(String(a.snapshot.generatedAt)));
      setReports(rows.slice(0, 4)); setReportState(settled.some((result) => result.status === 'rejected') && !rows.length ? 'error' : 'ready');
    }).catch(() => { if (active) { setLoadState('error'); setReportState('error'); } });
    return () => { active = false; };
  }, []);

  const { real, samples } = useMemo(() => splitSampleProperties(items), [items]);
  const needsProfile = real.filter((item) => !isCoreProfileReady(item)).length;
  const recent = items.slice(0, 4);
  const readyReports = reports.filter((row) => row.snapshot.status === 'ready').length;
  const sampleOnly = loadState === 'ready' && real.length === 0 && samples.length > 0;

  return <div className="home-page">
    <section className="home-hero" aria-label="DA:ON 소개">
      <div className="home-hero-copy">
        <p className="home-hero-eyebrow">{activeBrand.name} · 부동산 전문 리포트 플랫폼</p>
        <h1>근거로 확인하고, 검증해서,<br />보고서로 전달합니다.</h1>
        <p className="home-hero-lead">주소 하나로 공적자료를 모으고, 사람이 확인한 자료만 1P·7P 전문 보고서로 만듭니다. 실제값·계산값·추정값은 화면과 보고서 모두에서 구분해 표시합니다.</p>
        <div className="home-hero-actions">
          <Button variant="contained" size="large" startIcon={<SearchRounded />} onClick={() => navigate('/discover')}>주소로 물건 조회</Button>
          <Button variant="outlined" size="large" startIcon={<FormatListBulletedRounded />} onClick={() => navigate(PROPERTY_LIST_PATH)}>물건 목록</Button>
          <Button size="large" startIcon={<AddRounded />} onClick={() => navigate('/property/new')}>새 물건 등록</Button>
        </div>
        {sampleOnly && <p className="home-sample-note" role="note">현재 운영 물건은 없고 샘플·테스트 물건 {samples.length}건만 있습니다. 아래 &lsquo;최근 물건&rsquo;은 샘플 표시이며 현황 숫자에는 넣지 않습니다.</p>}
      </div>
      <dl className="home-hero-kpis" aria-label="현재 현황">
        {loadState === 'loading' && <div className="is-loading"><CircularProgress size={18} /> <span>현황을 불러오는 중</span></div>}
        {loadState === 'error' && <div className="is-error"><dt>현황</dt><dd>불러오지 못함</dd></div>}
        {loadState === 'ready' && <>
          <div><dt>운영 물건</dt><dd>{real.length}</dd><small>샘플 · 테스트 {samples.length}건 제외</small></div>
          <div><dt>기본정보 보완 필요</dt><dd>{needsProfile}</dd><small>주소 · 면적 · 담당자 기준</small></div>
          <div><dt>최근 보고서</dt><dd>{reportState === 'ready' ? reports.length : '-'}</dd><small>{reportState === 'ready' ? `확정 ${readyReports}건` : reportState === 'loading' ? '불러오는 중' : '불러오지 못함'}</small></div>
        </>}
      </dl>
    </section>

    <section className="home-values" aria-label="핵심 가치">
      {VALUES.map((value) => <article key={value.title}><span className="home-value-icon">{value.icon}</span><h2>{value.title}</h2><p>{value.body}</p></article>)}
    </section>

    <section className="home-flow" aria-label="업무 흐름">
      <header className="home-section-head"><div><p className="eyebrow">WORK FLOW</p><h2>업무 흐름</h2></div><small>물건 → 자료·검증 → 분석 → 보고서·공유</small></header>
      <ol>{FLOW.map((item) => <li key={item.title}>
        <Link to={item.to} className="home-flow-main"><span className="home-flow-step">{item.step}</span><span className="home-flow-icon">{item.icon}</span><strong>{item.title}</strong><small>{item.detail}</small><ArrowForwardRounded className="home-flow-arrow" /></Link>
        {item.more && <div className="home-flow-more">{item.more.map((link) => <Link key={link.to} to={link.to}>{link.label}</Link>)}</div>}
      </li>)}</ol>
    </section>

    <div className="home-recent">
      <section aria-label="최근 물건">
        <header className="home-section-head"><div><p className="eyebrow">RECENT</p><h2>최근 물건{sampleOnly && <small className="home-head-tag">샘플 데이터 표시 중</small>}</h2></div><Link to={PROPERTY_LIST_PATH}>전체 보기</Link></header>
        {loadState === 'loading' && <p className="home-empty">불러오는 중입니다.</p>}
        {loadState === 'error' && <p className="home-empty">물건 목록을 불러오지 못했습니다. <Link to={PROPERTY_LIST_PATH}>물건 목록에서 다시 시도</Link></p>}
        {loadState === 'ready' && !recent.length && <p className="home-empty">등록된 물건이 없습니다. <Link to="/discover">주소로 조회해 첫 물건을 등록하세요.</Link></p>}
        {loadState === 'ready' && recent.length > 0 && <ul className="home-list">{recent.map((property) => {
          const recordClass = classifyPropertyRecord(property).recordClass;
          return <li key={property.id}><Link to={`/property/${encodeURIComponent(property.id)}`}>
            <span><strong>{property.name || property.address || '이름 없음'}</strong><small>{property.address || '주소 미입력'}</small></span>
            <span className="home-list-side"><b>{property.salePrice > 0 ? formatWon(property.salePrice) : '가격 미입력'}</b>{recordClass !== 'operational' && <em>{RECORD_CLASS_LABEL[recordClass]}</em>}{!isCoreProfileReady(property) && <em className="warn">보완 필요</em>}</span>
          </Link></li>;
        })}</ul>}
      </section>
      <section aria-label="최근 보고서">
        <header className="home-section-head"><div><p className="eyebrow">REPORTS</p><h2>최근 보고서</h2></div><Link to="/report-history">보고서 이력</Link></header>
        {reportState === 'loading' && <p className="home-empty">불러오는 중입니다.</p>}
        {reportState === 'error' && <p className="home-empty">보고서 이력을 불러오지 못했습니다.</p>}
        {reportState === 'ready' && !reports.length && <p className="home-empty">아직 만든 보고서가 없습니다. 물건 화면의 자료 탭에서 보고서를 만들 수 있습니다.</p>}
        {reportState === 'ready' && reports.length > 0 && <ul className="home-list">{reports.map(({ snapshot, property }) => <li key={snapshot.id}><Link to={`/professional-report/snapshot/${encodeURIComponent(snapshot.id)}`}>
          <span><strong>{property.name || property.address}</strong><small>v{snapshot.reportVersion} · {String(snapshot.generatedAt).slice(0, 10)}</small></span>
          <span className="home-list-side"><em className={`status-${snapshot.status}`}>{STATUS_LABEL[snapshot.status]}</em></span>
        </Link></li>)}</ul>}
      </section>
    </div>

    <section className="home-trust" aria-label="데이터 출처와 원칙">
      <header className="home-section-head"><div><p className="eyebrow">TRUST</p><h2>데이터 출처 · 원칙</h2></div><Link to="/settings">연결 상태는 설정에서 확인</Link></header>
      <div className="home-trust-grid">
        <ul className="home-sources">{SOURCES.map((row) => <li key={row.name}><span><strong>{row.name}</strong><small>{row.use}</small></span></li>)}</ul>
        <ul className="home-principles">
          <li><GavelRounded /> 자동 수집 자료는 사람 확인 전까지 &lsquo;후보&rsquo;입니다.</li>
          <li><HistoryRounded /> 보고서는 버전별 스냅샷으로 남고, 자료가 바뀌면 이전 스냅샷을 막습니다.</li>
          <li><UploadFileRounded /> 원본 값·단위·출처를 보존합니다(실거래가 만원 단위 원문 포함).</li>
          <li><VerifiedUserRounded /> API 키 등 비밀값은 서버에만 두고 화면·보고서에 노출하지 않습니다.</li>
        </ul>
      </div>
    </section>
  </div>;
}
