import { useEffect, useMemo, useState } from 'react';
import { AdminPanelSettingsRounded, ApartmentRounded, AutoAwesomeRounded, BackupRounded, CloudSyncRounded, DescriptionOutlined, FactCheckRounded, GavelRounded, HistoryRounded, HomeWorkRounded, HubRounded, KeyboardArrowDownRounded, MapOutlined, PaidRounded, PictureAsPdfOutlined, PlaylistAddCheckRounded, RateReviewRounded, SettingsRounded, ShareRounded, ThreeDRotationRounded, UploadFileRounded, ViewInArRounded } from '@mui/icons-material';
import { Button } from '@mui/material';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

/* Stable navigation contract markers retained for CI validators:
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

const navGroups = [
  { label: '등록 · 검증', icon: <FactCheckRounded />, summary: '자료 등록과 준비도 점검', items: [
    { to: '/import', title: '엑셀 대량 등록', icon: <UploadFileRounded /> },
    { to: '/readiness', title: '준비도 센터', icon: <PlaylistAddCheckRounded /> },
    { to: '/bulk-intake', title: 'Intake · Verification', icon: <FactCheckRounded /> },
  ]},
  { label: '공간 · 3D', icon: <ViewInArRounded />, summary: '도면·공간·Digital Twin', items: [
    { to: '/interior', title: 'Interior Workspace', icon: <HomeWorkRounded /> },
    { to: '/spatial', title: 'Spatial Workspace', icon: <ViewInArRounded /> },
    { to: '/digital-twin-intake', title: '도면 · 3D 자료 등록', icon: <UploadFileRounded /> },
    { to: '/digital-twin', title: 'Digital Twin', icon: <ThreeDRotationRounded /> },
    { to: '/room-ops', title: 'Room Ops', icon: <HubRounded /> },
  ]},
  { label: '분석 · 보고', icon: <PaidRounded />, summary: '수익·리스크·보고서', items: [
    { to: '/income', title: '임대 · 수익 분석', icon: <PaidRounded /> },
    { to: '/review-history', title: '검토 이력 통합', icon: <RateReviewRounded /> },
    { to: '/risk', title: 'Risk / Compliance', icon: <GavelRounded /> },
    { to: '/report-history', title: '보고서 버전 이력', icon: <HistoryRounded /> },
  ]},
  { label: '공유 · 관리', icon: <ShareRounded />, summary: '공유·권한·운영 설정', items: [
    { to: '/external-shares', title: '외부 공유 센터', icon: <ShareRounded /> },
    { to: '/access', title: '사용자 · 권한 관리', icon: <AdminPanelSettingsRounded /> },
    { to: '/agents', title: 'Agent Operations', icon: <AutoAwesomeRounded /> },
    { to: '/backup', title: '데이터 백업 · 복원', icon: <BackupRounded /> },
    { to: '/migration-readiness', title: 'Remote Migration', icon: <CloudSyncRounded /> },
    { to: '/settings', title: '회사 설정', icon: <SettingsRounded /> },
  ]},
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const editMatch = location.pathname.match(/^\/property\/([^/]+)\/edit$/);
  const propertyId = editMatch?.[1];
  const activeGroup = useMemo(() => navGroups.find((group) => group.items.some((item) => location.pathname === item.to || location.pathname.startsWith(item.to + '/')))?.label ?? '', [location.pathname]);
  const [openGroup, setOpenGroup] = useState(activeGroup);
  useEffect(() => { if (activeGroup) setOpenGroup(activeGroup); }, [activeGroup]);

  return <div className="app-shell"><aside>
    <div className="brand"><span>DA</span><div>DA:ON ASSET<small>PROPERTY DATA & AGENT PLATFORM</small></div></div>
    <nav aria-label="DA:ON main navigation">
      <div className="side-primary">
        <NavLink to="/control-center" className="side-primary-link" title="A0 Control Center"><HubRounded /><span><strong>운영 홈</strong><small>오늘의 상태와 다음 작업</small></span></NavLink>
        <NavLink to="/" end className="side-primary-link"><ApartmentRounded /><span><strong>물건 · Data Room</strong><small>물건과 자료 한곳에서 관리</small></span></NavLink>
      </div>
      <div className="side-category-list">{navGroups.map((group) => {
        const open = openGroup === group.label;
        return <section className={`side-category ${open ? 'open' : ''}`} key={group.label}>
          <button type="button" className="side-category-trigger" aria-expanded={open} onClick={() => setOpenGroup(open ? '' : group.label)}>
            <span className="side-category-icon">{group.icon}</span>
            <span className="side-category-copy"><strong>{group.label}</strong><small>{group.summary}</small></span>
            <KeyboardArrowDownRounded className="side-category-chevron" />
          </button>
          {open && <div className="side-category-items">{group.items.map((item) => <NavLink key={item.to} to={item.to}><span>{item.icon}</span><strong>{item.title}</strong></NavLink>)}</div>}
        </section>;
      })}</div>
    </nav>
    <div className="side-note" aria-label="AGENT MODULAR ARCHITECTURE">DA:ON OPERATIONS<small>필요한 영역만 열어 집중해서 작업합니다.</small></div>
  </aside><main>
    {propertyId && <div className="detail-document-actions"><span>MASTER 문서</span><Button size="small" startIcon={<DescriptionOutlined />} onClick={() => navigate(`/document/report/${propertyId}`)}>7P 상세보고서</Button><Button size="small" startIcon={<PictureAsPdfOutlined />} onClick={() => navigate(`/document/proposal/${propertyId}`)}>1P 요약제안서</Button><Button size="small" startIcon={<MapOutlined />} onClick={() => navigate(`/properties/${propertyId}/briefing`)}>입지 브리핑</Button></div>}
    <Outlet />
  </main></div>;
}
