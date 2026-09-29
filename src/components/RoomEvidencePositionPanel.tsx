import { CameraAltRounded, Inventory2Rounded, PlaceRounded } from '@mui/icons-material';
import { Alert, Button, Chip, FormControl, InputLabel, MenuItem, Select, TextField } from '@mui/material';
import { useMemo, useState } from 'react';
import type { PropertyFacility, PropertyMedia, RoomEvidenceAnchor, RoomEvidencePosition } from '../domain/propertyDataRoom/types';
import { roomEvidencePositionService } from '../services/roomEvidencePositionService';
import type { RoomIntelligenceView } from '../services/roomIntelligenceService';

function RoomPlanPicker({ points, x, y, onPick }: { points: Array<{ x: number; y: number }>; x: number; y: number; onPick: (x: number, y: number) => void; }) {
  const bounds = useMemo(() => {
    const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
    return { minX: Math.min(...xs), minY: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs) || 1, height: Math.max(...ys) - Math.min(...ys) || 1 };
  }, [points]);
  const polygon = points.map((p) => `${20 + ((p.x - bounds.minX) / bounds.width) * 260},${220 - ((p.y - bounds.minY) / bounds.height) * 190}`).join(' ');
  return <svg viewBox="0 0 300 240" style={{ width: '100%', height: 240, background: '#f7f9fc', borderRadius: 10, cursor: 'crosshair' }} onClick={(event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    const nx = Math.max(0, Math.min(1, (px * 300 - 20) / 260));
    const ny = Math.max(0, Math.min(1, (220 - py * 240) / 190));
    onPick(nx, ny);
  }}>
    <polygon points={polygon} fill="#eef3f8" stroke="#1f3b5b" strokeWidth="2" />
    <circle cx={20 + x * 260} cy={220 - y * 190} r="8" fill="#fff" stroke="#c9861a" strokeWidth="3" />
    <text x="16" y="20" fontSize="11" fill="#667085">Click reviewed room plan to set XY</text>
  </svg>;
}

export default function RoomEvidencePositionPanel({ view, positions, onSaved }: { view: RoomIntelligenceView; positions: RoomEvidencePosition[]; onSaved: () => void | Promise<void>; }) {
  const resources = useMemo(() => [
    ...view.media.map((item: PropertyMedia) => ({ type: 'media' as const, id: item.id, label: item.caption || item.fileName })),
    ...view.facilities.map((item: PropertyFacility) => ({ type: 'facility' as const, id: item.id, label: item.name })),
  ], [view.media, view.facilities]);
  const [resourceKey, setResourceKey] = useState(resources[0] ? `${resources[0].type}:${resources[0].id}` : '');
  const selected = resources.find((item) => `${item.type}:${item.id}` === resourceKey) || resources[0];
  const existing = selected ? positions.find((item) => item.spaceId === view.space.id && item.roomCandidateId === view.room.roomCandidate.id && item.resourceType === selected.type && item.resourceId === selected.id) : undefined;
  const [x, setX] = useState(existing?.normalizedX ?? .5); const [y, setY] = useState(existing?.normalizedY ?? .5); const [z, setZ] = useState(existing?.normalizedZ ?? .35);
  const [anchor, setAnchor] = useState<RoomEvidenceAnchor>(existing?.anchor ?? 'wall'); const [note, setNote] = useState(existing?.note ?? '');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');

  const save = async (decision: 'approved' | 'held' | 'rejected') => {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      await roomEvidencePositionService.save({ propertyId: view.space.propertyId, spaceId: view.space.id, digitalTwinAssetId: view.room.assetId, roomCandidateId: view.room.roomCandidate.id, resourceType: selected.type, resourceId: selected.id, normalizedX: x, normalizedY: y, normalizedZ: z, anchor, decision, note, roomPoints: view.room.roomCandidate.points });
      await onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Evidence 위치를 저장하지 못했습니다.'); }
    finally { setBusy(false); }
  };

  return <div style={{ border: '1px solid #e3e8ef', borderRadius: 10, padding: 14 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><div><strong><PlaceRounded fontSize="small" sx={{ verticalAlign: 'middle', mr: .6 }} />Room Evidence Position Human Review</strong><small style={{ display: 'block', color: '#667085', marginTop: 4 }}>사진 촬영점·설비 위치를 reviewed room boundary 안에서 직접 지정합니다.</small></div><Chip size="small" variant="outlined" label={`승인 위치 ${positions.filter((item) => item.spaceId === view.space.id && item.roomCandidateId === view.room.roomCandidate.id && item.decision === 'approved').length}`} /></div>
    {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
    {!resources.length ? <Alert severity="info" sx={{ mt: 1.2 }}>이 방에 직접 연결된 사진 또는 설비가 없습니다.</Alert> : <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px,1fr) minmax(260px,1fr)', gap: 14, marginTop: 12 }}>
      <div><RoomPlanPicker points={view.room.roomCandidate.points} x={x} y={y} onPick={(nx, ny) => { setX(nx); setY(ny); }} /></div>
      <div style={{ display: 'grid', gap: 10 }}>
        <FormControl size="small"><InputLabel id="evidence-resource-label">대상 증거</InputLabel><Select labelId="evidence-resource-label" label="대상 증거" value={selected ? `${selected.type}:${selected.id}` : ''} onChange={(event) => { const value = event.target.value; setResourceKey(value); const [type, id] = value.split(':'); const prev = positions.find((item) => item.resourceType === type && item.resourceId === id && item.roomCandidateId === view.room.roomCandidate.id); setX(prev?.normalizedX ?? .5); setY(prev?.normalizedY ?? .5); setZ(prev?.normalizedZ ?? .35); setAnchor(prev?.anchor ?? 'wall'); setNote(prev?.note ?? ''); }}>{resources.map((item) => <MenuItem key={`${item.type}:${item.id}`} value={`${item.type}:${item.id}`}>{item.type === 'media' ? <CameraAltRounded fontSize="small" /> : <Inventory2Rounded fontSize="small" />} &nbsp;{item.label}</MenuItem>)}</Select></FormControl>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}><TextField size="small" label="X %" type="number" value={Math.round(x * 100)} onChange={(e) => setX(Math.max(0, Math.min(1, Number(e.target.value) / 100)))} /><TextField size="small" label="Y %" type="number" value={Math.round(y * 100)} onChange={(e) => setY(Math.max(0, Math.min(1, Number(e.target.value) / 100)))} /><TextField size="small" label="Z %" type="number" value={Math.round(z * 100)} onChange={(e) => setZ(Math.max(0, Math.min(1, Number(e.target.value) / 100)))} /></div>
        <FormControl size="small"><InputLabel id="evidence-anchor-label">Anchor</InputLabel><Select labelId="evidence-anchor-label" label="Anchor" value={anchor} onChange={(event) => setAnchor(event.target.value as RoomEvidenceAnchor)}>{['floor','wall','ceiling','free'].map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select></FormControl>
        <TextField size="small" label="검토 메모" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} />
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}><Button size="small" variant="contained" color="success" disabled={busy} onClick={() => void save('approved')}>위치 승인</Button><Button size="small" disabled={busy} onClick={() => void save('held')}>보류</Button><Button size="small" color="inherit" disabled={busy} onClick={() => void save('rejected')}>거절</Button></div>
      </div>
    </div>}
    <Alert severity="warning" sx={{ mt: 1.2 }}>좌표는 해당 reviewed room의 로컬 정규화 좌표입니다. 실제 측량좌표·BIM 좌표계·시공 기준점으로 자동 승격하지 않습니다.</Alert>
  </div>;
}
