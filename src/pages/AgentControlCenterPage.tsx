import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Chip, CircularProgress, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { ArrowForwardRounded, HubRounded, RefreshRounded } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { PLATFORM_AGENT_REGISTRY } from '../agents/agentRegistry';
import { buildAgentHealthSnapshots, type AgentHealthState } from '../agents/agentStatusService';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { propertyRepository } from '../repositories/propertyRepository';
import type { Property } from '../types';

const HEALTH_COLOR: Record<AgentHealthState, 'default' | 'success' | 'warning' | 'error'> = { idle: 'default', ready: 'success', attention: 'warning', blocked: 'error', deferred: 'default' };

export default function AgentControlCenterPage() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof propertyDataRoomRepository.getBundle>>>({ documents: [], media: [], verifications: [], verificationCandidates: [], dataSources: [], reportSnapshots: [], digitalTwinAssets: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const selected = useMemo(() => properties.find((item) => item.id === propertyId), [properties, propertyId]);
  const health = useMemo(() => buildAgentHealthSnapshots(bundle), [bundle]);
  const healthByAgent = useMemo(() => new Map(health.map((item) => [item.agentId, item])), [health]);
  const load = async (id = propertyId) => { if (id) setBundle(await propertyDataRoomRepository.getBundle(id)); };

  useEffect(() => {
    (async () => {
      try {
        const list = await propertyRepository.getAll(); setProperties(list);
        const first = list[0]?.id || ''; setPropertyId(first); if (first) setBundle(await propertyDataRoomRepository.getBundle(first));
      } catch (reason) { setError(reason instanceof Error ? reason.message : 'Control Center를 불러오지 못했습니다.'); }
      finally { setLoading(false); }
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

  return <main style={{ padding: 28, maxWidth: 1380, margin: '0 auto' }}>
    <header style={{ marginBottom: 22 }}><p className="eyebrow">A0 · INTEGRATOR</p><h1 style={{ margin: '6px 0' }}>Agent Control Center</h1><p style={{ color: '#667085' }}>각 Agent는 독립된 데이터/기능 경계를 유지하고, A0는 Property 단위 readiness·Human Review·실패 상태만 통합 관제합니다.</p></header>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

    <section style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 18, marginBottom: 18 }}>
      <FormControl size="small" fullWidth><InputLabel id="control-property-label">대상 물건</InputLabel><Select labelId="control-property-label" label="대상 물건" value={propertyId} onChange={async (event) => { setPropertyId(event.target.value); await load(event.target.value); }}>{properties.map((item) => <MenuItem key={item.id} value={item.id}>{item.name} · {item.address}</MenuItem>)}</Select></FormControl>
      <Button startIcon={<RefreshRounded />} onClick={() => load()}>새로고침</Button>
      {selected && <div style={{ gridColumn: '1 / -1', color: '#667085' }}>{selected.propertyNumber || '물건번호 미입력'} · {selected.name}</div>}
    </section>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(110px,1fr))', gap: 10, marginBottom: 20 }}>
      {[
        ['문서', bundle.documents.length], ['미디어', bundle.media.length], ['Agent Jobs', jobs.length], ['Review 대기', pendingReviews], ['Blocked Agent', blockedAgents], ['검토 필요 Agent', attentionAgents], ['3D Room 연결', approvedRoomLinks],
      ].map(([label, value]) => <div key={String(label)} style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 14 }}><small style={{ color: '#667085' }}>{label}</small><strong style={{ display: 'block', fontSize: 24, marginTop: 5 }}>{value}</strong></div>)}
    </section>

    <Alert severity={failedJobs || blockedAgents ? 'error' : pendingReviews || attentionAgents ? 'warning' : 'success'} sx={{ mb: 2 }}>{failedJobs ? `실패 Job ${failedJobs}건 · ` : ''}{pendingReviews ? `Human Review ${pendingReviews}건 · ` : ''}{blockedAgents ? `Blocked Agent ${blockedAgents}개 · ` : ''}{attentionAgents ? `검토 필요 Agent ${attentionAgents}개` : '현재 주요 병목 없음'}</Alert>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(285px,1fr))', gap: 14 }}>
      {activeAgents.map((agent) => {
        const status = healthByAgent.get(agent.id);
        return <article key={agent.id} style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 17, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><div><small style={{ color: '#8b6c2d', fontWeight: 700 }}>{agent.code}</small><h2 style={{ margin: '3px 0 0', fontSize: 18 }}>{agent.name}</h2></div><Chip size="small" color={HEALTH_COLOR[status?.state || 'idle']} label={(status?.state || 'idle').toUpperCase()} /></div>
          <p style={{ color: '#667085', margin: 0, minHeight: 42 }}>{agent.purpose}</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Chip size="small" variant="outlined" label={`Jobs ${status?.jobCount ?? 0}`} /><Chip size="small" variant="outlined" label={`Review ${status?.pendingReviewCount ?? 0}`} /><Chip size="small" variant="outlined" label={`Evidence ${status?.evidenceCount ?? 0}`} /></div>
          {status?.blockers.length ? <div style={{ color: '#b54708', fontSize: 13 }}>{status.blockers.slice(0, 2).join(' · ')}</div> : <div style={{ color: '#027a48', fontSize: 13 }}>{status?.summary || '대기'}</div>}
          <Button endIcon={<ArrowForwardRounded />} onClick={() => navigate(agent.workspacePath)}>Agent Workspace</Button>
        </article>;
      })}
      <article style={{ background: '#f7f8fa', border: '1px dashed #cfd6df', borderRadius: 12, padding: 17 }}><small style={{ color: '#8b6c2d', fontWeight: 700 }}>A11</small><h2 style={{ margin: '3px 0 6px', fontSize: 18 }}>Report Agent</h2><p style={{ color: '#667085' }}>보고서 MASTER는 기능·데이터 계층 완성 후 최종 편집 단계에서 재검토합니다.</p><Chip icon={<HubRounded />} label="DEFERRED" variant="outlined" /></article>
    </section>
    <p style={{ color: '#98a2b3', fontSize: 12, marginTop: 18 }}>Room Reno 승인 {approvedRoomRenovations}건 · A0는 다른 Agent의 도메인 데이터를 직접 수정하지 않습니다.</p>
  </main>;
}
