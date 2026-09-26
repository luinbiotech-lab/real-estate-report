import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Alert, CircularProgress, createTheme, ThemeProvider } from '@mui/material';
import { settingsRepository } from './repositories/propertyRepository';
import type { Settings } from './types';
import Layout from './components/Layout';
import ProductionAuthGate from './components/ProductionAuthGate';
import PropertyList from './pages/PropertyList';
import PropertyForm from './pages/PropertyForm';
import PropertyHubPage from './pages/PropertyHubPage';
import ExcelImport from './pages/ExcelImport';
import BulkIntakePage from './pages/BulkIntakePage';
import AgentOpsPage from './pages/AgentOpsPage';
import AgentControlCenterPage from './pages/AgentControlCenterPage';
import AgentWorkspacePage from './pages/AgentWorkspacePage';
import InteriorWorkspacePage from './pages/InteriorWorkspacePage';
import RoomTwinOperationsPage from './pages/RoomTwinOperationsPage';
import SpatialWorkspacePage from './pages/SpatialWorkspacePage';
import DigitalTwinWorkspacePage from './pages/DigitalTwinWorkspacePage';
import DigitalTwinIntakePage from './pages/DigitalTwinIntakePage';
import ExternalShareCenterPage from './pages/ExternalShareCenterPage';
import RentalIncomeWorkspacePage from './pages/RentalIncomeWorkspacePage';
import ReviewHistoryPage from './pages/ReviewHistoryPage';
import AccessManagementPage from './pages/AccessManagementPage';
import PropertyReadinessCenterPage from './pages/PropertyReadinessCenterPage';
import RiskWorkspacePage from './pages/RiskWorkspacePage';
import SettingsPage from './pages/SettingsPage';
import DataBackupCenterPage from './pages/DataBackupCenterPage';
import RemoteMigrationReadinessPage from './pages/RemoteMigrationReadinessPage';
import DocumentPreview from './pages/DocumentPreview';
import PropertyBriefingPage from './pages/PropertyBriefingPage';
import PropertyDataRoomPage from './pages/PropertyDataRoomPage';
import ProfessionalReportSnapshotPage from './pages/ProfessionalReportSnapshotPage';
import ReportHistoryPage from './pages/ReportHistoryPage';
import { CUTOVER_MODE, REMOTE_OPERATIONAL_MODE } from './services/operationalDataMode';

const DAON_MANAGER = '김은미 대표 / 공인중개사';
const DAON_PHONE = '010 9953 1270';
const DAON_EMAIL = 'daonasset.korea@gmail.com';
const DAON_COMPANY = 'DA:ON ASSET';
const DAON_SLOGAN = 'PROPERTY DATA & AGENT PLATFORM';

const defaults: Settings = {
  companyName: DAON_COMPANY,
  brandSlogan: DAON_SLOGAN,
  logo: '',
  defaultManager: DAON_MANAGER,
  phone: DAON_PHONE,
  email: DAON_EMAIL,
  footerText: '본 자료는 매각 검토용 요약자료이며 계약 전 권리관계 및 현장 재확인이 필요합니다.',
  reportContactMode: 'mobile_email_only',
};

const theme = createTheme({
  palette: {
    primary: { main: '#073a69' },
    secondary: { main: '#b47a25' },
    background: { default: '#f3f5f8' },
  },
  typography: { fontFamily: 'Pretendard, "Noto Sans KR", Arial, sans-serif' },
  shape: { borderRadius: 10 },
});

function AppContent() {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState(defaults);
  const [startupError, setStartupError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        if (CUTOVER_MODE) {
          const { localBootstrapService } = await import('./services/localBootstrapService');
          await localBootstrapService.ensure({
            managerName: DAON_MANAGER,
            managerPhone: DAON_PHONE,
            managerEmail: DAON_EMAIL,
            companyName: DAON_COMPANY,
          });
        }

        const stored = await settingsRepository.get();
        const normalizedSettings: Settings = stored?.companyName === '에셋브리프 부동산중개'
          ? defaults
          : { ...defaults, ...(stored ?? {}), reportContactMode: 'mobile_email_only' };

        if (!REMOTE_OPERATIONAL_MODE && (!stored || JSON.stringify(normalizedSettings) !== JSON.stringify(stored))) {
          await settingsRepository.save(normalizedSettings);
        }

        setSettings(normalizedSettings);
      } catch (reason) {
        setStartupError(reason instanceof Error ? reason.message : '플랫폼 초기 데이터를 불러오지 못했습니다.');
      } finally {
        setReady(true);
      }
    })();
  }, []);

  if (!ready) return <div className="center"><CircularProgress /></div>;
  if (startupError) return <main style={{ padding: 28 }}><Alert severity="error"><strong>플랫폼 초기화 실패</strong> · {startupError}</Alert></main>;

  return <Routes>
    <Route element={<Layout />}>
      <Route index element={<PropertyList />} />
      <Route path="control-center" element={<AgentControlCenterPage />} />
      <Route path="agents/:agentId" element={<AgentWorkspacePage />} />
      <Route path="property/new" element={<PropertyForm settings={settings} />} />
      <Route path="property/:id" element={<PropertyHubPage />} />
      <Route path="property/:id/data-room" element={<PropertyDataRoomPage />} />
      <Route path="property/:id/edit" element={<PropertyForm settings={settings} />} />
      <Route path="import" element={<ExcelImport />} />
      <Route path="bulk-intake" element={<BulkIntakePage />} />
      <Route path="readiness" element={<PropertyReadinessCenterPage />} />
      <Route path="interior" element={<InteriorWorkspacePage />} />
      <Route path="room-ops" element={<RoomTwinOperationsPage />} />
      <Route path="spatial" element={<SpatialWorkspacePage />} />
      <Route path="digital-twin-intake" element={<DigitalTwinIntakePage />} />
      <Route path="digital-twin" element={<DigitalTwinWorkspacePage />} />
      <Route path="external-shares" element={<ExternalShareCenterPage />} />
      <Route path="income" element={<RentalIncomeWorkspacePage />} />
      <Route path="review-history" element={<ReviewHistoryPage />} />
      <Route path="access" element={<AccessManagementPage />} />
      <Route path="risk" element={<RiskWorkspacePage />} />
      <Route path="agents" element={<AgentOpsPage />} />
      <Route path="report-history" element={<ReportHistoryPage />} />
      <Route path="backup" element={<DataBackupCenterPage />} />
      <Route path="migration-readiness" element={<RemoteMigrationReadinessPage settings={settings} />} />
      <Route path="settings" element={<SettingsPage settings={settings} onSave={setSettings} />} />
    </Route>
    <Route path="document/:kind/:id" element={<DocumentPreview />} />
    <Route path="properties/:id/briefing" element={<PropertyBriefingPage settings={settings} />} />
    <Route path="professional-report/snapshot/:snapshotId" element={<ProfessionalReportSnapshotPage />} />
    <Route path="*" element={<Navigate to="/" />} />
  </Routes>;
}

export default function App() {
  return <ThemeProvider theme={theme}>
    <ProductionAuthGate>
      <AppContent />
    </ProductionAuthGate>
  </ThemeProvider>;
}
