import { Alert, Button, Chip, TextField } from '@mui/material';
import { useState } from 'react';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { floorPlacementService } from '../services/floorPlacementService';

export default function FloorPlacementPanel({ asset, onSaved }: { asset: DigitalTwinAsset; onSaved?: () => void | Promise<void> }) {
  const current = floorPlacementService.read(asset);
  const [floorLabel, setFloorLabel] = useState(current?.floorLabel || asset.floor || '');
  const [elevationM, setElevationM] = useState(current ? String(current.elevationM) : '');
  const [slabThicknessM, setSlabThicknessM] = useState(current ? String(current.slabThicknessM) : '');
  const [sourceLabel, setSourceLabel] = useState(current?.sourceLabel || '도면/현장 확인 층 기준고');
  const [note, setNote] = useState(current?.note || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true); setError('');
    try {
      await floorPlacementService.save(asset, { floorLabel, elevationM: Number(elevationM), slabThicknessM: Number(slabThicknessM), sourceLabel, note });
      await onSaved?.();
    } catch (reason) { setError(reason instanceof Error ? reason.message : '층 배치 정보를 저장하지 못했습니다.'); }
    finally { setSaving(false); }
  };

  return <section style={{ border: '1px solid #d9e0e8', borderRadius: 10, padding: 14, background: '#fbfcfe' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}>
      <div><strong>Floor Stack / 층 배치·슬래브</strong><p style={{ margin: '4px 0 0', color: '#667085', fontSize: 13 }}>다층 Building Model에 사용할 층 기준고(Z)와 슬래브 두께를 사람이 확인해 저장합니다.</p></div>
      <Chip size="small" color={current ? 'success' : 'default'} variant={current ? 'filled' : 'outlined'} label={current ? '층 배치 검증됨' : '층 배치 미검증'} />
    </div>
    {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(180px,1fr))', gap: 10 }}>
      <TextField size="small" label="층 표기" value={floorLabel} onChange={(event) => setFloorLabel(event.target.value)} placeholder="예: B1, 1F, 2F" />
      <TextField size="small" label="층 기준고 Z(m)" type="number" value={elevationM} onChange={(event) => setElevationM(event.target.value)} helperText="예: B1 -3.2 / 1F 0 / 2F 3.4" />
      <TextField size="small" label="슬래브 두께(m)" type="number" value={slabThicknessM} onChange={(event) => setSlabThicknessM(event.target.value)} helperText="구조도·현장 확인값만 입력" />
      <TextField size="small" label="확인 근거" value={sourceLabel} onChange={(event) => setSourceLabel(event.target.value)} />
      <TextField size="small" label="검토 메모" value={note} onChange={(event) => setNote(event.target.value)} sx={{ gridColumn: '1 / -1' }} />
    </div>
    <Alert severity="warning" sx={{ mt: 1.5 }}>층 기준고와 슬래브 두께는 자동 추정하지 않습니다. 구조도·실측·전문가 확인 전에는 층간 구조체 정합성을 확정하지 않습니다.</Alert>
    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}><Button variant="contained" disabled={saving} onClick={() => void save()}>{saving ? '저장 중' : '확인한 층 배치 저장'}</Button></div>
  </section>;
}
