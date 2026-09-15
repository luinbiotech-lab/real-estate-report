import { HistoryRounded } from '@mui/icons-material';
import { Alert, Button, Chip, MenuItem, Select, TextField } from '@mui/material';
import { useMemo, useState } from 'react';
import type { RoomConditionHistoryEntry, RoomConditionRating, RoomRenovationHistoryEntry } from '../domain/propertyDataRoom/types';
import { roomHistoryService } from '../services/roomHistoryService';
import type { RoomIntelligenceView } from '../services/roomIntelligenceService';

export default function RoomHistoryPanel({ view, conditionHistory, renovationHistory, onSaved }: { view: RoomIntelligenceView; conditionHistory: RoomConditionHistoryEntry[]; renovationHistory: RoomRenovationHistoryEntry[]; onSaved: () => void | Promise<void>; }) {
  const [rating, setRating] = useState<RoomConditionRating>('unknown');
  const [summary, setSummary] = useState(view.space.currentCondition || '');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const roomConditions = useMemo(() => conditionHistory.filter((item) => item.spaceId === view.space.id && item.roomCandidateId === view.room.roomCandidate.id).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)), [conditionHistory, view]);
  const roomRenovations = useMemo(() => renovationHistory.filter((item) => item.spaceId === view.space.id && item.roomCandidateId === view.room.roomCandidate.id).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)), [renovationHistory, view]);
  const save = async () => {
    setBusy(true); setError('');
    try {
      await roomHistoryService.addCondition({ propertyId: view.space.propertyId, spaceId: view.space.id, digitalTwinAssetId: view.room.assetId, roomCandidateId: view.room.roomCandidate.id, rating, summary, evidenceRefs: [view.link.id, ...view.media.map((item) => item.id), ...view.facilities.map((item) => item.id)] });
      setSummary(''); await onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : '상태 이력을 저장하지 못했습니다.'); }
    finally { setBusy(false); }
  };
  return <div style={{ border: '1px solid #e3e8ef', borderRadius: 10, padding: 14 }}>
    <div><strong><HistoryRounded fontSize="small" sx={{ verticalAlign: 'middle', mr: .6 }} />Room Status / Renovation History</strong><small style={{ display: 'block', color: '#667085', marginTop: 4 }}>상태 변화와 리노베이션 검토 변경을 시간순으로 보존합니다.</small></div>
    {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr auto', gap: 8, marginTop: 12 }}>
      <Select size="small" value={rating} onChange={(e) => setRating(e.target.value as RoomConditionRating)}>{['unknown','good','fair','poor'].map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select>
      <TextField size="small" label="상태 기록" value={summary} onChange={(e) => setSummary(e.target.value)} />
      <Button variant="contained" size="small" disabled={busy} onClick={() => void save()}>이력 추가</Button>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
      <div><small style={{ color: '#667085' }}>Condition history</small><div style={{ display: 'grid', gap: 7, marginTop: 7 }}>{roomConditions.slice(0, 8).map((item) => <div key={item.id} style={{ padding: 9, background: '#f7f9fb', borderRadius: 8 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><Chip size="small" label={item.rating} /><small>{new Date(item.recordedAt).toLocaleString()}</small></div><p style={{ margin: '6px 0 0', color: '#475467' }}>{item.summary}</p></div>)}{!roomConditions.length && <Alert severity="info">상태 이력이 없습니다.</Alert>}</div></div>
      <div><small style={{ color: '#667085' }}>Renovation history</small><div style={{ display: 'grid', gap: 7, marginTop: 7 }}>{roomRenovations.slice(0, 8).map((item) => <div key={item.id} style={{ padding: 9, background: '#f7f9fb', borderRadius: 8 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><Chip size="small" label={item.action} /><small>{new Date(item.recordedAt).toLocaleString()}</small></div><p style={{ margin: '6px 0 0', color: '#475467' }}>{item.scope} · {item.summary}</p></div>)}{!roomRenovations.length && <Alert severity="info">리노베이션 변경 이력이 없습니다.</Alert>}</div></div>
    </div>
  </div>;
}
