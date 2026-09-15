import { useEffect, useMemo, useState } from 'react';
import { AssignmentTurnedInRounded, AutoAwesomeRounded, DescriptionRounded, ForumRounded, RefreshRounded } from '@mui/icons-material';
import { Alert, Button, Chip, CircularProgress, MenuItem, TextField } from '@mui/material';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { propertyRepository } from '../repositories/propertyRepository';
import { buildingReleaseCollaborationService } from '../services/buildingReleaseCollaborationService';
import { reviewHistoryService, type ReviewHistoryEvent, type ReviewHistoryKind } from '../services/reviewHistoryService';
import type { Property } from '../types';

const kindLabel: Record<ReviewHistoryKind, string> = {
  verification: '자료 검증',
  agent_review: 'Agent Review',
  report_snapshot: '보고서',
  external_review: '외부 검토',
};

const kindIcon = {
  verification: <AssignmentTurnedInRounded fontSize="small" />,
  agent_review: <AutoAwesomeRounded fontSize="small" />,
  report_snapshot: <DescriptionRounded fontSize="small" />,
  external_review: <ForumRounded fontSize="small" />,
};

function statusColor(status: ReviewHistoryEvent['status']): 'success' | 'warning' | 'error' | 'info' | 'default' {
  if (status === 'approved' || status === 'resolved' || status === 'ready') return 'success';
  if (status === 'held' || status === 'open' || status === 'pending' || status === 'draft') return 'warning';
  if (status === 'rejected' || status === 'failed') return 'error';
  if (status === 'archived') return 'default';
  return 'info';
}

export default function ReviewHistoryPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [events, setEvents] = useState<ReviewHistoryEvent[]>([]);
  const [kind, setKind] = useState<'all' | ReviewHistoryKind>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const selected = useMemo(() => properties.find((item) => item.id === propertyId), [properties, propertyId]);
  const filtered = useMemo(() => kind === 'all' ? events : events.filter((event) => event.kind === kind), [events, kind]);
  const counts = useMemo(() => ({
    all: events.length,
    verification: events.filter((event) => event.kind === 'verification').length,
    agent_review: events.filter((event) => event.kind === 'agent_review').length,
    report_snapshot: events.filter((event) => event.kind === 'report_snapshot').length,
    external_review: events.filter((event) => event.kind === 'external_review').length,
  }), [events]);

  const loadEvents = async (id: string) => {
    if (!id) return;
    setError('');
    try {
      const [bundle, externalReviewNotes] = await Promise.all([
        propertyDataRoomRepository.getBundle(id),
        buildingReleaseCollaborationService.listAllReviewNotes(),
      ]);
      setEvents(reviewHistoryService.build({
        propertyId: id,
        verificationCandidates: bundle.verificationCandidates ?? [],
        agentReviews: bundle.agentReviews ?? [],
        reportSnapshots: bundle.reportSnapshots ?? [],
        externalReviewNotes,
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '검토 이력을 불러오지 못했습니다.');
    }
  };

  useEffect(() => {
    (async () => {
      const rows = await propertyRepository.getAll();
      setProperties(rows);
      const first = rows.find((item) => item.id === 'daon-bangbae-815-11') || rows[0];
      if (first) {
        setPropertyId(first.id);
        await loadEvents(first.id);
      }
      setLoading(false);
    })();
  }, []);

  const changeProperty = async (id: string) => {
    setPropertyId(id);
    setKind('all');
    setLoading(true);
    await loadEvents(id);
    setLoading(false);
  };

  if (loading && !properties.length) return <div className="center"><CircularProgress /><p>검토 이력을 통합하는 중입니다.</p></div>;

  return <main style={{ padding: 28, maxWidth: 1320, margin: '0 auto' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 20 }}>
      <div><p className="eyebrow">VERIFICATION · HUMAN REVIEW · REPORT · EXTERNAL REVIEW</p><h1 style={{ margin: '5px 0' }}>검토 이력 통합</h1><p style={{ margin: 0, color: '#667085' }}>자료 검증, Agent Human Review, 보고서 Snapshot, 외부 검토 코멘트를 하나의 시간순 감사 타임라인으로 확인합니다.</p></div>
      <Button startIcon={<RefreshRounded />} onClick={() => void loadEvents(propertyId)}>새로고침</Button>
    </header>

    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

    <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <TextField select fullWidth size="small" label="대상 물건" value={propertyId} onChange={(event) => void changeProperty(event.target.value)}>
        {properties.map((item) => <MenuItem key={item.id} value={item.id}>{item.name} · {item.address}</MenuItem>)}
      </TextField>
      {selected && <p style={{ margin: '10px 0 0', color: '#667085', fontSize: 13 }}>{selected.propertyNumber || '물건번호 미입력'} · {selected.tradeType}</p>}
    </section>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(120px,1fr))', gap: 10, marginBottom: 16 }}>
      {[
        ['all', '전체', counts.all],
        ['verification', '자료 검증', counts.verification],
        ['agent_review', 'Agent Review', counts.agent_review],
        ['report_snapshot', '보고서', counts.report_snapshot],
        ['external_review', '외부 검토', counts.external_review],
      ].map(([value, label, count]) => <button key={String(value)} onClick={() => setKind(value as typeof kind)} style={{ border: kind === value ? '2px solid #073a69' : '1px solid #d9e0e8', background: '#fff', borderRadius: 10, padding: 13, textAlign: 'left', cursor: 'pointer' }}><small style={{ color: '#667085' }}>{label}</small><strong style={{ display: 'block', fontSize: 25, marginTop: 3 }}>{count}</strong></button>)}
    </section>

    <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}><div><p className="eyebrow" style={{ margin: 0 }}>AUDIT TIMELINE</p><h2 style={{ margin: '4px 0 0' }}>시간순 검토 기록</h2></div><Chip size="small" variant="outlined" label={`${filtered.length}건`} /></div>
      {!filtered.length ? <Alert severity="info">선택한 물건에 기록된 검토 이력이 없습니다. 원본 자료의 검증·Agent Review·보고서 생성·외부 검토가 발생하면 이곳에 자동 집계됩니다.</Alert> : <div style={{ display: 'grid', gap: 10 }}>
        {filtered.map((event) => <article key={event.id} style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr) 150px', gap: 12, border: '1px solid #e4e9ef', borderRadius: 10, padding: 14, alignItems: 'start' }}>
          <div style={{ width: 36, height: 36, borderRadius: 18, background: '#eef3f8', color: '#073a69', display: 'grid', placeItems: 'center' }}>{kindIcon[event.kind]}</div>
          <div><div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><strong>{event.title}</strong><Chip size="small" variant="outlined" label={kindLabel[event.kind]} /></div><p style={{ margin: '7px 0 4px', color: '#344054' }}>{event.detail}</p><small style={{ color: '#667085' }}>출처: {event.source}{event.actor ? ` · 담당 ${event.actor}` : ''}{event.reference ? ` · ${event.reference}` : ''}</small></div>
          <div style={{ textAlign: 'right' }}><Chip size="small" color={statusColor(event.status)} label={event.status.toUpperCase()} /><small style={{ display: 'block', color: '#667085', marginTop: 7 }}>{new Date(event.occurredAt).toLocaleString('ko-KR')}</small></div>
        </article>)}
      </div>}
    </section>
  </main>;
}
