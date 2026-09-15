import { useMemo, useState } from 'react';
import { Alert, Button, Chip, TextField } from '@mui/material';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { readRoomTopologyReviews, roomTopologyService, type RoomBoundaryCandidate } from '../services/roomTopologyService';

export default function RoomTopologyPanel({ asset, onSaved }: { asset: DigitalTwinAsset; onSaved?: () => void | Promise<void> }) {
  const candidates = useMemo(() => roomTopologyService.buildCandidates(asset), [asset]);
  const reviews = useMemo(() => readRoomTopologyReviews(asset), [asset]);
  const reviewById = useMemo(() => new Map(reviews.map((item) => [item.candidateId, item])), [reviews]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const act = async (candidate: RoomBoundaryCandidate, decision: 'approved' | 'held' | 'rejected') => {
    setBusy(candidate.id); setError('');
    try {
      await roomTopologyService.review(asset, candidate, decision, names[candidate.id] || reviewById.get(candidate.id)?.name || '', notes[candidate.id] || reviewById.get(candidate.id)?.note || '');
      await onSaved?.();
    } catch (reason) { setError(reason instanceof Error ? reason.message : '공간 경계 검토를 저장하지 못했습니다.'); }
    finally { setBusy(''); }
  };

  const approved = reviews.filter((item) => item.decision === 'approved').length;
  return <section style={{ border: '1px solid #d9e0e8', borderRadius: 10, padding: 14, background: '#fbfcfe' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}>
      <div><strong>Room Topology / 공간 경계 후보</strong><p style={{ margin: '4px 0 0', color: '#667085', fontSize: 13 }}>폐합 DXF 폴리라인만 공간 후보로 제시합니다. 자동으로 방·실 면적을 확정하지 않습니다.</p></div>
      <div style={{ display: 'flex', gap: 6 }}><Chip size="small" label={`후보 ${candidates.length}`} /><Chip size="small" color={approved ? 'success' : 'default'} label={`승인 ${approved}`} /></div>
    </div>
    <Alert severity="warning" sx={{ mb: 1.5 }}>벽 중심선, 샤프트, 가구 외곽선 등도 폐합 폴리라인일 수 있습니다. 이름·용도·경계는 사람이 확인해야 하며 면적값도 승인 전에는 후보값입니다.</Alert>
    {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
    {!candidates.length && <div style={{ padding: 18, textAlign: 'center', color: '#7b8794' }}>폐합 폴리라인 기반 공간 후보가 없습니다.</div>}
    <div style={{ display: 'grid', gap: 10 }}>
      {candidates.map((candidate) => {
        const review = reviewById.get(candidate.id);
        return <article key={candidate.id} style={{ border: '1px solid #e1e6ec', borderRadius: 8, padding: 12, background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div><strong>{candidate.layer || 'layer 미지정'}</strong><div style={{ color: '#667085', fontSize: 13, marginTop: 4 }}>drawing area {candidate.drawingArea.toFixed(2)}{candidate.areaSqmCandidate != null ? ` · 약 ${candidate.areaSqmCandidate.toFixed(2)}㎡ 후보` : ' · 실제 면적 미산정'}{candidate.perimeterMCandidate != null ? ` · 둘레 약 ${candidate.perimeterMCandidate.toFixed(2)}m 후보` : ''}</div></div>
            <Chip size="small" color={review?.decision === 'approved' ? 'success' : review?.decision === 'rejected' ? 'error' : review?.decision === 'held' ? 'warning' : 'default'} label={review?.decision || '미검토'} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
            <TextField size="small" label="공간명(선택)" value={names[candidate.id] ?? review?.name ?? ''} onChange={(event) => setNames((current) => ({ ...current, [candidate.id]: event.target.value }))} placeholder="예: 1층 사무실" />
            <TextField size="small" label="검토 메모" value={notes[candidate.id] ?? review?.note ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [candidate.id]: event.target.value }))} placeholder="경계 근거·제외 사유" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 10 }}>
            <Button size="small" disabled={busy === candidate.id} onClick={() => void act(candidate, 'held')}>보류</Button>
            <Button size="small" color="error" disabled={busy === candidate.id} onClick={() => void act(candidate, 'rejected')}>거절</Button>
            <Button size="small" variant="contained" color="success" disabled={busy === candidate.id} onClick={() => void act(candidate, 'approved')}>경계 승인</Button>
          </div>
        </article>;
      })}
    </div>
  </section>;
}
