import { AdminPanelSettingsRounded, FactCheckRounded, HistoryRounded, PaidRounded, RateReviewRounded, ShareRounded, ThreeDRotationRounded, UploadFileRounded } from '@mui/icons-material';
import { Button, Chip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { AUTH_BACKEND_CONNECTED } from '../services/accessControlService';
import { externalShareProviderService } from '../services/externalShareProviderService';
import type { Property } from '../types';

function isCoreProfileReady(property: Property) {
  return Boolean(
    property.address?.trim()
    && property.landAreaSqm > 0
    && property.totalFloorAreaSqm > 0
    && property.managerName?.trim(),
  );
}

function isRecentlyUpdated(property: Property) {
  const updatedAt = new Date(property.updatedAt).getTime();
  if (!Number.isFinite(updatedAt)) return false;
  return Date.now() - updatedAt <= 7 * 24 * 60 * 60 * 1000;
}

export default function PortfolioOperationsHub({ items }: { items: Property[] }) {
  const navigate = useNavigate();
  const remoteShare = externalShareProviderService.getRemote();
  const metrics = {
    total: items.length,
    coreReady: items.filter(isCoreProfileReady).length,
    recent: items.filter(isRecentlyUpdated).length,
    sale: items.filter((item) => item.tradeType === '매매').length,
  };

  const workspaces = [
    { label: 'Intake · Verification', detail: '대량 자료 등록과 검증', path: '/bulk-intake', icon: <FactCheckRounded /> },
    { label: '임대 · 수익', detail: 'NOI · Cap Rate · 시나리오', path: '/income', icon: <PaidRounded /> },
    { label: '검토 이력', detail: '자료·Agent·보고서 감사 타임라인', path: '/review-history', icon: <RateReviewRounded /> },
    { label: '외부 공유', detail: '공유·만료·회수 감사대장', path: '/external-shares', icon: <ShareRounded /> },
    { label: '보고서 이력', detail: 'Snapshot 버전·확정본 관리', path: '/report-history', icon: <HistoryRounded /> },
    { label: '3D · 도면', detail: '도면/3D Intake와 Digital Twin', path: '/digital-twin-intake', icon: <ThreeDRotationRounded /> },
    { label: '사용자 · 권한', detail: 'OWNER · ADMIN · EDITOR · VIEWER', path: '/access', icon: <AdminPanelSettingsRounded /> },
    { label: '엑셀 대량 등록', detail: '물건 데이터 일괄 Intake', path: '/import', icon: <UploadFileRounded /> },
  ];

  return <section style={{ marginBottom: 18 }}>
    <div style={{ background: '#10243f', color: '#fff', borderRadius: 14, padding: 20, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <small style={{ color: '#d7c8a7', letterSpacing: '.12em' }}>PORTFOLIO OPERATIONS HUB</small>
          <h2 style={{ margin: '6px 0 4px' }}>전체 물건 · Data Room · 분석 · 공유 운영</h2>
          <p style={{ margin: 0, color: '#d7dee8', fontSize: 13 }}>첫 화면에서 물건 현황을 확인하고 각 전문 Workspace로 바로 이동합니다.</p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Chip size="small" sx={{ color: '#fff', borderColor: 'rgba(255,255,255,.35)' }} variant="outlined" label="LOCAL POLICY READY" />
          <Chip size="small" color={AUTH_BACKEND_CONNECTED ? 'success' : 'warning'} label={AUTH_BACKEND_CONNECTED ? 'AUTH CONNECTED' : 'AUTH NOT CONNECTED'} />
          <Chip size="small" color={remoteShare.availability === 'ready' ? 'success' : 'warning'} label={remoteShare.availability === 'ready' ? 'REMOTE SHARE READY' : 'REMOTE SHARE NOT CONFIGURED'} />
        </div>
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(140px,1fr))', gap: 10, marginBottom: 12 }}>
      {[
        ['전체 물건', metrics.total, '건'],
        ['기본정보 입력완료', metrics.coreReady, '건'],
        ['최근 7일 업데이트', metrics.recent, '건'],
        ['매매 물건', metrics.sale, '건'],
      ].map(([label, value, unit]) => <div key={String(label)} style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 14 }}><small style={{ color: '#667085' }}>{label}</small><div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}><strong style={{ fontSize: 28 }}>{value}</strong><span style={{ color: '#98a2b3' }}>{unit}</span></div></div>)}
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(190px,1fr))', gap: 9 }}>
      {workspaces.map((workspace) => <Button key={workspace.path} variant="outlined" onClick={() => navigate(workspace.path)} sx={{ justifyContent: 'flex-start', textAlign: 'left', p: 1.3, minHeight: 68, bgcolor: '#fff', textTransform: 'none' }}>
        <span style={{ marginRight: 10, display: 'inline-flex' }}>{workspace.icon}</span>
        <span><strong style={{ display: 'block', fontSize: 13 }}>{workspace.label}</strong><small style={{ color: '#667085', fontWeight: 400 }}>{workspace.detail}</small></span>
      </Button>)}
    </div>
  </section>;
}
