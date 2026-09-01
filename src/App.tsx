import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { CircularProgress, createTheme, ThemeProvider } from '@mui/material';
import { propertyRepository, settingsRepository } from './repositories/propertyRepository';
import { emptyProperty, type Property, type Settings } from './types';
import Layout from './components/Layout';
import PropertyList from './pages/PropertyList';
import PropertyForm from './pages/PropertyForm';
import ExcelImport from './pages/ExcelImport';
import SettingsPage from './pages/SettingsPage';
import DocumentPreview from './pages/DocumentPreview';
import PropertyBriefingPage from './pages/PropertyBriefingPage';
import PropertyDataRoomPage from './pages/PropertyDataRoomPage';
import ProfessionalReportSnapshotPage from './pages/ProfessionalReportSnapshotPage';

const sample: Property = { ...emptyProperty, id: 'sample-seongsu', propertyNumber: 'SS-2026-001', name: '성수동2가 331-7 신축부지', tradeType: '매매', salePrice: 5300000000, address: '서울특별시 성동구 성수동2가 331-7', occupancyStatus: '명도완료', landAreaPyeong: 36, landAreaSqm: 119.01, totalFloorAreaPyeong: 63.63, totalFloorAreaSqm: 210.35, zoning: '준공업지역', roadCondition: '4m × 2m 코너', basementFloors: 1, groundFloors: 3, completionDate: '1993-08-17', buildingCoverageRate: 64.5, floorAreaRatio: 158.82, elevator: '없음', parkingSpaces: 1, nearbyStation: '성수역', stationDistance: '도보 약 10분', managerName: '최진 팀장', managerPhone: '010-4399-9744', companyName: '에셋브리프 부동산중개', features: '최근 성수동2가 328-19 평당 2억원 거래\n성수 전략정비 4구역 인근\n메인스트리트 변화 예정\n상권 및 오피스 수요가 꾸준한 지역', investmentPoints: '희소한 코너 입지와 신축 개발 잠재력', locationAnalysis: '성수 핵심 업무·상업 권역과 가까우며 유동인구와 기업 수요가 안정적입니다.', developmentPlan: '주변 정비사업 및 업무시설 개발에 따른 가치 상승 기대', recommendedUse: '브랜드 플래그십, 사옥, 근린생활시설', risks: '개발 전 인허가 및 실제 도로 현황 확인 필요', overallOpinion: '입지 희소성과 개발 여력을 함께 보유한 중장기 투자 후보입니다.', nearbyTransactions: '성수동2가 328-19 · 평당 약 2억원', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
const defaults: Settings = { companyName: '에셋브리프 부동산중개', logo: '', defaultManager: '최진 팀장', phone: '010-4399-9744', email: 'contact@assetbrief.kr', footerText: '본 자료는 참고용이며 실제 계약 전 권리관계 및 현장 확인이 필요합니다.' };
const theme = createTheme({ palette: { primary: { main: '#132844' }, secondary: { main: '#dc3d3d' }, background: { default: '#f3f5f8' } }, typography: { fontFamily: 'Pretendard, "Noto Sans KR", Arial, sans-serif' }, shape: { borderRadius: 10 } });

export default function App() {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState(defaults);
  useEffect(() => { (async () => { if (!(await propertyRepository.getAll()).length) await propertyRepository.create(sample); const stored = await settingsRepository.get(); if (stored) setSettings(stored); else await settingsRepository.save(defaults); setReady(true); })(); }, []);
  if (!ready) return <div className="center"><CircularProgress /></div>;
  return <ThemeProvider theme={theme}><Routes><Route element={<Layout />}><Route index element={<PropertyList />} /><Route path="property/new" element={<PropertyForm settings={settings} />} /><Route path="property/:id" element={<PropertyDataRoomPage />} /><Route path="property/:id/edit" element={<PropertyForm settings={settings} />} /><Route path="import" element={<ExcelImport />} /><Route path="settings" element={<SettingsPage settings={settings} onSave={setSettings} />} /></Route><Route path="document/:kind/:id" element={<DocumentPreview settings={settings} />} /><Route path="properties/:id/briefing" element={<PropertyBriefingPage settings={settings} />} /><Route path="professional-report/snapshot/:snapshotId" element={<ProfessionalReportSnapshotPage />} /><Route path="*" element={<Navigate to="/" />} /></Routes></ThemeProvider>;
}
