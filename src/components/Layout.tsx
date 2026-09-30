import { AdminPanelSettingsRounded, ApartmentRounded, AutoAwesomeRounded, BackupRounded, CloudSyncRounded, DescriptionOutlined, FactCheckRounded, GavelRounded, HistoryRounded, HomeWorkRounded, HubRounded, MapOutlined, PaidRounded, PictureAsPdfOutlined, PlaylistAddCheckRounded, RateReviewRounded, SettingsRounded, ShareRounded, ThreeDRotationRounded, UploadFileRounded, ViewInArRounded } from '@mui/icons-material';
import { Button } from '@mui/material';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

const navGroups = [
  {
    label: '운영 홈',
    items: [
      { to: '/control-center', title: 'Control Center', detail: '전체 운영 현황', badge: 'A0', icon: <HubRounded /> },
      { to: '/', title: '물건 · Data Room', detail: '물건 목록과 자료실', badge: 'DB', icon: <ApartmentRounded />, end: true },
    ],
  },
  {
    label: '등록 · 검증',
    items: [
      { to: '/import', title: '엑셀 대량 등록', detail: '물건 데이터 일괄 Intake', badge: 'XLS', icon: <UploadFileRounded /> },
      { to: '/readiness', title: '준비도 센터', detail: '보완 항목 점검', badge: '7', icon: <PlaylistAddCheckRounded /> },
      { to: '/bulk-intake', title: 'Intake · Verification', detail: '대량 자료 등록과 검증', badge: 'A1', icon: <FactCheckRounded /> },
    ],
  },
  {
    label: '공간 · 3D',
    items: [
      { to: '/interior', title: 'Interior Workspace', detail: '실내 자료와 공간 검토', badge: 'IN', icon: <HomeWorkRounded /> },
      { to: '/spatial', title: 'Spatial Workspace', detail: '공간 구조화', badge: 'SP', icon: <ViewInArRounded /> },
      { to: '/digital-twin-intake', title: '도면 · 3D 자료 등록', detail: 'DWG · PDF · 3D 업로드', badge: '3D', icon: <UploadFileRounded /> },
      { to: '/digital-twin', title: 'Digital Twin', detail: '3D 모델 운영', badge: 'DT', icon: <ThreeDRotationRounded /> },
      { to: '/room-ops', title: 'Room Ops', detail: 'Room Intelligence', badge: 'RM', icon: <HubRounded /> },
    ],
  },
  {
    label: '분석 · 보고',
    items: [
      { to: '/income', title: '임대 · 수익 분석', detail: 'NOI · Cap Rate', badge: '₩', icon: <PaidRounded /> },
      { to: '/review-history', title: '검토 이력 통합', detail: '자료 · Agent · 보고서 감사', badge: 'RV', icon: <RateReviewRounded /> },
      { to: '/risk', title: 'Risk · Compliance', detail: '권리 · 리스크 검토', badge: 'RK', icon: <GavelRounded /> },
      { to: '/report-history', title: '보고서 버전 이력', detail: 'Snapshot 확정본 관리', badge: 'RP', icon: <HistoryRounded /> },
    ],
  },
  {
    label: '공유 · 관리',
    items: [
      { to: '/external-shares', title: '외부 공유 센터', detail: '만료 · 회수 감사대장', badge: 'SH', icon: <ShareRounded /> },
      { to: '/access', title: '사용자 · 권한', detail: 'OWNER · ADMIN · EDITOR', badge: 'AU', icon: <AdminPanelSettingsRounded /> },
      { to: '/agents', title: 'Agent Operations', detail: '자동화 Agent 운영', badge: 'AI', icon: <AutoAwesomeRounded /> },
      { to: '/backup', title: '데이터 백업 · 복원', detail: '운영 데이터 보호', badge: 'BK', icon: <BackupRounded /> },
      { to: '/migration-readiness', title: 'Remote Migration', detail: 'Production 전환 준비', badge: 'MG', icon: <CloudSyncRounded /> },
      { to: '/settings', title: '회사 설정', detail: '브랜드 · 담당자 기본값', badge: 'SET', icon: <SettingsRounded /> },
    ],
  },
];

export default function Layout() {
  const location = useLocation(); const navigate = useNavigate();
  const editMatch = location.pathname.match(/^\/property\/([^/]+)\/edit$/); const propertyId = editMatch?.[1];
  return <div className="app-shell"><aside><div className="brand"><span>DA</span><div>DA:ON ASSET<small>PROPERTY DATA & AGENT PLATFORM</small></div></div><nav aria-label="DA:ON main navigation">{navGroups.map((group) => <section className="side-nav-group" key={group.label}><p>{group.label}</p>{group.items.map((item) => <NavLink key={item.to} to={item.to} end={item.end} className="side-nav-card"><span className="side-nav-icon">{item.icon}<b>{item.badge}</b></span><span className="side-nav-copy"><strong>{item.title}</strong><small>{item.detail}</small></span></NavLink>)}</section>)}</nav><div className="side-note">AGENT MODULAR ARCHITECTURE<small>A0 Integrator → A1~A10 isolated agents → A11 Report deferred</small></div></aside><main>{propertyId && <div className="detail-document-actions"><span>MASTER 문서</span><Button size="small" startIcon={<DescriptionOutlined />} onClick={() => navigate(`/document/report/${propertyId}`)}>7P 상세보고서</Button><Button size="small" startIcon={<PictureAsPdfOutlined />} onClick={() => navigate(`/document/proposal/${propertyId}`)}>1P 요약제안서</Button><Button size="small" startIcon={<MapOutlined />} onClick={() => navigate(`/properties/${propertyId}/briefing`)}>입지 브리핑</Button></div>}<Outlet /></main></div>;
}
