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
import DaonBangbaeDocumentPreview from './pages/DaonBangbaeDocumentPreview';
import PropertyBriefingPage from './pages/PropertyBriefingPage';
import PropertyDataRoomPage from './pages/PropertyDataRoomPage';
import ProfessionalReportSnapshotPage from './pages/ProfessionalReportSnapshotPage';

const sample: Property = { ...emptyProperty, id: 'sample-seongsu', propertyNumber: 'SS-2026-001', name: '성수동2가 331-7 신축부지', tradeType: '매매', salePrice: 5300000000, address: '서울특별시 성동구 성수동2가 331-7', occupancyStatus: '명도완료', landAreaPyeong: 36, landAreaSqm: 119.01, totalFloorAreaPyeong: 63.63, totalFloorAreaSqm: 210.35, zoning: '준공업지역', roadCondition: '4m × 2m 코너', basementFloors: 1, groundFloors: 3, completionDate: '1993-08-17', buildingCoverageRate: 64.5, floorAreaRatio: 158.82, elevator: '없음', parkingSpaces: 1, nearbyStation: '성수역', stationDistance: '도보 약 10분', managerName: '최진 팀장', managerPhone: '010-4399-9744', companyName: '에셋브리프 부동산중개', features: '최근 성수동2가 328-19 평당 2억원 거래\n성수 전략정비 4구역 인근\n메인스트리트 변화 예정\n상권 및 오피스 수요가 꾸준한 지역', investmentPoints: '희소한 코너 입지와 신축 개발 잠재력', locationAnalysis: '성수 핵심 업무·상업 권역과 가까우며 유동인구와 기업 수요가 안정적입니다.', developmentPlan: '주변 정비사업 및 업무시설 개발에 따른 가치 상승 기대', recommendedUse: '브랜드 플래그십, 사옥, 근린생활시설', risks: '개발 전 인허가 및 실제 도로 현황 확인 필요', overallOpinion: '입지 희소성과 개발 여력을 함께 보유한 중장기 투자 후보입니다.', nearbyTransactions: '성수동2가 328-19 · 평당 약 2억원', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };

const bangbae81511: Property = {
  ...emptyProperty,
  id: 'daon-bangbae-815-11',
  propertyNumber: '방배동 815-11',
  name: '방배동 815-11 코너빌딩',
  tradeType: '매매',
  salePrice: 4150000000,
  negotiable: false,
  occupancyStatus: '소유자 직접 사용 / 잔금일 기준 전체 명도 가능',
  address: '서울 서초구 동광로18길 7',
  nearbyStation: '7호선 내방역',
  roadCondition: '양면 도로 코너',
  landAreaSqm: 168.1,
  landAreaPyeong: 50.85,
  totalFloorAreaSqm: 349.08,
  totalFloorAreaPyeong: 105.6,
  buildingAreaPyeong: 24.8,
  zoning: '제2종일반주거지역(7층 이하)',
  mainUse: '주택 및 근린생활시설',
  structure: '세멘벽돌조',
  basementFloors: 1,
  groundFloors: 3,
  completionDate: '1978-07-31',
  buildingCoverageRate: 48.8,
  floorAreaRatio: 146.3,
  parkingSpaces: 0,
  parkingOfficial: undefined,
  parkingField: 2,
  parkingFieldNote: '현장 이용 기준',
  internalPhotoAllowed: false,
  features: '래미안 원페를라 인접\n서래마을·함지박사거리 생활권\n복합 코너 대지, 양면 도로 접면\n주거 배후수요 + 생활편의 수요',
  investmentPoints: '소유자 직접 사용과 잔금일 기준 전체 명도 협의 가능\n사옥·주거업무 복합공간 검토 가능\nF&B 플래그십·갤러리·문화공간 검토 가능\n기존 건물 활용과 장기 신축 가능성을 함께 검토할 수 있는 자산',
  locationAnalysis: '래미안 원페를라와 서래마을·함지박사거리 생활권에 인접한 방배동 코너 입지입니다. 양면 도로 접면으로 파사드 노출과 출입 동선 계획 측면에서 활용 여지가 있습니다.',
  developmentPlan: '기존 건물 활용, 리노베이션 또는 신축 여부를 비교 검토할 수 있으며 신축·용도변경은 별도 인허가 검토가 필요합니다.',
  recommendedUse: '사옥, 주거·업무 복합공간, F&B 플래그십, 갤러리·문화공간',
  risks: '신축·용도변경은 별도 인허가 검토 필요\n등기·공적자료 최신본 재확인 필요\n주차 2대 가능 표시는 현장 이용 기준이며 공부상 주차와 구분 필요',
  overallOpinion: '즉시 활용 가능한 기존 건물과 코너 대지의 장기 선택지를 함께 검토할 수 있는 자산입니다.',
  managerName: '김은미',
  managerPhone: '010 9953 1270',
  managerEmail: 'daonasset.korea@gmail.com',
  companyName: 'DA:ON ASSET',
  createdAt: '2026-09-09T00:00:00.000Z',
  updatedAt: '2026-09-09T00:00:00.000Z',
};

const defaults: Settings = { companyName: '에셋브리프 부동산중개', logo: '', defaultManager: '최진 팀장', phone: '010-4399-9744', email: 'contact@assetbrief.kr', footerText: '본 자료는 참고용이며 실제 계약 전 권리관계 및 현장 확인이 필요합니다.' };
const theme = createTheme({ palette: { primary: { main: '#132844' }, secondary: { main: '#dc3d3d' }, background: { default: '#f3f5f8' } }, typography: { fontFamily: 'Pretendard, "Noto Sans KR", Arial, sans-serif' }, shape: { borderRadius: 10 } });

export default function App() {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState(defaults);
  useEffect(() => { (async () => {
    if (!(await propertyRepository.getAll()).length) await propertyRepository.create(sample);
    if (!(await propertyRepository.getById(bangbae81511.id))) await propertyRepository.create(bangbae81511);
    const stored = await settingsRepository.get();
    if (stored) setSettings(stored); else await settingsRepository.save(defaults);
    setReady(true);
  })(); }, []);
  if (!ready) return <div className="center"><CircularProgress /></div>;
  return <ThemeProvider theme={theme}><Routes><Route element={<Layout />}><Route index element={<PropertyList />} /><Route path="property/new" element={<PropertyForm settings={settings} />} /><Route path="property/:id" element={<PropertyDataRoomPage />} /><Route path="property/:id/edit" element={<PropertyForm settings={settings} />} /><Route path="import" element={<ExcelImport />} /><Route path="settings" element={<SettingsPage settings={settings} onSave={setSettings} />} /></Route><Route path="document/:kind/daon-bangbae-815-11" element={<DaonBangbaeDocumentPreview />} /><Route path="document/:kind/:id" element={<DocumentPreview settings={settings} />} /><Route path="properties/:id/briefing" element={<PropertyBriefingPage settings={settings} />} /><Route path="professional-report/snapshot/:snapshotId" element={<ProfessionalReportSnapshotPage />} /><Route path="*" element={<Navigate to="/" />} /></Routes></ThemeProvider>;
}
