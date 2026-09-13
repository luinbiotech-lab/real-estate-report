import { useEffect, useMemo, useState } from 'react';
import { AutoAwesomeRounded, PlayArrowRounded, RefreshRounded } from '@mui/icons-material';
import { Alert, Button, Chip, CircularProgress, FormControl, InputLabel, MenuItem, Select, Stack } from '@mui/material';
import type { AgentJob, AgentType } from '../domain/propertyDataRoom/types';
import { propertyRepository } from '../repositories/propertyRepository';
import { agentOrchestratorService } from '../services/agentOrchestratorService';
import type { Property } from '../types';

const AGENT_LABELS: Record<AgentType, string> = {
  intake: 'Intake Agent',
  document: 'Document Agent',
  interior_vision: 'Interior Vision Agent',
  floor_plan: 'Floor Plan Agent',
  space: 'Space Agent',
  renovation: 'Renovation Agent',
  risk_compliance: 'Risk / Compliance Agent',
  report: 'Report Agent',
  digital_twin: 'Digital Twin Agent',
};

const MANUAL_AGENTS: AgentType[] = ['interior_vision', 'floor_plan', 'space', 'renovation', 'risk_compliance', 'digital_twin'];
const STATUS_COLOR: Record<AgentJob['status'], 'default' | 'primary' | 'warning' | 'success' | 'error'> = {
  queued: 'default', running: 'primary', review_required: 'warning', completed: 'success', failed: 'error', cancelled: 'default',
};

export default function AgentOpsPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [jobs, setJobs] = useState<AgentJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const selected = useMemo(() => properties.find((item) => item.id === propertyId), [properties, propertyId]);

  const loadJobs = async (id = propertyId) => {
    if (!id) { setJobs([]); return; }
    const data = await agentOrchestratorService.list(id);
    setJobs(data.jobs);
  };

  useEffect(() => {
    (async () => {
      try {
        const list = await propertyRepository.getAll();
        setProperties(list);
        const firstId = list[0]?.id || '';
        setPropertyId(firstId);
        if (firstId) await loadJobs(firstId);
      } catch (reason) { setError(reason instanceof Error ? reason.message : 'Agent 작업을 불러오지 못했습니다.'); }
      finally { setLoading(false); }
    })();
  }, []);

  const queue = async (agentType: AgentType) => {
    if (!propertyId) return;
    setError('');
    try {
      await agentOrchestratorService.queuePropertyAgent(propertyId, agentType, 'manual', { requestedFrom: 'agent-ops' });
      await loadJobs();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Agent Job을 생성하지 못했습니다.'); }
  };

  const start = async (job: AgentJob) => {
    setError('');
    try { await agentOrchestratorService.start(job); await loadJobs(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Agent Job을 시작하지 못했습니다.'); }
  };

  if (loading) return <div className="center"><CircularProgress /><p>Agent Operations를 준비하는 중입니다.</p></div>;

  return <main style={{ padding: 28, maxWidth: 1280, margin: '0 auto' }}>
    <header style={{ marginBottom: 24 }}>
      <p className="eyebrow">PROPERTY INTELLIGENCE ORCHESTRATOR</p>
      <h1 style={{ margin: '6px 0' }}>Agent Operations</h1>
      <p style={{ color: '#667085' }}>업로드 자료를 Agent Job으로 라우팅하고, 실행·검토 상태를 한 화면에서 관리합니다.</p>
    </header>

    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

    <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <FormControl fullWidth size="small">
        <InputLabel id="agent-property-label">대상 물건</InputLabel>
        <Select labelId="agent-property-label" label="대상 물건" value={propertyId} onChange={async (event) => { const id = event.target.value; setPropertyId(id); await loadJobs(id); }}>
          {properties.map((item) => <MenuItem key={item.id} value={item.id}>{item.name} · {item.address}</MenuItem>)}
        </Select>
      </FormControl>
      {selected && <p style={{ margin: '12px 0 0', color: '#5c6775' }}>{selected.propertyNumber || '물건번호 미입력'} · {selected.name}</p>}
    </section>

    <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <h2 style={{ marginTop: 0 }}>수동 Agent Job 생성</h2>
      <p style={{ color: '#667085' }}>현재는 안전한 수동 큐잉 단계입니다. 자동 실행 어댑터가 연결되기 전까지 결과값은 Property 확정값을 직접 덮어쓰지 않습니다.</p>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        {MANUAL_AGENTS.map((agentType) => <Button key={agentType} variant="outlined" startIcon={<AutoAwesomeRounded />} disabled={!propertyId} onClick={() => queue(agentType)}>{AGENT_LABELS[agentType]}</Button>)}
      </Stack>
    </section>

    <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div><h2 style={{ margin: 0 }}>Agent Queue</h2><p style={{ margin: '5px 0 0', color: '#667085' }}>문서 업로드 시 Document/Floor Plan Agent Job도 자동 생성됩니다.</p></div>
        <Button startIcon={<RefreshRounded />} onClick={() => loadJobs()}>새로고침</Button>
      </div>
      <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
        {!jobs.length && <div style={{ padding: 28, textAlign: 'center', color: '#7b8794', background: '#f7f9fb', borderRadius: 8 }}>등록된 Agent Job이 없습니다.</div>}
        {jobs.map((job) => <article key={job.id} style={{ border: '1px solid #e1e6ec', borderRadius: 10, padding: 14, display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><strong>{AGENT_LABELS[job.agentType]}</strong><Chip size="small" color={STATUS_COLOR[job.status]} label={job.status} /><Chip size="small" variant="outlined" label={job.trigger} /></div>
            <small style={{ color: '#7b8794' }}>{job.resourceType || 'property'} · {job.resourceId || job.propertyId} · attempt {job.attempt}/{job.maxAttempts}</small>
            {job.error && <p style={{ color: '#b42318', margin: '6px 0 0' }}>{job.error}</p>}
          </div>
          <Button size="small" variant="contained" startIcon={<PlayArrowRounded />} disabled={job.status !== 'queued' && job.status !== 'failed'} onClick={() => start(job)}>실행 시작</Button>
        </article>)}
      </div>
    </section>
  </main>;
}
