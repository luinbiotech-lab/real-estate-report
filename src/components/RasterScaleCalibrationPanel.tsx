import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Alert, Box, Button, Chip, TextField } from '@mui/material';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { measurementCalibrationService, readScaleCalibration } from '../services/measurementCalibrationService';

type Point = { x: number; y: number };

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export default function RasterScaleCalibrationPanel({
  asset,
  onSaved,
}: {
  asset: DigitalTwinAsset;
  onSaved?: () => void | Promise<void>;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [start, setStart] = useState<Point | null>(null);
  const [end, setEnd] = useState<Point | null>(null);
  const [realLengthM, setRealLengthM] = useState('');
  const [referenceLabel, setReferenceLabel] = useState('도면 표기 치수');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const raster = asset.metadata.raster && typeof asset.metadata.raster === 'object'
    ? asset.metadata.raster as Record<string, unknown>
    : undefined;
  const widthPx = Number(raster?.widthPx);
  const heightPx = Number(raster?.heightPx);
  const current = readScaleCalibration(asset);

  useEffect(() => {
    if (asset.fileUrl) {
      setImageUrl(asset.fileUrl);
      return;
    }
    if (!(asset.fileData instanceof Blob)) {
      setImageUrl('');
      return;
    }
    const url = URL.createObjectURL(asset.fileData);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [asset.fileData, asset.fileUrl]);

  const pointFromEvent = (event: MouseEvent<HTMLDivElement>) => {
    const box = hostRef.current?.getBoundingClientRect();
    if (!box) return undefined;
    return {
      x: clamp01((event.clientX - box.left) / box.width),
      y: clamp01((event.clientY - box.top) / box.height),
    };
  };

  const pixelLength = useMemo(() => {
    if (!start || !end || !(widthPx > 0) || !(heightPx > 0)) return 0;
    const dx = (end.x - start.x) * widthPx;
    const dy = (end.y - start.y) * heightPx;
    return Math.hypot(dx, dy);
  }, [end, heightPx, start, widthPx]);

  const metersPerPixel = useMemo(() => {
    const real = Number(realLengthM);
    if (!(pixelLength > 0) || !(real > 0)) return undefined;
    return real / pixelLength;
  }, [pixelLength, realLengthM]);

  if (!raster) return null;

  const mouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (!imageUrl || saving) return;
    const point = pointFromEvent(event);
    if (!point) return;
    setStart(point);
    setEnd(point);
    setError('');
    setMessage('');
  };

  const mouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (!start) return;
    const point = pointFromEvent(event);
    if (point) setEnd(point);
  };

  const mouseUp = (event: MouseEvent<HTMLDivElement>) => {
    if (!start) return;
    const point = pointFromEvent(event);
    if (point) setEnd(point);
    setStart((value) => value);
  };

  const save = async () => {
    const real = Number(realLengthM);
    if (!(pixelLength > 1)) {
      setError('도면 위에서 기준 치수의 양 끝점을 드래그하세요.');
      return;
    }
    if (!(real > 0)) {
      setError('실제 기준 길이(m)를 입력하세요.');
      return;
    }
    setSaving(true); setError(''); setMessage('');
    try {
      await measurementCalibrationService.save(asset, {
        drawingLength: pixelLength,
        realLengthM: real,
        referenceLabel,
        note: [note.trim(), 'Raster pixel-distance calibration'].filter(Boolean).join(' · '),
      });
      setMessage('Raster 축척을 검증 상태로 저장했습니다.');
      await onSaved?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Raster 축척을 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return <section style={{ border: '1px solid #d9e0e8', borderRadius: 10, padding: 14, background: '#fbfcfe', marginTop: 18 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}>
      <div>
        <strong>Raster Scale Calibration / 두 점 축척 확인</strong>
        <p style={{ margin: '4px 0 0', color: '#667085', fontSize: 13 }}>도면에 표기된 기지치수의 양 끝점을 드래그하고 실제 길이를 입력합니다. 픽셀 거리만 자동 계산하며 실제 길이는 사람이 확인합니다.</p>
      </div>
      <Chip size="small" color={current ? 'success' : 'default'} label={current ? '축척 검증됨' : '축척 미검증'} />
    </div>

    {error && <Alert severity="error" sx={{ mb: 1.25 }}>{error}</Alert>}
    {message && <Alert severity="success" sx={{ mb: 1.25 }}>{message}</Alert>}
    <Alert severity="warning" sx={{ mb: 1.25 }}>축척이 검증되어도 수동 공간 박스의 면적은 추정값입니다. 법정면적·전용면적·구조치수를 확정하지 않습니다.</Alert>

    {imageUrl ? <Box
      ref={hostRef}
      onMouseDown={mouseDown}
      onMouseMove={mouseMove}
      onMouseUp={mouseUp}
      sx={{ position: 'relative', userSelect: 'none', cursor: 'crosshair', border: '1px solid #cdd5df', borderRadius: 1.5, overflow: 'hidden', bgcolor: '#fff' }}
    >
      <img src={imageUrl} alt={(asset.fileName || 'floor plan') + ' scale calibration'} draggable={false} style={{ width: '100%', display: 'block' }} />
      {start && end && <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        <line x1={start.x * 1000} y1={start.y * 1000} x2={end.x * 1000} y2={end.y * 1000} stroke="currentColor" strokeWidth="5" vectorEffect="non-scaling-stroke" />
        <circle cx={start.x * 1000} cy={start.y * 1000} r="8" fill="currentColor" vectorEffect="non-scaling-stroke" />
        <circle cx={end.x * 1000} cy={end.y * 1000} r="8" fill="currentColor" vectorEffect="non-scaling-stroke" />
      </svg>}
    </Box> : <Alert severity="info">원본 raster binary 또는 file URL을 불러올 수 없어 두 점 축척 보정을 사용할 수 없습니다.</Alert>}

    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1.3fr 1.3fr auto' }, gap: 1, mt: 1.5, alignItems: 'center' }}>
      <TextField size="small" label="선택 픽셀 거리" value={pixelLength ? pixelLength.toFixed(2) : ''} InputProps={{ readOnly: true }} />
      <TextField size="small" label="실제 길이(m)" value={realLengthM} onChange={(event) => setRealLengthM(event.target.value)} inputMode="decimal" />
      <TextField size="small" label="기준 근거" value={referenceLabel} onChange={(event) => setReferenceLabel(event.target.value)} placeholder="예: 도면 표기 4,200mm" />
      <TextField size="small" label="메모" value={note} onChange={(event) => setNote(event.target.value)} placeholder="확인 위치/출처" />
      <Button variant="contained" disabled={!imageUrl || !(pixelLength > 1) || !(Number(realLengthM) > 0) || saving} onClick={() => void save()}>축척 저장</Button>
    </Box>

    {metersPerPixel != null && <Box sx={{ mt: 1, p: 1, bgcolor: '#f1f5f9', borderRadius: 1, color: '#475467', fontSize: 13 }}>
      미리보기 · 1px = {metersPerPixel.toFixed(6)}m · 원본 이미지 약 {(widthPx * metersPerPixel).toFixed(2)}m × {(heightPx * metersPerPixel).toFixed(2)}m 범위
    </Box>}
    {current && <Box sx={{ mt: 1, color: '#475467', fontSize: 13 }}>
      저장값 · 1px = {current.metersPerDrawingUnit.toFixed(6)}m · {current.referenceLabel}
    </Box>}
  </section>;
}
