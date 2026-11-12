import { AdminPanelSettingsRounded, FactCheckRounded, HistoryRounded, PaidRounded, PlaylistAddCheckRounded, RateReviewRounded, ShareRounded, ThreeDRotationRounded, UploadFileRounded } from '@mui/icons-material';
import { Alert, Button, Chip, CircularProgress } from '@mui/material';
import { SearchRounded, AddRounded, ArrowForwardRounded, ExpandMoreRounded } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { AUTH_BACKEND_CONNECTED } from '../services/accessControlService';
import { externalShareProviderService } from '../services/externalShareProviderService';
import type { Property } from '../types';
import { splitSampleProperties } from '../domain/sampleProperty';
import type { RejectedPropertyRecord } from '../domain/propertyRecordGuard';

export function isCoreProfileReady(property: Property) {
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

export type PortfolioLoadState = 'loading' | 'ready' | 'error';

export default function PortfolioOperationsHub({ items, loadState = 'ready', loadError = '', rejected = [], onRetry }: { items: Property[]; loadState?: PortfolioLoadState; loadError?: string; rejected?: RejectedPropertyRecord[]; onRetry?: () => void }) {
  const navigate = useNavigate();
  // KPIs describe the operator's real inventory only; sample/demo records are reported separately (Issue #9).
  const { real: realItems, samples } = splitSampleProperties(items);
  const metrics = {
    total: realItems.length,
    coreReady: realItems.filter(isCoreProfileReady).length,
    recent: realItems.filter(isRecentlyUpdated).length,
    sale: realItems.filter((item) => item.tradeType === '매매').length,
  };
  const loaded = loadState === 'ready';

  return <section className="portfolio-focus" aria-label="물건 운영 현황">
    {loadState === 'loading' && <div className="portfolio-load-state" role="status" aria-live="polite">
      <CircularProgress size={18} /> <span>물건 목록을 불러오는 중입니다…</span>
    </div>}

    {loadState === 'error' && <Alert severity="error" className="portfolio-load-state" action={onRetry ? <Button color="inherit" size="small" onClick={onRetry}>다시 불러오기</Button> : undefined}>
      <strong>물건 목록을 불러오지 못했습니다.</strong> 운영 수치를 표시할 수 없습니다.{loadError ? ` (${loadError})` : ''}
    </Alert>}

    {loaded && rejected.length > 0 && <Alert severity="warning" className="portfolio-load-state">
      <strong>형식이 맞지 않는 저장 레코드 {rejected.length}건을 목록에서 제외했습니다.</strong> 물건 ID가 없어 열거나 보고서로 만들 수 없는 자료입니다({rejected.slice(0, 3).map((record) => record.label).join(', ')}{rejected.length > 3 ? ' 외' : ''}). 저장된 원본은 변경하지 않았습니다.
    </Alert>}

    {loaded && realItems.length === 0 && <div className="portfolio-empty-state" role="status">
      <strong>등록된 실제 운영 물건이 없습니다.</strong>
      <p>{samples.length > 0 ? `현재 목록의 ${samples.length}건은 샘플·테스트 자료로 분류되어 운영 물건 수에 포함하지 않습니다.` : '주소 조회로 건물을 확인한 뒤 첫 물건을 등록하세요.'}</p>
      <Button size="small" variant="contained" onClick={() => navigate('/discover')}>주소 조회부터 시작 <ArrowForwardRounded fontSize="small" /></Button>
    </div>}

    {(!loaded || realItems.length > 0) && <div className="portfolio-focus-metrics">
      {[
        ['등록 물건', metrics.total, '건'],
        ['기본정보 입력', metrics.coreReady, '건'],
        ['7일 내 변경', metrics.recent, '건'],
        ['매매 물건', metrics.sale, '건'],
      ].map(([label, value, unit]) => <div className="portfolio-focus-metric" key={String(label)}><small>{label}</small><div><strong>{loaded ? value : '—'}</strong><span>{loaded ? unit : ''}</span></div></div>)}
    </div>}
    {loaded && realItems.length > 0 && samples.length > 0 && <p className="portfolio-sample-note">샘플·테스트 자료 {samples.length}건은 운영 수치에서 제외했고, 목록에 배지로 구분해 표시합니다.</p>}

  </section>;
}

/**
 * Shortcuts and connection status, shown below the property list (2026-11-12 redesign: the list comes first).
 * Every entry stays reachable here and from the desktop menu.
 */
export function PortfolioShortcuts() {
  const navigate = useNavigate();
  const remoteShare = externalShareProviderService.getRemote();
  const workspaces = [
    { label: '준비도 센터', detail: '물건별 7단계 보완 항목 점검', path: '/readiness', icon: <PlaylistAddCheckRounded /> },
    { label: '대량 자료 검증', detail: 'Intake · Verification · 일괄 등록 자료 확인', path: '/bulk-intake', icon: <FactCheckRounded /> },
    { label: '임대 · 수익', detail: 'NOI · Cap Rate · 시나리오', path: '/income', icon: <PaidRounded /> },
    { label: '검토 이력', detail: '자료·Agent·보고서 감사 타임라인', path: '/review-history', icon: <RateReviewRounded /> },
    { label: '외부 공유', detail: '공유·만료·회수 감사대장', path: '/external-shares', icon: <ShareRounded /> },
    { label: '보고서 이력', detail: 'Snapshot 버전·확정본 관리', path: '/report-history', icon: <HistoryRounded /> },
    { label: '3D · 도면', detail: '도면/3D Intake와 Digital Twin', path: '/digital-twin-intake', icon: <ThreeDRotationRounded /> },
    { label: '사용자 · 권한', detail: 'OWNER · ADMIN · EDITOR · VIEWER', path: '/access', icon: <AdminPanelSettingsRounded /> },
    { label: '엑셀 대량 등록', detail: '물건 데이터 일괄 Intake', path: '/import', icon: <UploadFileRounded /> },
  ];

  return <details className="portfolio-focus-more">
    <summary>전문 업무 전체 보기 <ExpandMoreRounded fontSize="small" /></summary>
    <div className="portfolio-workspace-grid">
      {workspaces.map(workspace => <Button key={workspace.path} variant="outlined" onClick={() => navigate(workspace.path)} sx={{ justifyContent: 'flex-start', textAlign: 'left', p: 1.3, minHeight: 68, bgcolor: '#fff', textTransform: 'none' }}>
        <span style={{ marginRight: 10, display: 'inline-flex' }}>{workspace.icon}</span>
        <span><strong style={{ display: 'block', fontSize: 13 }}>{workspace.label}</strong><small style={{ color: '#667085', fontWeight: 400 }}>{workspace.detail}</small></span>
      </Button>)}
    </div>
    <div className="portfolio-focus-system" aria-label="시스템 연결 상태">
      <Chip size="small" variant="outlined" label="로컬 정책 적용" />
      <Chip size="small" color={AUTH_BACKEND_CONNECTED ? 'success' : 'warning'} label={AUTH_BACKEND_CONNECTED ? '인증 연결' : '인증 확인 필요'} />
      <Chip size="small" color={remoteShare.availability === 'ready' ? 'success' : 'warning'} label={remoteShare.availability === 'ready' ? '외부 공유 연결' : '외부 공유 점검 필요'} />
    </div>
  </details>;
}
