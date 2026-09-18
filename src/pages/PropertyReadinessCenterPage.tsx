import { ArrowForwardRounded, FactCheckRounded, RefreshRounded, TaskAltRounded, WarningAmberRounded } from '@mui/icons-material';
import { Button, Chip, CircularProgress, MenuItem, TextField } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { propertyRepository } from '../repositories/propertyRepository';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { derivePropertyNextActions, type PropertyNextAction } from '../services/propertyNextActionService';
import { assessPropertyReadiness, type PropertyReadinessAssessment, type ReadinessStage, type ReadinessState } from '../services/propertyReadinessService';
import { propertyReadinessWorklogService, type ReadinessWorklogEntry } from '../services/propertyReadinessWorklogService';
import type { Property } from '../types';

type Row = { property: Property; readiness: PropertyReadinessAssessment };
type Filter = 'all' | 'attention' | 'strong';

const stateColor: Record<ReadinessState, 'success' | 'warning' | 'default'> = { ready: 'success', partial: 'warning', missing: 'default' };
function stateLabel(state: ReadinessState) { return state === 'ready' ? 'READY' : state === 'partial' ? 'PARTIAL' : 'MISSING'; }

export default function PropertyReadinessCenterPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [recentProgress, setRecentProgress] = useState<ReadinessWorklogEntry[]>([]);
  const [openWork, setOpenWork] = useState<ReadinessWorklogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const properties = await propertyRepository.getAll();
      const assessments = await Promise.all(properties.map(async (property) => ({ property, readiness: assessPropertyReadiness(property, await propertyDataRoomRepository.getBundle(property.id)) })));
      const sorted = assessments.sort((a, b) => a.readiness.scorePct - b.readiness.scorePct || b.property.updatedAt.localeCompare(a.property.updatedAt));
      setRows(sorted);
      propertyReadinessWorklogService.reconcile(sorted);
      setRecentProgress(propertyReadinessWorklogService.listRecentProgress());
      setOpenWork(propertyReadinessWorklogService.listOpen());
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const metrics = useMemo(() => ({
    total: rows.length,
    attention: rows.filter((row) => row.readiness.missingCount > 0).length,
    strong: rows.filter((row) => row.readiness.scorePct >= 80).length,
    avg: rows.length ? Math.round(rows.reduce((sum, row) => sum + row.readiness.scorePct, 0) / rows.length) : 0,
  }), [rows]);
  const nextActions = useMemo(() => derivePropertyNextActions(rows), [rows]);
  const missingActions = useMemo(() => nextActions.filter((action) => action.state === 'missing').length, [nextActions]);
  const partialActions = nextActions.length - missingActions;
  const openIds = useMemo(() => new Set(openWork.map((entry) => entry.id)), [openWork]);

  const filtered = useMemo(() => rows.filter((row) => {
    if (filter === 'attention' && row.readiness.missingCount === 0) return false;
    if (filter === 'strong' && row.readiness.scorePct < 80) return false;
    const haystack = `${row.property.name} ${row.property.address} ${row.property.propertyNumber}`.toLowerCase();
    return !query.trim() || haystack.includes(query.trim().toLowerCase());
  }), [rows, filter, query]);

  const openStage = (propertyId: string, stage: ReadinessStage) => {
    if (stage.id === 'core') return navigate(`/property/${propertyId}/edit`);
    navigate(`/property/${propertyId}/data-room${stage.pathSuffix || ''}`);
  };
  const openAction = (action: PropertyNextAction) => {
    propertyReadinessWorklogService.recordOpened(action);
    setOpenWork(propertyReadinessWorklogService.listOpen());
    navigate(action.path);
  };

  if (loading) return <div className="center"><CircularProgress /><p>물건 준비도를 계산하는 중입니다.</p></div>;

  return <main style={{ padding: 28, maxWidth: 1480, margin: '0 auto' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 20 }}>
      <div><p className="eyebrow">PROPERTY READINESS · DATA ROOM PIPELINE</p><h1 style={{ margin: '5px 0' }}>Property Readiness Center</h1><p style={{ margin: 0, color: '#667085' }}>기본정보 → 문서 → 구조화/출처 → 검증 → 미디어 → 보고서 → 3D 준비상태를 실제 저장 데이터로 점검합니다.</p></div>
      <Button startIcon={<RefreshRounded />} onClick={() => void load()}>재검사 / 새로고침</Button>
    </header>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(150px,1fr))', gap: 10, marginBottom: 14 }}>
      {([['전체 물건', metrics.total, '건'], ['보완 필요', metrics.attention, '건'], ['80% 이상', metrics.strong, '건'], ['평균 준비도', metrics.avg, '%']] as const).map(([label, value, unit]) => <div key={label} style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 14 }}><small style={{ color: '#667085' }}>{label}</small><div style={{ display: 'flex', gap: 4, alignItems: 'baseline', marginTop: 4 }}><strong style={{ fontSize: 28 }}>{value}</strong><span style={{ color: '#98a2b3' }}>{unit}</span></div></div>)}
    </section>

    <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
      <div style={{ background: '#10243f', color: '#fff', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div><small style={{ color: '#d7c8a7', letterSpacing: '.1em' }}>NEXT ACTION QUEUE</small><strong style={{ display: 'block', marginTop: 3 }}>준비도 기반 다음 작업</strong></div>
        <div style={{ display: 'flex', gap: 6 }}><Chip size="small" sx={{ color: '#fff', borderColor: 'rgba(255,255,255,.35)' }} variant="outlined" label={`MISSING ${missingActions}`} /><Chip size="small" sx={{ color: '#fff', borderColor: 'rgba(255,255,255,.35)' }} variant="outlined" label={`PARTIAL ${partialActions}`} /><Chip size="small" sx={{ color: '#fff', borderColor: 'rgba(255,255,255,.35)' }} variant="outlined" label={`OPENED ${openWork.length}`} /></div>
      </div>
      {!nextActions.length && <div style={{ padding: 18, color: '#667085' }}>현재 준비도 기준으로 보완할 항목이 없습니다.</div>}
      <div style={{ display: 'grid' }}>{nextActions.slice(0, 12).map((action, index) => <div key={action.id} style={{ display: 'grid', gridTemplateColumns: '90px minmax(220px,.8fr) 150px 1fr auto', gap: 10, alignItems: 'center', padding: '11px 14px', borderTop: index === 0 ? 'none' : '1px solid #edf0f4' }}>
        <Chip size="small" color={action.state === 'missing' ? 'default' : 'warning'} variant="outlined" label={action.state.toUpperCase()} />
        <div><strong style={{ display: 'block', fontSize: 13 }}>{action.propertyName}</strong><small style={{ color: '#98a2b3' }}>workflow #{action.workflowOrder}{openIds.has(action.id) ? ' · OPENED' : ''}</small></div>
        <strong style={{ fontSize: 13 }}>{action.stageLabel}</strong><span style={{ color: '#667085', fontSize: 12 }}>{action.detail}</span>
        <Button size="small" endIcon={<ArrowForwardRounded />} onClick={() => openAction(action)}>{openIds.has(action.id) ? '다시 보완' : '보완 화면'}</Button>
      </div>)}</div>
      {nextActions.length > 12 && <div style={{ padding: '9px 14px', borderTop: '1px solid #edf0f4', color: '#667085', fontSize: 12 }}>상위 12개 작업을 표시 중 · 전체 {nextActions.length}개</div>}
    </section>

    <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
      <div style={{ padding: '13px 16px', background: '#f7f9fb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}><div><small className="eyebrow">RECENT PROGRESS</small><strong style={{ display: 'block', marginTop: 3 }}>실제 데이터 변화로 확인된 진행</strong></div><TaskAltRounded color="success" /></div>
      {!recentProgress.length && <div style={{ padding: 16, color: '#667085', fontSize: 13 }}>아직 실제 준비도 변화로 완료·개선된 작업이 없습니다. 보완 후 `재검사 / 새로고침`하면 자동 판정됩니다.</div>}
      {recentProgress.map((entry) => <div key={`${entry.id}:${entry.progressedAt}`} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 150px 1fr', gap: 10, padding: '10px 14px', borderTop: '1px solid #edf0f4', alignItems: 'center' }}>
        <Chip size="small" color={entry.status === 'completed' ? 'success' : 'warning'} variant="outlined" label={entry.status === 'completed' ? 'COMPLETED' : 'IMPROVED'} />
        <strong style={{ fontSize: 13 }}>{entry.propertyName}</strong><span style={{ fontSize: 13 }}>{entry.stageLabel}</span><span style={{ color: '#667085', fontSize: 12 }}>{entry.initialState.toUpperCase()} → {entry.lastObservedState.toUpperCase()} · {entry.lastObservedDetail}</span>
      </div>)}
    </section>

    <section style={{ background: '#10243f', borderRadius: 12, padding: 14, display: 'grid', gridTemplateColumns: '1fr 190px', gap: 10, marginBottom: 14 }}>
      <TextField size="small" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="물건명 · 주소 · 물건번호 검색" sx={{ background: '#fff', borderRadius: 1 }} />
      <TextField select size="small" value={filter} onChange={(event) => setFilter(event.target.value as Filter)} sx={{ background: '#fff', borderRadius: 1 }}><MenuItem value="all">전체</MenuItem><MenuItem value="attention">보완 필요</MenuItem><MenuItem value="strong">80% 이상</MenuItem></TextField>
    </section>

    <section style={{ display: 'grid', gap: 10 }}>
      {!filtered.length && <div style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 30, textAlign: 'center', color: '#667085' }}>조건에 맞는 물건이 없습니다.</div>}
      {filtered.map(({ property, readiness }) => <article key={property.id} style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 15 }}><div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px,.8fr) 100px 1fr auto', gap: 12, alignItems: 'center' }}>
        <div><button className="property-name-link" onClick={() => navigate(`/property/${property.id}`)}>{property.name}</button><small style={{ display: 'block', color: '#667085', marginTop: 4 }}>{property.address}</small><small style={{ display: 'block', color: '#98a2b3', marginTop: 2 }}>{property.propertyNumber || '물건번호 미입력'}</small></div>
        <div style={{ textAlign: 'center' }}><strong style={{ display: 'block', fontSize: 26, color: readiness.scorePct >= 80 ? '#157347' : readiness.scorePct >= 50 ? '#a26200' : '#b42318' }}>{readiness.scorePct}%</strong><small style={{ color: '#667085' }}>준비도</small></div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{readiness.stages.map((stage) => <Chip key={stage.id} size="small" clickable onClick={() => openStage(property.id, stage)} color={stateColor[stage.state]} variant={stage.state === 'ready' ? 'filled' : 'outlined'} label={`${stage.label} · ${stateLabel(stage.state)} · ${stage.detail}`} />)}</div>
        <div style={{ display: 'flex', gap: 6, flexDirection: 'column', minWidth: 120 }}><Chip size="small" color="success" variant="outlined" label={`READY ${readiness.readyCount}`} /><Chip size="small" color="warning" variant="outlined" label={`PARTIAL ${readiness.partialCount}`} /><Chip size="small" variant="outlined" label={`MISSING ${readiness.missingCount}`} /></div>
      </div></article>)}
    </section>

    <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center', color: '#667085', fontSize: 12 }}><WarningAmberRounded fontSize="small" /><span>준비도는 저장된 자료의 존재와 상태를 보여주는 운영 지표입니다. 법적·기술적 적합성 또는 거래 안전성을 보증하지 않습니다.</span></div>
    <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', color: '#667085', fontSize: 12 }}><FactCheckRounded fontSize="small" /><span>Verification이 없는 imported 자료는 검증 완료로 승격하지 않습니다. 작업 완료도 실제 readiness 변화가 확인될 때만 기록됩니다.</span></div>
  </main>;
}
