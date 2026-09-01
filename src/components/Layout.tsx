import { ApartmentRounded, DescriptionOutlined, MapOutlined, PictureAsPdfOutlined, SettingsRounded, UploadFileRounded } from '@mui/icons-material';
import { Button } from '@mui/material';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const editMatch = location.pathname.match(/^\/property\/([^/]+)\/edit$/);
  const propertyId = editMatch?.[1];
  return <div className="app-shell"><aside><div className="brand"><span>AB</span><div>ASSET BRIEF<small>부동산 리포트 스튜디오</small></div></div><nav><NavLink to="/" end><ApartmentRounded />물건 관리</NavLink><NavLink to="/import"><UploadFileRounded />엑셀 대량 등록</NavLink><NavLink to="/settings"><SettingsRounded />회사 설정</NavLink></nav><div className="side-note">LOCAL WORKSPACE<small>데이터는 이 브라우저에만 안전하게 저장됩니다.</small></div></aside><main>{propertyId && <div className="detail-document-actions"><span>문서 미리보기</span><Button size="small" startIcon={<DescriptionOutlined />} onClick={() => navigate(`/document/report/${propertyId}`)}>투자분석보고서</Button><Button size="small" startIcon={<PictureAsPdfOutlined />} onClick={() => navigate(`/document/proposal/${propertyId}`)}>고객 제안서</Button><Button size="small" startIcon={<MapOutlined />} onClick={() => navigate(`/properties/${propertyId}/briefing`)}>입지 브리핑</Button></div>}<Outlet /></main></div>;
}
