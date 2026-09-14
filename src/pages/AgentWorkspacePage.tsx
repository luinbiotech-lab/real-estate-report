import { Alert, Button, Chip } from '@mui/material';
import { ArrowBackRounded, ArrowForwardRounded, LockRounded } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { getPlatformAgent, PLATFORM_AGENT_REGISTRY } from '../agents/agentRegistry';
import { getAgentContract } from '../agents/agentContracts';

export default function AgentWorkspacePage() {
  const { agentId = '' } = useParams();
  const navigate = useNavigate();
  const agent = getPlatformAgent(agentId);
  if (!agent || agent.id === 'integrator') return <main style={{ padding: 28 }}><Alert severity="error">Agent 정의를 찾을 수 없습니다.</Alert><Button sx={{ mt: 2 }} onClick={() => navigate('/control-center')}>Control Center</Button></main>;

  const contract = getAgentContract(agent.id);
  const upstream = agent.upstream.map((id) => getPlatformAgent(id)).filter(Boolean);
  const downstream = agent.downstream.map((id) => getPlatformAgent(id)).filter(Boolean);
  return <main style={{ padding: 28, maxWidth: 1180, margin: '0 auto' }}>
    <Button startIcon={<ArrowBackRounded />} onClick={() => navigate('/control-center')}>A0 Control Center</Button>
    <header style={{ margin: '16px 0 22px' }}><p className="eyebrow">{agent.code} · ISOLATED AGENT WORKSPACE</p><h1 style={{ margin: '6px 0' }}>{agent.name}</h1><p style={{ color: '#667085', maxWidth: 850 }}>{agent.purpose}</p></header>
    {agent.status === 'deferred' && <Alert severity="info" sx={{ mb: 2 }}>이 Agent는 현재 보류 상태입니다. 기존 MASTER는 유지하며 마지막 편집 단계에서 재개합니다.</Alert>}
    <Alert severity="warning" icon={<LockRounded />} sx={{ mb: 2 }}>Agent Isolation Rule: 이 Agent는 `Direct Write Owns` 범위만 직접 기록합니다. 다른 Agent 소유 데이터는 contract 결과를 전달하고 해당 Agent/Human Review가 승격합니다.</Alert>

    <section style={{ display: 'grid', gridTemplateColumns: '1.15fr .85fr', gap: 16 }}>
      <article style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>Owned Modules</h2>
        <p style={{ color: '#667085' }}>이 Agent가 책임지는 데이터/기능 경계입니다.</p>
        <div style={{ display: 'grid', gap: 9 }}>{agent.owns.map((item) => <div key={item} style={{ padding: 12, borderRadius: 9, background: '#f7f9fb', border: '1px solid #e5e9ef' }}><strong>{item}</strong></div>)}</div>
        {agent.launchPath && <Button variant="contained" endIcon={<ArrowForwardRounded />} sx={{ mt: 16 }} onClick={() => navigate(agent.launchPath!)}>현재 기능 화면 열기</Button>}
      </article>
      <article style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>Agent Contract</h2>
        <div style={{ marginBottom: 16 }}><small style={{ color: '#667085' }}>Runtime Agent</small><div><Chip sx={{ mt: .7 }} label={agent.runtimeAgentType || 'platform module'} variant="outlined" /></div></div>
        <div style={{ marginBottom: 16 }}><small style={{ color: '#667085' }}>Human Review</small><div><Chip sx={{ mt: .7 }} color={agent.humanReviewRequired ? 'warning' : 'success'} label={agent.humanReviewRequired ? 'REQUIRED' : 'NOT REQUIRED'} /></div></div>
        <div style={{ marginBottom: 14 }}><strong>Upstream</strong><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>{upstream.length ? upstream.map((item) => <Chip key={item!.id} size="small" label={`${item!.code} ${item!.shortName}`} onClick={() => navigate(item!.workspacePath)} />) : <span style={{ color: '#98a2b3' }}>없음</span>}</div></div>
        <div><strong>Downstream</strong><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>{downstream.length ? downstream.map((item) => <Chip key={item!.id} size="small" variant="outlined" label={`${item!.code} ${item!.shortName}`} onClick={() => navigate(item!.workspacePath)} />) : <span style={{ color: '#98a2b3' }}>없음</span>}</div></div>
      </article>
    </section>

    <section style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <article style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20 }}><h2 style={{ marginTop: 0 }}>Contract Input → Output</h2><strong>Accepts</strong><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '8px 0 16px' }}>{contract.accepts.map((item) => <Chip key={item} size="small" label={item} />)}</div><strong>Emits</strong><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>{contract.emits.map((item) => <Chip key={item} size="small" color="primary" variant="outlined" label={item} />)}</div></article>
      <article style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20 }}><h2 style={{ marginTop: 0 }}>Write Boundary</h2><strong>Direct Write Owns</strong><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '8px 0 16px' }}>{contract.directWriteOwns.map((item) => <Chip key={item} size="small" color="success" variant="outlined" label={item} />)}</div><strong>Forbidden Direct Writes</strong><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>{contract.forbiddenDirectWrites.map((item) => <Chip key={item} size="small" color="error" variant="outlined" label={item} />)}</div></article>
    </section>

    <section style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}><Alert severity="info"><strong>Promotion Rule</strong><br />{contract.promotionRule}</Alert><Alert severity="warning"><strong>Safety Boundary</strong><br />{contract.safetyBoundary}</Alert></section>

    <section style={{ marginTop: 16, background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20 }}>
      <h2 style={{ marginTop: 0 }}>전체 Agent Registry</h2>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>{PLATFORM_AGENT_REGISTRY.filter((item) => item.id !== 'integrator').map((item) => <Chip key={item.id} color={item.id === agent.id ? 'primary' : 'default'} variant={item.id === agent.id ? 'filled' : 'outlined'} label={`${item.code} ${item.shortName}`} onClick={() => navigate(item.workspacePath)} />)}</div>
    </section>
  </main>;
}
