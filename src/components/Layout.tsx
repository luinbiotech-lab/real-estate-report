import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { activeBrand } from '../brand/activeBrand';
import { AddRounded, ArrowBackRounded, AdminPanelSettingsRounded, ApartmentRounded, AutoAwesomeRounded, BackupRounded, CloudSyncRounded, DescriptionOutlined, FactCheckRounded, GavelRounded, HistoryRounded, HomeWorkRounded, HubRounded, KeyboardArrowDownRounded, CloseRounded, MapOutlined, PaidRounded, PictureAsPdfOutlined, PlaylistAddCheckRounded, RateReviewRounded, SearchRounded, SettingsRounded, ShareRounded, ThreeDRotationRounded, UploadFileRounded, ViewInArRounded } from '@mui/icons-material';
import { Button } from '@mui/material';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { bottomTabOf, bottomTabs, isMenuPanelPath, menuPanelGroups, primaryNav, resolveRouteContext, type NavIconKey } from '../navigation/navConfig';

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
  home: <HubRounded />, search: <SearchRounded />, add: <AddRounded />, upload: <UploadFileRounded />, intake: <FactCheckRounded />,
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
  const activeGroup = route.groupId ?? '';
  // '설정' opens one panel holding admin screens first and every other screen below.
  const panelActive = isMenuPanelPath(location.pathname);
  const [openGroup, setOpenGroup] = useState(panelActive ? 'settings' : '');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isMobile = useIsMobileShell();
  const toggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (panelActive) setOpenGroup('settings'); setMobileNavOpen(false); }, [panelActive, location.pathname]);
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMobileNavOpen(false); toggleRef.current?.focus(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileNavOpen]);
  // On phones the closed drawer is off-canvas; keep it out of the tab order and the accessibility tree.
  const drawerHidden = isMobile && !mobileNavOpen;
  const panelOpen = isMobile ? mobileNavOpen : openGroup === 'settings';
  const activeTab = bottomTabOf(location.pathname);
  const openSettings = () => { setOpenGroup('settings'); setMobileNavOpen(true); };

  return <div className="app-shell">{mobileNavOpen && <button type="button" className="mobile-nav-backdrop" aria-label="메뉴 닫기" tabIndex={-1} onClick={() => setMobileNavOpen(false)} />}<aside id="daon-main-drawer" aria-label={isMobile ? '설정' : undefined} className={mobileNavOpen ? 'mobile-nav-open' : ''} inert={drawerHidden} aria-hidden={drawerHidden || undefined}>
    {isMobile && <button type="button" className="mobile-drawer-close" aria-label="메뉴 닫기" onClick={() => { setMobileNavOpen(false); toggleRef.current?.focus(); }}><CloseRounded /></button>}<div className="brand"><span aria-hidden="true">{activeBrand.mark}</span><div>{activeBrand.name}<small>{activeBrand.tagline}</small></div></div>
    <nav aria-label="DA:ON 주 메뉴" onClick={(event) => { if ((event.target as HTMLElement).closest('a')) setMobileNavOpen(false); }}>
      {!isMobile && <div className="side-primary">
        {primaryNav.map((item) => <NavLink key={item.to} to={item.to} end={item.to === '/'} className="side-primary-link">{navIcons[item.icon]}<span><strong>{item.title}</strong>{item.module && <small>{item.module}</small>}</span></NavLink>)}
        <button type="button" className={`side-primary-link side-settings-toggle ${panelActive ? 'has-active' : ''}`} aria-expanded={panelOpen} aria-controls="side-menu-panel" onClick={() => setOpenGroup(openGroup === 'settings' ? '' : 'settings')}>{navIcons.settings}<span><strong>설정</strong><small>회사 · 권한 · 백업 · 전문 분석</small></span><KeyboardArrowDownRounded className="side-category-chevron" /></button>
      </div>}
      {panelOpen && <div className="side-menu-panel" id="side-menu-panel">{menuPanelGroups().map((group) => <section className={`side-menu-section ${activeGroup === group.id ? 'has-active' : ''}`} key={group.id}>
        <h2 className="side-menu-heading">{group.id === 'settings' ? '설정' : group.label}</h2>
        <div className="side-category-items">{group.items.map((item) => <NavLink key={item.to} to={item.to} title={item.module}><span>{navIcons[item.icon]}</span><strong>{item.title}</strong></NavLink>)}</div>
      </section>)}</div>}
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
      : <button key={tab.key} ref={toggleRef} type="button" className={`bottom-tab ${active ? 'active' : ''}`} aria-expanded={mobileNavOpen} aria-controls="daon-main-drawer" onClick={openSettings}>{body}</button>;
  })}</div>}</div>;
}
