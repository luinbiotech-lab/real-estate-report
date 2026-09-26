import { useState } from 'react';
import { Alert, Button, Chip, TextField } from '@mui/material';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { readVerticalDimensions, verticalDimensionService } from '../services/verticalDimensionService';

export default function VerticalDimensionPanel({ asset, onSaved }: { asset: DigitalTwinAsset; onSaved?: () => void | Promise<void> }) {
  const current = readVerticalDimensions(asset);
  const [floorHeightM, setFloorHeightM] = useState(current?.floorHeightM ? String(current.floorHeightM) : '');
  const [ceilingHeightM, setCeilingHeightM] = useState(current?.ceilingHeightM ? String(current.ceilingHeightM) : '');
  const [sourceLabel, setSourceLabel] = useState(current?.sourceLabel || '도면/현장 확인 높이');
  const [note, setNote] = useState(current?.note || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true); setError('');
    try {
      await verticalDimensionService.save(asset, {
        floorHeightM: floorHeightM.trim() ? Number(floorHeightM) : undefined,
        ceilingHeightM: ceilingHeightM.trim() ? Number(ceilingHeightM) : undefined,
        sourceLabel,
        note,
      });
      await onSaved?.();
    } catch (reason) { setError(reason instanceof Error ? reason.message : '높이 기준을 저장하지 못했습니다.'); }
    finally { setSaving(false); }
  };

  return <section style={{ border: '1px solid #d9e0e8', borderRadius: 10, padding: 14, background: '#fbfcfe' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}>
      <div><strong>Vertical Dimension / 3D 높이 기준</strong><p style={{ margin: '4px 0 0', color: '#667085', fontSize: 13 }}>층고·천장고는 자동 추정하지 않고 도면 또는 현장 확인값만 저장합니다.</p></div>
      <Chip size="small" color={current ? 'success' : 'default'} variant={current ? 'filled' : 'outlined'} label={current ? '높이 검증됨' : '높이 미검증'} />
    </div>
    {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(180px,1fr))', gap: 10 }}>
      <TextField size="small" label="층고(m)" value={floorHeightM} onChange={(event) => setFloorHeightM(event.target.value)} inputMode="decimal" helperText="바닥~상부 구조 기준" />
      <TextField size="small" label="천장고(m)" value={ceilingHeightM} onChange={(event) => setCeilingHeightM(event.target.value)} inputMode="decimal" helperText="실내 마감 천장 기준" />
      <TextField size="small" label="확인 근거" value={sourceLabel} onChange={(event) => setSourceLabel(event.target.value)} placeholder="예: 1층 실측 2.65m" />
      <TextField size="small" label="검토 메모" value={note} onChange={(event) => setNote(event.target.value)} placeholder="도면 페이지·실측 위치" />
    </div>
    <Alert severity="info" sx={{ mt: 1.5 }}>검증된 공간 경계 + 축척 + 높이가 모두 있어야 extrusion 후보를 만들 수 있습니다. 구조체·슬래브·천장 구성은 별도 검토 대상입니다.</Alert>
    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}><Button variant="contained" onClick={() => void save()} disabled={saving}>{saving ? '저장 중' : '확인한 높이 저장'}</Button></div>
  </section>;
}
