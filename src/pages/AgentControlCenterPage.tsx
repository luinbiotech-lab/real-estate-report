import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Chip, CircularProgress, Collapse, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { ArrowForwardRounded, ExpandMoreRounded, HubRounded, RefreshRounded, TaskAltRounded, WarningAmberRounded } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { PLATFORM_AGENT_REGISTRY } from '../agents/agentRegistry';
import { buildAgentHealthSnapshots, type AgentHealthState } from '../agents/agentStatusService';
import { integratorReadPort } from '../agents/agentDataPorts';
import type { DataRoomBundle } from '../domain/propertyDataRoom/types';
import type { Property } from '../types';

const HEALTH_COLOR: Record<AgentHealthState, 'default' | 'success' | 'warning' | 'error'> = { idle: 'default', ready: 'success', attention: 'warning', blocked: 'error', deferred: 'default' };
const EMPTY_BUNDLE: DataRoomBundle = { documents: [], media: [], verifications: [], verificationCandidates: [], dataSources: [], reportSnapshots: [], digitalTwinAssets: [] };

export default function AgentControlCenterPage() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [bundle, setBundle] = useState<DataRoomBundle>(EMPTY_BUNDLE);
  const [loading, setLoading] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [error, setError] = useState('');

  const selected = useMemo(() => properties.find((item) => item.id === propertyId), [properties, propertyId]);
  const health = useMemo(() => buildAgentHealthSnapshots(bundle), [bundle]);
  const healthByAgent = useMemo(() => new Map(health.map((item) => [item.agentId, item])), [health]);
  const load = async (id = propertyId) => { if (id) setBundle(await integratorReadPort.getBundle(id)); };

  useEffect(() => {
    (async () => {
      try {
        const list = await integratorReadPort.getProperties();
        setProperties(list);
        const first = list[0]?.id || '';
        setPropertyId(first);
        if (first) setBundle(await integratorReadPort.getBundle(first));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Control Center를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="center"><CircularProgress /><p>Agent Control Center를 준비하는 중입니다.</p></div>;

  const jobs = bundle.agentJobs ?? [];
  const reviews = bundle.agentReviews ?? [];
  const pendingReviews = reviews.filter((item) => item.decision === 'pending' || item.decision === 'held').length;
  const failedJobs = jobs.filter((item) => item.status === 'failed').length;
  const approvedRoomLinks = (bundle.spaceRoomLinks ?? []).filter((item) => item.decision === 'approved').length;
  const approvedRoomRenovations = (bundle.roomRenovationAssessments ?? []).filter((item) => item.decision === 'approved').length;
  const activeAgents = PLATFORM_AGENT_REGISTRY.filter((item) => item.id !== 'integrator' && item.status === 'active');
  const blockedAgents = health.filter((item) => item.agentId !== 'integrator' && item.state === 'blocked').length;
  const attentionAgents = health.filter((item) => item.agentId !== 'integrator' && item.state === 'attention').length;
  const firstProblemAgent = activeAgents.find((agent) => {
    const state = healthByAgent.get(agent.id)?.state;
    return state === 'blocked' || state === 'attention';
  });

  const priority = failedJobs
    ? { level: 'error' as const, eyebrow: '즉시 확인', title: `실패한 Agent Job ${failedJobs}건`, detail: '실패 원인을 확인하고 재처리 여부를 결정해야 합니다.', path: '/agents', action: 'Agent Operations 열기' }
    : pendingReviews
      ? { level: 'warning' as const, eyebrow: '검토 필요', title: `Human Review ${pendingReviews}건 대기`, detail: '승인·보류된 항목이 다음 처리 단계를 막고 있는지 확인하세요.', path: '/agents', action: '검토 대기 확인' }
      : blockedAgents
        ? { level: 'error' as const, eyebrow: '병목 발생', title: `Blocked Agent ${blockedAgents}개`, detail: firstProblemAgent ? `${firstProblemAgent.name}부터 확인하는 것이 우선입니다.` : 'Agent 병목 원인을 확인해야 합니다.', path: firstProblemAgent?.workspacePath || '/agents', action: '문제 Agent 열기' }
        : attentionAgents
          ? { level: 'warning' as const, eyebrow: '보완 필요', title: `검토 필요 Agent ${attentionAgents}개`, detail: firstProblemAgent ? `${firstProblemAgent.name}에 추가 확인 항목이 있습니다.` : '추가 확인 항목을 검토하세요.', path: firstProblemAgent?.workspacePath || '/agents', action: '보완 항목 확인' }
          : bundle.documents.length === 0 && propertyId
            ? { level: 'warning' as const, eyebrow: '다음 작업', title: 'Data Room 자료 등록이 필요합니다', detail: '문서와 근거 자료를 먼저 연결하면 이후 검증·보고 흐름을 진행할 수 있습니다.', path: `/property/${propertyId}/data-room`, action: 'Data Room 열기' }
            : propertyId
              ? { level: 'success' as const, eyebrow: '현재 상태', title: '주요 운영 병목이 없습니다', detail: '선택 물건의 Data Room과 readiness를 확인하고 다음 보완 항목을 진행할 수 있습니다.', path: `/property/${propertyId}/data-room`, action: 'Data Room 확인' }
              : { level: 'warning' as const, eyebrow: '물건 없음', title: '등록된 물건이 없습니다', detail: '새 물건을 등록한 뒤 운영 상태를 확인할 수 있습니다.', path: '/property/new', action: '새 물건 등록' };

  return <main className="control-focus-page">
    <header className="control-focus-header">
      <div><p className="eyebrow">A0 · INTEGRATOR</p><h1>운영 홈</h1><p>지금 확인할 문제와 다음 작업만 먼저 보여줍니다. 세부 Agent 상태는 필요할 때 펼쳐보세요.</p></div>
      <Button variant="outlined" startIcon={<RefreshRounded />} onClick={() => load()}>새로고침</Button>
    </header>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

    <section className="control-property-strip">
      <FormControl size="small" fullWidth><InputLabel id="control-property-label">대상 물건</InputLabel><Select labelId="control-property-label" label="대상 물건" value={propertyId} onChange={async (event) => { setPropertyId(event.target.value); await load(event.target.value); }}>{properties.map((item) => <MenuItem key={item.id} value={item.id}>{item.name} · {item.address}</MenuItem>)}</Select></FormControl>
      {selected && <div className="control-property-meta"><strong>{selected.name}</strong><span>{selected.propertyNumber || '물건번호 미입력'} · {selected.address}</span></div>}
    </section>

    <section className={`control-priority control-priority-${priority.level}`}>
      <div className="control-priority-icon">{priority.level === 'success' ? <TaskAltRounded /> : <WarningAmberRounded />}</div>
      <div><small>{priority.eyebrow}</small><h2>{priority.title}</h2><p>{priority.detail}</p></div>
      <Button variant="contained" endIcon={<ArrowForwardRounded />} onClick={() => navigate(priority.path)}>{priority.action}</Button>
    </section>

    <section className="control-kpi-grid">
      {[
        ['Review 대기', pendingReviews, pendingReviews ? '확인 필요' : '정상'],
        ['Blocked Agent', blockedAgents, blockedAgents ? '조치 필요' : '정상'],
        ['검토 필요 Agent', attentionAgents, attentionAgents ? '보완 필요' : '정상'],
        ['Data Room', bundle.documents.length + bundle.media.length, `문서 ${bundle.documents.length} · 미디어 ${bundle.media.length}`],
      ].map(([label, value, note]) => <article key={String(label)}><small>{label}</small><strong>{value}</strong><span>{note}</span></article>)}
    </section>

    <section className="control-next-grid">
      <article className="control-next-card">
        <div><small>NEXT ACTION</small><h2>물건 작업 계속하기</h2><p>기본정보, 자료, 검증, 미디어, 보고서 순으로 보완합니다.</p></div>
        <div className="control-next-actions">
          {propertyId && <Button variant="contained" onClick={() => navigate(`/property/${propertyId}/data-room`)}>Data Room</Button>}
          <Button variant="outlined" onClick={() => navigate('/readiness')}>준비도 센터</Button>
          <Button variant="text" onClick={() => navigate('/')}>전체 물건</Button>
        </div>
      </article>
      <article className="control-summary-card">
        <small>SELECTED PROPERTY</small>
        <div><span>Agent Jobs</span><strong>{jobs.length}</strong></div>
        <div><span>3D Room 연결</span><strong>{approvedRoomLinks}</strong></div>
        <div><span>Room Reno 승인</span><strong>{approvedRoomRenovations}</strong></div>
      </article>
    </section>

    <section className="control-agent-section">
      <button type="button" className="control-agent-toggle" onClick={() => setDetailsOpen((value) => !value)} aria-expanded={detailsOpen}>
        <span><small>DETAIL STATUS</small><strong>Agent 상세 상태</strong><em>문제 해결이나 기술 상태 확인이 필요할 때만 펼쳐보세요.</em></span>
        <span className={detailsOpen ? 'open' : ''}><ExpandMoreRounded /></span>
      </button>
      <Collapse in={detailsOpen}>
        <div className="control-agent-list">
          {activeAgents.map((agent) => {
            const status = healthByAgent.get(agent.id);
            return <article key={agent.id}>
              <div><small>{agent.code}</small><strong>{agent.name}</strong><span>{agent.purpose}</span></div>
              <div className="control-agent-metrics"><Chip size="small" color={HEALTH_COLOR[status?.state || 'idle']} label={(status?.state || 'idle').toUpperCase()} /><span>Jobs {status?.jobCount ?? 0}</span><span>Review {status?.pendingReviewCount ?? 0}</span></div>
              <Button size="small" endIcon={<ArrowForwardRounded />} onClick={() => navigate(agent.workspacePath)}>열기</Button>
            </article>;
          })}
          <article className="control-agent-deferred"><div><small>A11</small><strong>Report Agent</strong><span>MASTER 보고서 편집 단계는 deferred 상태를 유지합니다.</span></div><Chip icon={<HubRounded />} label="DEFERRED" variant="outlined" /></article>
        </div>
      </Collapse>
    </section>

    <p className="control-boundary-note">Agent Control Center · A0는 다른 Agent의 도메인 데이터를 직접 수정하지 않습니다.</p>
  </main>;
}
