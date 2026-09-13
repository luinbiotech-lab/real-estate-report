import { useEffect, useMemo, useState } from 'react';
import { AutoAwesomeRounded, CheckRounded, PauseRounded, PlayArrowRounded, RefreshRounded, RestartAltRounded, CloseRounded } from '@mui/icons-material';
import { Alert, Button, Chip, CircularProgress, FormControl, InputLabel, MenuItem, Select, Stack } from '@mui/material';
import type { AgentJob, AgentResult, AgentReview, AgentType } from '../domain/propertyDataRoom/types';
import { propertyRepository } from '../repositories/propertyRepository';
import { agentExecutionService } from '../services/agentExecutionService';
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

function resultSummary(result: AgentResult) {
  if (result.resultType === 'media_classification_candidate') {
    const count = Array.isArray(result.payload.candidates) ? result.payload.candidates.length : 0;
    return `사진/미디어 분류 후보 ${count}건`;
  }
  if (result.resultType === 'space_model_candidate') {
    const count = Array.isArray(result.payload.spaces) ? result.payload.spaces.length : 0;
    return `공간 모델 후보 ${count}건`;
  }
  if (result.resultType === 'floor_plan_intake_candidate') {
    const floor = typeof result.payload.floor === 'string' ? result.payload.floor : '층 미확인';
    return `도면 Intake · ${floor}`;
  }
  return typeof result.payload.message === 'string' ? result.payload.message : result.resultType;
}

export default function AgentOpsPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [jobs, setJobs] = useState<AgentJob[]>([]);
  const [results, setResults] = useState<AgentResult[]>([]);
  const [reviews, setReviews] = useState<AgentReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const selected = useMemo(() => properties.find((item) => item.id === propertyId), [properties, propertyId]);
  const resultById = useMemo(() => new Map(results.map((item) => [item.id, item])), [results]);
  const jobById = useMemo(() => new Map(jobs.map((item) => [item.id, item])), [jobs]);
  const pendingReviews = useMemo(() => reviews.filter((item) => item.decision === 'pending' || item.decision === 'held'), [reviews]);

  const loadJobs = async (id = propertyId) => {
    if (!id) { setJobs([]); setResults([]); setReviews([]); return; }
    const data = await agentOrchestratorService.list(id);
    setJobs(data.jobs); setResults(data.results); setReviews(data.reviews);
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

  const execute = async (job: AgentJob) => {
    setBusyId(job.id); setError('');
    try { await agentExecutionService.execute(job); await loadJobs(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Agent Job을 실행하지 못했습니다.'); }
    finally { setBusyId(''); }
  };

  const reviewResult = async (review: AgentReview, decision: 'approved' | 'held' | 'rejected') => {
    const job = jobById.get(review.jobId); const result = resultById.get(review.resultId);
    if (!job || !result) { setError('Agent 검토에 필요한 Job/Result를 찾을 수 없습니다.'); return; }
    setBusyId(review.id); setError('');
    try { await agentExecutionService.reviewAndApply(job, review, result, decision); await loadJobs(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Agent 결과를 검토하지 못했습니다.'); }
    finally { setBusyId(''); }
  };

  if (loading) return <div className="center"><CircularProgress /><p>Agent Operations를 준비하는 중입니다.</p></div>;

  return <main style={{ padding: 28, maxWidth: 1280, margin: '0 auto' }}>
    <header style={{ marginBottom: 24 }}>
      <p className="eyebrow">PROPERTY INTELLIGENCE ORCHESTRATOR</p>
      <h1 style={{ margin: '6px 0' }}>Agent Operations</h1>
      <p style={{ color: '#667085' }}>Interior Vision → Floor Plan → Space Model → Digital Twin 흐름을 Job·Result·Human Review로 관리합니다.</p>
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
      <h2 style={{ marginTop: 0 }}>Agent Job 생성</h2>
      <p style={{ color: '#667085' }}>분석 결과는 바로 확정값을 덮어쓰지 않습니다. 실행 결과는 검토 대기 상태로 생성되고 승인된 결과만 공간/미디어 데이터에 반영됩니다.</p>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        {MANUAL_AGENTS.map((agentType) => <Button key={agentType} variant="outlined" startIcon={<AutoAwesomeRounded />} disabled={!propertyId} onClick={() => queue(agentType)}>{AGENT_LABELS[agentType]}</Button>)}
      </Stack>
    </section>

    <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div><h2 style={{ margin: 0 }}>Human Review Gate</h2><p style={{ margin: '5px 0 0', color: '#667085' }}>Interior/Floor Plan/Space Agent의 후보 결과를 승인해야 실제 데이터에 반영됩니다.</p></div>
        <Chip color={pendingReviews.length ? 'warning' : 'success'} label={`검토 ${pendingReviews.length}건`} />
      </div>
      <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
        {!pendingReviews.length && <div style={{ padding: 24, textAlign: 'center', color: '#7b8794', background: '#f7f9fb', borderRadius: 8 }}>검토 대기 결과가 없습니다.</div>}
        {pendingReviews.map((review) => {
          const result = resultById.get(review.resultId); const job = jobById.get(review.jobId);
          if (!result || !job) return null;
          return <article key={review.id} style={{ border: '1px solid #ead8b7', background: '#fffdf8', borderRadius: 10, padding: 14, display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'center' }}>
            <div><strong>{AGENT_LABELS[job.agentType]}</strong><p style={{ margin: '5px 0', color: '#475467' }}>{resultSummary(result)}</p><small style={{ color: '#7b8794' }}>confidence {typeof result.confidence === 'number' ? `${Math.round(result.confidence * 100)}%` : '미산정'} · {result.resultType}</small></div>
            <Stack direction="row" spacing={1}>
              <Button size="small" startIcon={<PauseRounded />} disabled={busyId === review.id} onClick={() => reviewResult(review, 'held')}>보류</Button>
              <Button size="small" color="error" startIcon={<CloseRounded />} disabled={busyId === review.id} onClick={() => reviewResult(review, 'rejected')}>거절</Button>
              <Button size="small" variant="contained" color="success" startIcon={<CheckRounded />} disabled={busyId === review.id} onClick={() => reviewResult(review, 'approved')}>승인·반영</Button>
            </Stack>
          </article>;
        })}
      </div>
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
          <Button size="small" variant="contained" startIcon={job.status === 'failed' ? <RestartAltRounded /> : <PlayArrowRounded />} disabled={!['queued', 'failed'].includes(job.status) || busyId === job.id} onClick={() => execute(job)}>{busyId === job.id ? '실행 중' : job.status === 'failed' ? '재실행' : '실행'}</Button>
        </article>)}
      </div>
    </section>
  </main>;
}
