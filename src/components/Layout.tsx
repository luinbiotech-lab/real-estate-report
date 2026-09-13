import { ApartmentRounded, AutoAwesomeRounded, DescriptionOutlined, FactCheckRounded, MapOutlined, PictureAsPdfOutlined, SettingsRounded, UploadFileRounded } from '@mui/icons-material';
import { Button } from '@mui/material';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const editMatch = location.pathname.match(/^\/property\/([^/]+)\/edit$/);
  const propertyId = editMatch?.[1];
  return <div className="app-shell"><aside><div className="brand"><span>DA</span><div>DA:ON ASSET<small>PROPERTY DATA & REPORT PLATFORM</small></div></div><nav><NavLink to="/" end><ApartmentRounded />물건 관리</NavLink><NavLink to="/import"><UploadFileRounded />엑셀 대량 등록</NavLink><NavLink to="/bulk-intake"><FactCheckRounded />공적자료 일괄 검증</NavLink><NavLink to="/agents"><AutoAwesomeRounded />Agent Operations</NavLink><NavLink to="/settings"><SettingsRounded />회사 설정</NavLink></nav><div className="side-note">DA:ON WORKSPACE<small>Property → Data Room → Agents → MASTER Report</small></div></aside><main>{propertyId && <div className="detail-document-actions"><span>MASTER 문서</span><Button size="small" startIcon={<DescriptionOutlined />} onClick={() => navigate(`/document/report/${propertyId}`)}>7P 상세보고서</Button><Button size="small" startIcon={<PictureAsPdfOutlined />} onClick={() => navigate(`/document/proposal/${propertyId}`)}>1P 요약제안서</Button><Button size="small" startIcon={<MapOutlined />} onClick={() => navigate(`/properties/${propertyId}/briefing`)}>입지 브리핑</Button></div>}<Outlet /></main></div>;
}
