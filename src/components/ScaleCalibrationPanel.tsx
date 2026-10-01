import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { Alert, Button, Chip, TextField } from '@mui/material';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { measurementCalibrationService, readScaleCalibration } from '../services/measurementCalibrationService';

type PreviewPoint = { x: number; y: number };
type PreviewSegment = { points?: PreviewPoint[] };
type GeometryBounds = { minX?: number; minY?: number; maxX?: number; maxY?: number; width?: number; height?: number };
type GeometryMetadata = { bounds?: GeometryBounds; previewSegments?: PreviewSegment[] };

function normalizedPoints(points: PreviewPoint[], bounds: GeometryBounds) {
  const minX = Number(bounds.minX ?? 0);
  const maxY = Number(bounds.maxY ?? 0);
  const width = Math.max(1e-6, Number(bounds.width ?? 1));
  const height = Math.max(1e-6, Number(bounds.height ?? 1));
  return points.map((point) => ({ x: ((point.x - minX) / width) * 1000, y: ((maxY - point.y) / height) * 700 }));
}

export default function ScaleCalibrationPanel({ asset, onSaved }: { asset: DigitalTwinAsset; onSaved?: () => void | Promise<void> }) {
  const current = readScaleCalibration(asset);
  const [drawingLength, setDrawingLength] = useState(current ? String(current.drawingLength) : '');
  const [realLengthM, setRealLengthM] = useState(current ? String(current.realLengthM) : '');
  const [referenceLabel, setReferenceLabel] = useState(current?.referenceLabel || '도면 기지치수');
  const [note, setNote] = useState(current?.note || '');
  const [pickedPoints, setPickedPoints] = useState<PreviewPoint[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const geometry = asset.metadata.geometry && typeof asset.metadata.geometry === 'object' ? asset.metadata.geometry as GeometryMetadata : undefined;
  const bounds = geometry?.bounds;
  const segments = Array.isArray(geometry?.previewSegments) ? geometry.previewSegments.filter((segment) => Array.isArray(segment.points) && segment.points.length > 1) : [];

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

  const pick = (event: MouseEvent<SVGSVGElement>) => {
    if (!bounds) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!(rect.width > 0) || !(rect.height > 0)) return;
    const viewX = ((event.clientX - rect.left) / rect.width) * 1000;
    const viewY = ((event.clientY - rect.top) / rect.height) * 700;
    const minX = Number(bounds.minX ?? 0);
    const maxY = Number(bounds.maxY ?? 0);
    const width = Math.max(1e-6, Number(bounds.width ?? 1));
    const height = Math.max(1e-6, Number(bounds.height ?? 1));
    const point = { x: minX + (viewX / 1000) * width, y: maxY - (viewY / 700) * height };
    setPickedPoints((currentPoints) => currentPoints.length >= 2 ? [point] : [...currentPoints, point]);
  };

  useEffect(() => {
    if (pickedPoints.length !== 2) return;
    const length = Math.hypot(pickedPoints[1].x - pickedPoints[0].x, pickedPoints[1].y - pickedPoints[0].y);
    setDrawingLength(length > 0 ? length.toFixed(6) : '');
  }, [pickedPoints]);

  const resetPickedPoints = () => {
    setPickedPoints([]);
    setDrawingLength(current ? String(current.drawingLength) : '');
  };

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
      <div><strong>Scale Calibration / 치수 기준 확인</strong><p style={{ margin: '4px 0 0', color: '#667085', fontSize: 13 }}>도면 위 기준선의 시작점과 끝점을 직접 찍고, 실제 표기치수 또는 실측값을 사람이 확인해 입력합니다. 자동 추정값만으로 축척을 확정하지 않습니다.</p></div>
      <Chip size="small" color={current ? 'success' : 'default'} variant={current ? 'filled' : 'outlined'} label={current ? '축척 검증됨' : '축척 미검증'} />
    </div>

    {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}

    {bounds && segments.length > 0 && <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 7 }}>
        <strong style={{ fontSize: 13 }}>기준선 두 점 지정</strong>
        <Button size="small" onClick={resetPickedPoints}>선택 초기화</Button>
      </div>
      <svg
        viewBox="0 0 1000 700"
        role="img"
        aria-label="축척 기준선 선택 도면"
        onClick={pick}
        style={{ width: '100%', minHeight: 280, maxHeight: 460, background: '#fff', border: '1px solid #d9e0e8', borderRadius: 8, cursor: 'crosshair' }}
      >
        {segments.map((segment, index) => {
          const points = normalizedPoints(segment.points ?? [], bounds).map((point) => `${point.x},${point.y}`).join(' ');
          return <polyline key={index} points={points} fill="none" stroke="#8b98a7" strokeWidth="0.8" opacity="0.55" vectorEffect="non-scaling-stroke" />;
        })}
        {pickedPoints.map((point, index) => {
          const [viewPoint] = normalizedPoints([point], bounds);
          return <g key={index}><circle cx={viewPoint.x} cy={viewPoint.y} r="8" fill={index === 0 ? '#0f5f9a' : '#c18a2f'} stroke="#fff" strokeWidth="3" /><text x={viewPoint.x + 12} y={viewPoint.y - 10} fontSize="18" fontWeight="700" fill="#18314f">{index === 0 ? 'START' : 'END'}</text></g>;
        })}
        {pickedPoints.length === 2 && (() => {
          const [a, b] = normalizedPoints(pickedPoints, bounds);
          return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#c18a2f" strokeWidth="3" strokeDasharray="10 7" vectorEffect="non-scaling-stroke" />;
        })()}
      </svg>
      <div style={{ marginTop: 7, color: '#667085', fontSize: 12 }}>
        {pickedPoints.length === 0 ? '도면에서 기준선 시작점을 선택하세요.' : pickedPoints.length === 1 ? '끝점을 선택하면 도면상 길이가 자동 계산됩니다.' : `선택 완료 · 도면상 길이 ${drawingLength || '-'} units`}
      </div>
    </div>}

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(180px,1fr))', gap: 10 }}>
      <TextField size="small" label="도면상 기준 길이" value={drawingLength} onChange={(event) => setDrawingLength(event.target.value)} inputMode="decimal" helperText="두 점 선택 시 자동 계산 · 필요 시 직접 보정 가능" />
      <TextField size="small" label="실제 기준 길이(m)" value={realLengthM} onChange={(event) => setRealLengthM(event.target.value)} inputMode="decimal" helperText="예: 54 ft = 16.4592m" />
      <TextField size="small" label="기준 근거" value={referenceLabel} onChange={(event) => setReferenceLabel(event.target.value)} placeholder="예: Sun Deck 표기 54 ft" />
      <TextField size="small" label="검토 메모" value={note} onChange={(event) => setNote(event.target.value)} placeholder="근거 위치 또는 확인 방법" />
    </div>

    {preview && <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: '#f1f5f9', color: '#475467', fontSize: 13 }}>
      <strong>검증 전 미리보기</strong> · 1 drawing unit = {preview.scale.toFixed(6)}m
      {preview.widthM != null && preview.heightM != null ? ` · 전체 geometry bounds 약 ${preview.widthM.toFixed(2)}m × ${preview.heightM.toFixed(2)}m` : ''}
      <div style={{ marginTop: 4 }}>※ bounds는 도면 전체 외곽 범위이며 건축면적·전용면적을 의미하지 않습니다.</div>
    </div>}

    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
      <Button variant="contained" onClick={() => void save()} disabled={saving || !(Number(drawingLength) > 0) || !(Number(realLengthM) > 0)}>{saving ? '저장 중' : '확인한 축척 저장'}</Button>
    </div>
  </section>;
}
