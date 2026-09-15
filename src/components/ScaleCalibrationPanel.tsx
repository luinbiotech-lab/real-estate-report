import { useMemo, useState } from 'react';
import { Alert, Button, Chip, TextField } from '@mui/material';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { measurementCalibrationService, readScaleCalibration } from '../services/measurementCalibrationService';

type GeometryBounds = { width?: number; height?: number };

export default function ScaleCalibrationPanel({ asset, onSaved }: { asset: DigitalTwinAsset; onSaved?: () => void | Promise<void> }) {
  const current = readScaleCalibration(asset);
  const [drawingLength, setDrawingLength] = useState(current ? String(current.drawingLength) : '');
  const [realLengthM, setRealLengthM] = useState(current ? String(current.realLengthM) : '');
  const [referenceLabel, setReferenceLabel] = useState(current?.referenceLabel || '도면 기지치수');
  const [note, setNote] = useState(current?.note || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const geometry = asset.metadata.geometry && typeof asset.metadata.geometry === 'object' ? asset.metadata.geometry as Record<string, unknown> : undefined;
  const bounds = geometry?.bounds && typeof geometry.bounds === 'object' ? geometry.bounds as GeometryBounds : undefined;
  const preview = useMemo(() => {
    const drawing = Number(drawingLength); const real = Number(realLengthM);
    if (!(drawing > 0) || !(real > 0)) return undefined;
    const scale = real / drawing;
    return {
      scale,
      widthM: typeof bounds?.width === 'number' ? bounds.width * scale : undefined,
      heightM: typeof bounds?.height === 'number' ? bounds.height * scale : undefined,
    };
  }, [drawingLength, realLengthM, bounds?.width, bounds?.height]);

  const save = async () => {
    setSaving(true); setError('');
    try {
      await measurementCalibrationService.save(asset, {
        drawingLength: Number(drawingLength), realLengthM: Number(realLengthM), referenceLabel, note,
      });
      await onSaved?.();
    } catch (reason) { setError(reason instanceof Error ? reason.message : '축척 기준을 저장하지 못했습니다.'); }
    finally { setSaving(false); }
  };

  return <section style={{ border: '1px solid #d9e0e8', borderRadius: 10, padding: 14, background: '#fbfcfe' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}>
      <div><strong>Scale Calibration / 치수 기준 확인</strong><p style={{ margin: '4px 0 0', color: '#667085', fontSize: 13 }}>도면에 표기된 기지치수 또는 실측값 1개를 사람이 확인해 입력합니다. 자동 추정값만으로 축척을 확정하지 않습니다.</p></div>
      <Chip size="small" color={current ? 'success' : 'default'} variant={current ? 'filled' : 'outlined'} label={current ? '축척 검증됨' : '축척 미검증'} />
    </div>
    {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(180px,1fr))', gap: 10 }}>
      <TextField size="small" label="도면상 기준 길이" value={drawingLength} onChange={(event) => setDrawingLength(event.target.value)} inputMode="decimal" helperText="DXF 좌표 단위 기준" />
      <TextField size="small" label="실제 기준 길이(m)" value={realLengthM} onChange={(event) => setRealLengthM(event.target.value)} inputMode="decimal" helperText="도면 표기치수·실측값" />
      <TextField size="small" label="기준 근거" value={referenceLabel} onChange={(event) => setReferenceLabel(event.target.value)} placeholder="예: 1층 전면 폭 7.2m" />
      <TextField size="small" label="검토 메모" value={note} onChange={(event) => setNote(event.target.value)} placeholder="근거 위치 또는 확인 방법" />
    </div>
    {preview && <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: '#f1f5f9', color: '#475467', fontSize: 13 }}>
      <strong>검증 전 미리보기</strong> · 1 drawing unit = {preview.scale.toFixed(6)}m
      {preview.widthM != null && preview.heightM != null ? ` · 전체 geometry bounds 약 ${preview.widthM.toFixed(2)}m × ${preview.heightM.toFixed(2)}m` : ''}
      <div style={{ marginTop: 4 }}>※ bounds는 도면 전체 외곽 범위이며 건축면적·전용면적을 의미하지 않습니다.</div>
    </div>}
    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}><Button variant="contained" onClick={() => void save()} disabled={saving}>{saving ? '저장 중' : '확인한 축척 저장'}</Button></div>
  </section>;
}
