import { useEffect, useMemo, useState } from 'react';
import { GavelRounded, PlayArrowRounded, RefreshRounded } from '@mui/icons-material';
import { Alert, Button, Chip, CircularProgress, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import type { AgentJob, PropertyRiskAssessment, RiskCheckStatus } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { propertyRepository } from '../repositories/propertyRepository';
import { agentOrchestratorService } from '../services/agentOrchestratorService';
import { agentRuntimeService } from '../services/agentRuntimeService';
import type { Property } from '../types';

const STATUS_LABEL: Record<RiskCheckStatus, string> = { clear: '자료 연결', review: '추가 검토', missing: '자료 부족', not_applicable: '해당 없음' };
const STATUS_COLOR: Record<RiskCheckStatus, 'success' | 'warning' | 'error' | 'default'> = { clear: 'success', review: 'warning', missing: 'error', not_applicable: 'default' };

export default function RiskWorkspacePage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [assessments, setAssessments] = useState<PropertyRiskAssessment[]>([]);
  const [jobs, setJobs] = useState<AgentJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const selected = useMemo(() => properties.find((item) => item.id === propertyId), [properties, propertyId]);
  const latest = useMemo(() => [...assessments].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0], [assessments]);

  const load = async (id = propertyId) => {
    if (!id) return;
    const [risk, agentJobs] = await Promise.all([propertyDataRoomRepository.getRiskAssessments(id), propertyDataRoomRepository.getAgentJobs(id)]);
    setAssessments(risk); setJobs(agentJobs);
  };

  useEffect(() => {
    (async () => {
      try {
        const list = await propertyRepository.getAll(); setProperties(list);
        const first = list[0]?.id || ''; setPropertyId(first);
        if (first) await load(first);
      } catch (reason) { setError(reason instanceof Error ? reason.message : 'Risk Workspace를 불러오지 못했습니다.'); }
      finally { setLoading(false); }
    })();
  }, []);

  const runRisk = async () => {
    if (!propertyId) return;
    setBusy(true); setError('');
    try {
      const job = await agentOrchestratorService.queuePropertyAgent(propertyId, 'risk_compliance', 'manual', { requestedFrom: 'risk-workspace' });
      await agentRuntimeService.execute(job);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Risk / Compliance Agent를 실행하지 못했습니다.'); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="center"><CircularProgress /><p>Risk Workspace를 준비하는 중입니다.</p></div>;

  const reviewRequired = jobs.filter((job) => job.agentType === 'risk_compliance' && job.status === 'review_required').length;
  return <main style={{ padding: 28, maxWidth: 1280, margin: '0 auto' }}>
    <header style={{ marginBottom: 24 }}><p className="eyebrow">PRE-CHECK · NOT A LEGAL OPINION</p><h1 style={{ margin: '6px 0' }}>Risk / Compliance Workspace</h1><p style={{ color: '#667085' }}>공적자료·검증상태·도면·공간·리노베이션 데이터를 자동 점검하되 법률·건축·인허가의 확정 판단은 하지 않습니다.</p></header>
    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

    <section style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20, marginBottom: 20, alignItems: 'center' }}>
      <FormControl size="small" fullWidth><InputLabel id="risk-property-label">대상 물건</InputLabel><Select labelId="risk-property-label" label="대상 물건" value={propertyId} onChange={async (event) => { setPropertyId(event.target.value); await load(event.target.value); }}>{properties.map((item) => <MenuItem key={item.id} value={item.id}>{item.name} · {item.address}</MenuItem>)}</Select></FormControl>
      <Button startIcon={<RefreshRounded />} onClick={() => load()}>새로고침</Button>
      <Button variant="contained" startIcon={<PlayArrowRounded />} disabled={!propertyId || busy} onClick={runRisk}>{busy ? '점검 중' : '사전 점검 실행'}</Button>
      {selected && <div style={{ gridColumn: '1 / -1', color: '#667085' }}>{selected.propertyNumber || '물건번호 미입력'} · {selected.name}</div>}
    </section>

    {reviewRequired > 0 && <Alert severity="warning" sx={{ mb: 2 }}>Risk / Compliance Agent 결과 {reviewRequired}건이 Human Review 대기 중입니다. Agent Operations에서 승인해야 확정된 사전검토 기록으로 저장됩니다.</Alert>}

    {!latest ? <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 36, textAlign: 'center', color: '#667085' }}><GavelRounded sx={{ fontSize: 42, color: '#98a2b3' }} /><h2>승인된 사전 리스크 검토가 없습니다.</h2><p>사전 점검 실행 → Agent Operations Human Review → 승인 순서로 기록이 생성됩니다.</p></section> : <>
      <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}><div><h2 style={{ marginTop: 0 }}>{latest.title}</h2><p style={{ color: '#475467' }}>{latest.summary}</p></div><Chip label={latest.verificationStatus} color="success" /></div>
        <Alert severity="info">{latest.disclaimer}</Alert>
      </section>
      <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>사전 체크리스트</h2>
        <div style={{ display: 'grid', gap: 10 }}>{latest.checks.map((check) => <article key={check.key} style={{ border: '1px solid #e1e6ec', borderRadius: 10, padding: 14, display: 'grid', gridTemplateColumns: '180px 120px 1fr', gap: 12, alignItems: 'center' }}><strong>{check.label}</strong><Chip size="small" color={STATUS_COLOR[check.status]} label={STATUS_LABEL[check.status]} /><span style={{ color: '#667085' }}>{check.detail}</span></article>)}</div>
      </section>
    </>}
  </main>;
}
