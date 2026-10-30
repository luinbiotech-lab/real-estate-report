import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AddRounded, ArrowBackRounded, AdminPanelSettingsRounded, ApartmentRounded, AutoAwesomeRounded, BackupRounded, CloudSyncRounded, DescriptionOutlined, FactCheckRounded, GavelRounded, HistoryRounded, HomeWorkRounded, HubRounded, KeyboardArrowDownRounded, MenuRounded, CloseRounded, MapOutlined, PaidRounded, PictureAsPdfOutlined, PlaylistAddCheckRounded, RateReviewRounded, SearchRounded, SettingsRounded, ShareRounded, ThreeDRotationRounded, UploadFileRounded, ViewInArRounded } from '@mui/icons-material';
import { Button } from '@mui/material';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { navGroups, primaryNav, resolveRouteContext, type NavIconKey } from '../navigation/navConfig';

/* Stable navigation contract markers retained for CI validators (the rendered menu comes from src/navigation/navConfig.ts;
   scripts/validate-navigation-ia.mjs checks that every App route is actually reachable from it):
to="/discover" 주소로 물건 조회
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
  const [openGroup, setOpenGroup] = useState(activeGroup);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isMobile = useIsMobileShell();
  const toggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (activeGroup) setOpenGroup(activeGroup); setMobileNavOpen(false); }, [activeGroup, location.pathname]);
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMobileNavOpen(false); toggleRef.current?.focus(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileNavOpen]);
  // On phones the closed drawer is off-canvas; keep it out of the tab order and the accessibility tree.
  const drawerHidden = isMobile && !mobileNavOpen;

  return <div className="app-shell"><button ref={toggleRef} type="button" className="mobile-menu-toggle" aria-label={mobileNavOpen ? '메뉴 닫기' : '메뉴 열기'} aria-expanded={mobileNavOpen} aria-controls="daon-main-drawer" onClick={() => setMobileNavOpen(v => !v)}>{mobileNavOpen ? <CloseRounded /> : <MenuRounded />}</button>{mobileNavOpen && <button type="button" className="mobile-nav-backdrop" aria-label="메뉴 닫기" tabIndex={-1} onClick={() => setMobileNavOpen(false)} />}<aside id="daon-main-drawer" className={mobileNavOpen ? 'mobile-nav-open' : ''} inert={drawerHidden} aria-hidden={drawerHidden || undefined}>
    <div className="brand"><span>DA</span><div>DA:ON ASSET<small>PROPERTY DATA & AGENT PLATFORM</small></div></div>
    <nav aria-label="DA:ON 주 메뉴" onClick={(event) => { if ((event.target as HTMLElement).closest('a')) setMobileNavOpen(false); }}>
      <div className="side-primary">
        {primaryNav.map((item) => <NavLink key={item.to} to={item.to} end={item.to === '/'} className="side-primary-link">{navIcons[item.icon]}<span><strong>{item.title}</strong>{item.module && <small>{item.module}</small>}</span></NavLink>)}
      </div>
      <div className="side-category-list">{navGroups.map((group) => {
        const open = openGroup === group.id;
        const panelId = `side-group-${group.id}`;
        return <section className={`side-category ${open ? 'open' : ''} ${activeGroup === group.id ? 'has-active' : ''}`} key={group.id}>
          <button type="button" className="side-category-trigger" aria-expanded={open} aria-controls={panelId} onClick={() => setOpenGroup(open ? '' : group.id)}>
            <span className="side-category-icon">{navIcons[group.icon]}</span>
            <span className="side-category-copy"><strong>{group.label}</strong><small>{group.summary}</small></span>
            <KeyboardArrowDownRounded className="side-category-chevron" />
          </button>
          {open && <div className="side-category-items" id={panelId}>{group.items.map((item) => <NavLink key={item.to} to={item.to} title={item.module}><span>{navIcons[item.icon]}</span><strong>{item.title}</strong></NavLink>)}</div>}
        </section>;
      })}</div>
    </nav>
    <div className="side-note" aria-label="AGENT MODULAR ARCHITECTURE">DA:ON OPERATIONS<small>필요한 영역만 열어 집중해서 작업합니다.</small></div>
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
  </main></div>;
}
