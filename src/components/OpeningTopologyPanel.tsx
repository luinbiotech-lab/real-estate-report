import { useMemo, useState } from 'react';
import { Alert, Button, Chip, TextField } from '@mui/material';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { openingTopologyService, readOpeningAdjacencyReviews, type OpeningAdjacencyCandidate } from '../services/openingTopologyService';

export default function OpeningTopologyPanel({ asset, onSaved }: { asset: DigitalTwinAsset; onSaved?: () => void | Promise<void> }) {
  const candidates = useMemo(() => openingTopologyService.buildCandidates(asset), [asset]);
  const reviews = useMemo(() => readOpeningAdjacencyReviews(asset), [asset]);
  const reviewById = useMemo(() => new Map(reviews.map((item) => [item.candidateId, item])), [reviews]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const act = async (candidate: OpeningAdjacencyCandidate, decision: 'approved' | 'held' | 'rejected') => {
    setBusy(candidate.id); setError('');
    try {
      await openingTopologyService.review(asset, candidate, decision, notes[candidate.id] || reviewById.get(candidate.id)?.note || '');
      await onSaved?.();
    } catch (reason) { setError(reason instanceof Error ? reason.message : '문·창 연결 검토를 저장하지 못했습니다.'); }
    finally { setBusy(''); }
  };

  const approved = reviews.filter((item) => item.decision === 'approved').length;
  return <section style={{ border: '1px solid #d9e0e8', borderRadius: 10, padding: 14, background: '#fbfcfe' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}>
      <div><strong>Door / Window Topology</strong><p style={{ margin: '4px 0 0', color: '#667085', fontSize: 13 }}>승인된 door/window layer와 승인된 공간 경계의 근접관계를 후보로 연결합니다. 실제 개구부 위치·폭은 확정하지 않습니다.</p></div>
      <div style={{ display: 'flex', gap: 6 }}><Chip size="small" label={`후보 ${candidates.length}`} /><Chip size="small" color={approved ? 'success' : 'default'} label={`승인 ${approved}`} /></div>
    </div>
    <Alert severity="warning" sx={{ mb: 1.5 }}>근접도 기반 후보입니다. 동일 위치에 겹친 선·심볼·블록 때문에 잘못 연결될 수 있으므로 Human Review가 필요합니다.</Alert>
    {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
    {!candidates.length && <div style={{ padding: 18, textAlign: 'center', color: '#7b8794' }}>승인된 door/window layer 또는 연결 가능한 공간 경계가 없습니다.</div>}
    <div style={{ display: 'grid', gap: 10 }}>
      {candidates.map((candidate) => {
        const review = reviewById.get(candidate.id);
        return <article key={candidate.id} style={{ border: '1px solid #e1e6ec', borderRadius: 8, padding: 12, background: '#fff' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr auto', gap: 10, alignItems: 'center' }}>
            <Chip size="small" color={candidate.semantic === 'door' ? 'primary' : 'default'} label={candidate.semantic} />
            <div><strong>{candidate.layer}</strong><div style={{ color: '#667085', fontSize: 13, marginTop: 4 }}>인접 공간 후보 {candidate.nearbyRoomIds.length}개 · tolerance {candidate.toleranceDrawingUnits.toFixed(3)} drawing units</div></div>
            <Chip size="small" color={review?.decision === 'approved' ? 'success' : review?.decision === 'rejected' ? 'error' : review?.decision === 'held' ? 'warning' : 'default'} label={review?.decision || '미검토'} />
          </div>
          <TextField fullWidth size="small" label="검토 메모" sx={{ mt: 1 }} value={notes[candidate.id] ?? review?.note ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [candidate.id]: event.target.value }))} placeholder="실제 연결 공간, 위치 확인 내용" />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 10 }}><Button size="small" disabled={busy === candidate.id} onClick={() => void act(candidate, 'held')}>보류</Button><Button size="small" color="error" disabled={busy === candidate.id} onClick={() => void act(candidate, 'rejected')}>거절</Button><Button size="small" variant="contained" color="success" disabled={busy === candidate.id} onClick={() => void act(candidate, 'approved')}>연결 승인</Button></div>
        </article>;
      })}
    </div>
  </section>;
}
