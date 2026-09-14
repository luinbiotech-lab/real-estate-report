import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Chip, CircularProgress, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { ArrowForwardRounded, HubRounded, RefreshRounded } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { PLATFORM_AGENT_REGISTRY } from '../agents/agentRegistry';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { propertyRepository } from '../repositories/propertyRepository';
import type { Property } from '../types';

export default function AgentControlCenterPage() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof propertyDataRoomRepository.getBundle>>>({ documents: [], media: [], verifications: [], verificationCandidates: [], dataSources: [], reportSnapshots: [], digitalTwinAssets: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const selected = useMemo(() => properties.find((item) => item.id === propertyId), [properties, propertyId]);
  const load = async (id = propertyId) => { if (id) setBundle(await propertyDataRoomRepository.getBundle(id)); };

  useEffect(() => {
    (async () => {
      try {
        const list = await propertyRepository.getAll(); setProperties(list);
        const first = list[0]?.id || ''; setPropertyId(first); if (first) await load(first);
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

  return <main style={{ padding: 28, maxWidth: 1380, margin: '0 auto' }}>
    <header style={{ marginBottom: 22 }}><p className="eyebrow">A0 · INTEGRATOR</p><h1 style={{ margin: '6px 0' }}>Agent Control Center</h1><p style={{ color: '#667085' }}>각 Agent는 독립된 책임과 Workspace를 유지하고, A0는 Property 단위 상태와 Human Review 병목만 통합 관제합니다.</p></header>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

    <section style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 18, marginBottom: 18 }}>
      <FormControl size="small" fullWidth><InputLabel id="control-property-label">대상 물건</InputLabel><Select labelId="control-property-label" label="대상 물건" value={propertyId} onChange={async (event) => { setPropertyId(event.target.value); await load(event.target.value); }}>{properties.map((item) => <MenuItem key={item.id} value={item.id}>{item.name} · {item.address}</MenuItem>)}</Select></FormControl>
      <Button startIcon={<RefreshRounded />} onClick={() => load()}>새로고침</Button>
      {selected && <div style={{ gridColumn: '1 / -1', color: '#667085' }}>{selected.propertyNumber || '물건번호 미입력'} · {selected.name}</div>}
    </section>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(110px,1fr))', gap: 10, marginBottom: 20 }}>
      {[
        ['문서', bundle.documents.length], ['미디어', bundle.media.length], ['Agent Jobs', jobs.length], ['Review 대기', pendingReviews], ['실패 Jobs', failedJobs], ['3D Room 연결', approvedRoomLinks], ['Room Reno 승인', approvedRoomRenovations],
      ].map(([label, value]) => <div key={String(label)} style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 14 }}><small style={{ color: '#667085' }}>{label}</small><strong style={{ display: 'block', fontSize: 24, marginTop: 5 }}>{value}</strong></div>)}
    </section>

    <Alert severity={pendingReviews || failedJobs ? 'warning' : 'success'} sx={{ mb: 2 }}>{pendingReviews ? `Human Review ${pendingReviews}건이 대기 중입니다.` : '현재 Human Review 대기 없음'} {failedJobs ? `· 실패 Job ${failedJobs}건 확인 필요` : ''}</Alert>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(285px,1fr))', gap: 14 }}>
      {activeAgents.map((agent) => {
        const agentJobs = agent.runtimeAgentType ? jobs.filter((job) => job.agentType === agent.runtimeAgentType) : [];
        const reviewCount = agent.runtimeAgentType ? reviews.filter((review) => review.decision !== 'approved' && agentJobs.some((job) => job.id === review.jobId)).length : 0;
        return <article key={agent.id} style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 17, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><div><small style={{ color: '#8b6c2d', fontWeight: 700 }}>{agent.code}</small><h2 style={{ margin: '3px 0 0', fontSize: 18 }}>{agent.name}</h2></div><Chip size="small" color={reviewCount ? 'warning' : 'success'} variant="outlined" label={agent.runtimeAgentType ? `Review ${reviewCount}` : 'Module'} /></div>
          <p style={{ color: '#667085', margin: 0, minHeight: 42 }}>{agent.purpose}</p>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{agent.owns.slice(0, 4).map((item) => <Chip key={item} size="small" variant="outlined" label={item} />)}</div>
          <Button endIcon={<ArrowForwardRounded />} onClick={() => navigate(agent.workspacePath)}>Agent Workspace</Button>
        </article>;
      })}
      <article style={{ background: '#f7f8fa', border: '1px dashed #cfd6df', borderRadius: 12, padding: 17 }}><small style={{ color: '#8b6c2d', fontWeight: 700 }}>A11</small><h2 style={{ margin: '3px 0 6px', fontSize: 18 }}>Report Agent</h2><p style={{ color: '#667085' }}>보고서 MASTER는 기능·데이터 계층 완성 후 최종 편집 단계에서 재검토합니다.</p><Chip icon={<HubRounded />} label="DEFERRED" variant="outlined" /></article>
    </section>
  </main>;
}
