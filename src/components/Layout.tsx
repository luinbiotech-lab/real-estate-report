import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { activeBrand } from '../brand/activeBrand';
import { AddRounded, ArrowBackRounded, AnalyticsRounded, FormatListBulletedRounded, HomeRounded, MenuRounded, AdminPanelSettingsRounded, ApartmentRounded, AutoAwesomeRounded, BackupRounded, CloudSyncRounded, DescriptionOutlined, FactCheckRounded, GavelRounded, HistoryRounded, HomeWorkRounded, HubRounded, KeyboardArrowDownRounded, CloseRounded, MapOutlined, PaidRounded, PictureAsPdfOutlined, PlaylistAddCheckRounded, RateReviewRounded, SearchRounded, SettingsRounded, ShareRounded, ThreeDRotationRounded, UploadFileRounded, ViewInArRounded } from '@mui/icons-material';
import { Button } from '@mui/material';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { bottomTabOf, bottomTabs, groupById, primaryNav, resolveRouteContext, type NavIconKey, type NavSection } from '../navigation/navConfig';

/* Stable navigation contract markers retained for CI validators (the rendered menu comes from src/navigation/navConfig.ts;
   scripts/validate-navigation-ia.mjs checks that every App route is actually reachable from it):
to="/discover" 조회 (주소로 물건 조회)
to="/control-center" A0 Control Center
to="/readiness" Property Readiness
to="/bulk-intake" A1–A3 Intake · Verification
to="/interior" A4–A5 Interior Workspace
to="/spatial" A6 Spatial Workspace
to="/digital-twin-intake" 3D · 도면 자료 등록
to="/digital-twin" A6–A7 Digital Twin
to="/income" 임대 · 수익 분석
to="/review-history" 검토 이력 통합
to="/external-shares" 외부 공유 센터
to="/access" 사용자 · 권한 관리
to="/room-ops" A5/A8/A10 Room Ops
to="/risk" A9 Risk / Compliance
to="/agents" Agent Operations
to="/report-history" 보고서 버전 이력
to="/import" 엑셀 대량 등록
to="/backup" 데이터 백업 · 복원
to="/migration-readiness" Remote Migration 준비
to="/settings" 회사 설정
AGENT MODULAR ARCHITECTURE
*/
// Navigation validation contracts: to="/report-history" to="/digital-twin-intake" to="/income" to="/review-history" to="/external-shares"

const navIcons: Record<NavIconKey, ReactNode> = {
  home: <HomeRounded />, list: <FormatListBulletedRounded />, analysis: <AnalyticsRounded />, menu: <MenuRounded />, search: <SearchRounded />, add: <AddRounded />, upload: <UploadFileRounded />, intake: <FactCheckRounded />,
  readiness: <PlaylistAddCheckRounded />, review: <RateReviewRounded />, risk: <GavelRounded />, report: <HistoryRounded />, share: <ShareRounded />,
  income: <PaidRounded />, interior: <HomeWorkRounded />, spatial: <ViewInArRounded />, twinIntake: <UploadFileRounded />, twin: <ThreeDRotationRounded />,
  roomOps: <HubRounded />, access: <AdminPanelSettingsRounded />, control: <HubRounded />, agents: <AutoAwesomeRounded />, backup: <BackupRounded />,
  migration: <CloudSyncRounded />, settings: <SettingsRounded />,
  groupProperty: <ApartmentRounded />, groupVerify: <FactCheckRounded />, groupReport: <DescriptionOutlined />, groupAnalysis: <ViewInArRounded />, groupOps: <SettingsRounded />,
};

const MOBILE_QUERY = '(max-width: 900px)';

function useIsMobileShell() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches);
  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return mobile;
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const editMatch = location.pathname.match(/^\/property\/([^/]+)\/edit$/);
  const propertyId = editMatch?.[1];
  const route = useMemo(() => resolveRouteContext(location.pathname), [location.pathname]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // 전문 분석 / 연동·운영 blocks stay folded unless one of their screens is open (or the user unfolds them).
  const [openAdvanced, setOpenAdvanced] = useState<string>(route.groupId === 'advanced' || route.groupId === 'integrations' ? route.groupId : '');
  const isMobile = useIsMobileShell();
  const toggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setMobileNavOpen(false);
    if (route.groupId === 'advanced' || route.groupId === 'integrations') setOpenAdvanced(route.groupId);
  }, [location.pathname, route.groupId]);
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMobileNavOpen(false); toggleRef.current?.focus(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileNavOpen]);
  // On phones the closed drawer is off-canvas; keep it out of the tab order and the accessibility tree.
  const drawerHidden = isMobile && !mobileNavOpen;
  const activeTab = bottomTabOf(location.pathname);

  /* One section = its own page link + its sub-pages listed underneath + an optional folded block (전문 분석 / 연동·운영). */
  const renderSection = (section: NavSection) => {
    const sub = section.group ? groupById(section.group).items : [];
    const advanced = section.advanced ? groupById(section.advanced) : undefined;
    const sectionActive = route.sectionId === section.id;
    return <section key={section.id} className={`side-section ${sectionActive ? 'has-active' : ''}`} data-section={section.id}>
      <NavLink to={section.to} end className={`side-primary-link ${sectionActive ? 'section-active' : ''}`}>{navIcons[section.icon]}<span><strong>{section.title}</strong>{section.module && <small>{section.module}</small>}</span></NavLink>
      {(sub.length > 0 || advanced) && <div className="side-section-items">
        {sub.map((item) => <NavLink key={item.to} to={item.to} title={item.module}><span>{navIcons[item.icon]}</span><strong>{item.title}</strong></NavLink>)}
        {advanced && <>
          <button type="button" className="side-advanced-toggle" aria-expanded={openAdvanced === advanced.id} aria-controls={`side-advanced-${advanced.id}`} onClick={() => setOpenAdvanced(openAdvanced === advanced.id ? '' : advanced.id)}><span>{navIcons[advanced.icon]}</span><strong>{advanced.label}</strong><small>{advanced.items.length}</small><KeyboardArrowDownRounded className="side-category-chevron" /></button>
          {openAdvanced === advanced.id && <div className="side-advanced-items" id={`side-advanced-${advanced.id}`}>{advanced.items.map((item) => <NavLink key={item.to} to={item.to} title={item.module}><span>{navIcons[item.icon]}</span><strong>{item.title}</strong></NavLink>)}</div>}
        </>}
      </div>}
    </section>;
  };

  return <div className="app-shell">{mobileNavOpen && <button type="button" className="mobile-nav-backdrop" aria-label="메뉴 닫기" tabIndex={-1} onClick={() => setMobileNavOpen(false)} />}<aside id="daon-main-drawer" aria-label={isMobile ? '전체 메뉴' : undefined} className={mobileNavOpen ? 'mobile-nav-open' : ''} inert={drawerHidden} aria-hidden={drawerHidden || undefined}>
    {isMobile && <button type="button" className="mobile-drawer-close" aria-label="메뉴 닫기" onClick={() => { setMobileNavOpen(false); toggleRef.current?.focus(); }}><CloseRounded /></button>}<Link to="/" className="brand" aria-label="DA:ON 홈"><span aria-hidden="true">{activeBrand.mark}</span><div>{activeBrand.name}<small>{activeBrand.tagline}</small></div></Link>
    <nav aria-label="DA:ON 주 메뉴" onClick={(event) => { if ((event.target as HTMLElement).closest('a')) setMobileNavOpen(false); }}>
      <div className="side-primary">{primaryNav.map(renderSection)}</div>
    </nav>
  </aside><main>
    {route.crumbs.length > 0 && <div className="shell-context-bar">
      {route.parent && <Button size="small" className="shell-back" startIcon={<ArrowBackRounded />} onClick={() => navigate(route.parent!.to)}>{route.parent.label}</Button>}
      <nav aria-label="현재 위치" className="shell-breadcrumbs"><ol>{route.crumbs.map((crumb, index) => {
        const last = index === route.crumbs.length - 1;
        return <li key={`${crumb.label}-${index}`}>{crumb.to && !last ? <Link to={crumb.to}>{crumb.label}</Link> : <span aria-current={last ? 'page' : undefined}>{crumb.label}</span>}</li>;
      })}</ol></nav>
    </div>}
    {propertyId && <div className="detail-document-actions"><span>MASTER 문서</span><Button size="small" startIcon={<DescriptionOutlined />} onClick={() => navigate(`/document/report/${propertyId}`)}>7P 상세보고서</Button><Button size="small" startIcon={<PictureAsPdfOutlined />} onClick={() => navigate(`/document/proposal/${propertyId}`)}>1P 요약제안서</Button><Button size="small" startIcon={<MapOutlined />} onClick={() => navigate(`/properties/${propertyId}/briefing`)}>입지 브리핑</Button></div>}
    <Outlet />
  </main>{isMobile && <div role="navigation" className="bottom-tabs" aria-label="하단 메뉴">{bottomTabs.map((tab) => {
    const active = activeTab === tab.key;
    const body = <>{navIcons[tab.icon]}<span>{tab.label}</span></>;
    return tab.to
      ? <Link key={tab.key} to={tab.to} className={`bottom-tab ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>{body}</Link>
      : <button key={tab.key} ref={toggleRef} type="button" className={`bottom-tab ${active ? 'active' : ''}`} aria-expanded={mobileNavOpen} aria-controls="daon-main-drawer" onClick={() => setMobileNavOpen(true)}>{body}</button>;
  })}</div>}</div>;
}
