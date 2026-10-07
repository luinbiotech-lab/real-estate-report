import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Alert, Box, Button, Chip, MenuItem, Stack, TextField } from '@mui/material';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import type { SpatialSpaceType } from '../domain/propertyDataRoom/spatialMediaModel';
import { rasterFloorPlanMappingService } from '../services/rasterFloorPlanMappingService';

const SPACE_TYPES: Array<{ value: SpatialSpaceType; label: string }> = [
  { value: 'residential', label: '주거' },
  { value: 'retail', label: '상가' },
  { value: 'office', label: '사무실' },
  { value: 'storage', label: '창고' },
  { value: 'parking', label: '주차' },
  { value: 'common_area', label: '공용공간' },
  { value: 'stair', label: '계단' },
  { value: 'elevator', label: '엘리베이터' },
  { value: 'mechanical', label: '기계·설비' },
  { value: 'roof', label: '옥상' },
  { value: 'exterior', label: '외부' },
  { value: 'unknown', label: '미분류' },
];

type Rect = { x: number; y: number; width: number; height: number };

function normalizeRect(start: { x: number; y: number }, end: { x: number; y: number }): Rect {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  return { x, y, width: Math.abs(start.x - end.x), height: Math.abs(start.y - end.y) };
}

export default function RasterFloorPlanMappingPanel({
  asset,
  onSaved,
}: {
  asset: DigitalTwinAsset;
  onSaved: () => Promise<void> | void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [name, setName] = useState('');
  const [spaceType, setSpaceType] = useState<SpatialSpaceType>('unknown');
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<Rect | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const raster = asset.metadata.raster && typeof asset.metadata.raster === 'object'
    ? asset.metadata.raster as Record<string, unknown>
    : undefined;
  const mappings = useMemo(() => rasterFloorPlanMappingService.getMappings(asset), [asset]);
  const mappingStatus = typeof asset.metadata.rasterMappingStatus === 'string' ? asset.metadata.rasterMappingStatus : 'not_started';

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
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return undefined;
    return {
      x: Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)),
      y: Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)),
    };
  };

  const mouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (!imageUrl || busy) return;
    const point = pointFromEvent(event);
    if (!point) return;
    setStart(point);
    setDraft({ x: point.x, y: point.y, width: 0, height: 0 });
    setMessage('');
    setError('');
  };

  const mouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (!start) return;
    const point = pointFromEvent(event);
    if (point) setDraft(normalizeRect(start, point));
  };

  const mouseUp = (event: MouseEvent<HTMLDivElement>) => {
    if (!start) return;
    const point = pointFromEvent(event);
    if (point) setDraft(normalizeRect(start, point));
    setStart(null);
  };

  const save = async () => {
    if (!draft) { setError('도면 위에서 공간 영역을 드래그하세요.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      await rasterFloorPlanMappingService.addMapping(asset, { name, spaceType, rect: draft });
      setName('');
      setSpaceType('unknown');
      setDraft(null);
      setMessage('공간 매핑 후보를 estimated 상태로 저장했습니다.');
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '공간 매핑을 저장하지 못했습니다.');
    } finally { setBusy(false); }
  };

  const remove = async (mappingId: string) => {
    setBusy(true); setError(''); setMessage('');
    try {
      await rasterFloorPlanMappingService.removeMapping(asset, mappingId);
      setMessage('공간 매핑을 삭제했습니다. 필요하면 다시 지정하세요.');
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '공간 매핑을 삭제하지 못했습니다.');
    } finally { setBusy(false); }
  };

  const complete = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      await rasterFloorPlanMappingService.completeMapping(asset);
      setMessage('Raster 공간 매핑을 완료 상태로 전환했습니다.');
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '매핑 완료 처리에 실패했습니다.');
    } finally { setBusy(false); }
  };

  if (!raster) return null;

  return <Box sx={{ mt: 2, p: 2, border: '1px solid #d9e0e8', borderRadius: 2 }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'center', mb: 1.5 }}>
      <Box>
        <strong>Raster Floor Plan Manual Mapping</strong>
        <div style={{ color: '#667085', marginTop: 4 }}>
          {String(raster.widthPx ?? '?')} × {String(raster.heightPx ?? '?')} px · 실제 축척 미검증
        </div>
      </Box>
      <Chip size="small" color={mappingStatus === 'mapped' ? 'success' : 'warning'} label={mappingStatus} />
    </Box>

    <Alert severity="warning" sx={{ mb: 1.5 }}>
      이미지 위 박스는 공간 위치 후보입니다. 실제 면적·벽체·구조·법정 구획을 확정하지 않으며, 축척 검증 전에는 거리·면적을 계산하지 않습니다.
    </Alert>
    {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
    {message && <Alert severity="success" sx={{ mb: 1 }}>{message}</Alert>}

    {imageUrl ? <Box
      ref={containerRef}
      onMouseDown={mouseDown}
      onMouseMove={mouseMove}
      onMouseUp={mouseUp}
      sx={{ position: 'relative', userSelect: 'none', cursor: 'crosshair', border: '1px solid #cdd5df', borderRadius: 1.5, overflow: 'hidden', bgcolor: '#fff' }}
    >
      <img src={imageUrl} alt={asset.fileName || 'floor plan'} draggable={false} style={{ width: '100%', display: 'block' }} />
      {mappings.map((mapping) => <Box key={mapping.id} sx={{
        position: 'absolute',
        left: (mapping.rect.x * 100) + '%',
        top: (mapping.rect.y * 100) + '%',
        width: (mapping.rect.width * 100) + '%',
        height: (mapping.rect.height * 100) + '%',
        border: '2px solid currentColor',
        bgcolor: 'rgba(255,255,255,0.20)',
        overflow: 'hidden',
        pointerEvents: 'none',
        fontSize: 11,
        fontWeight: 700,
        p: 0.25,
      }}>{mapping.name}</Box>)}
      {draft && <Box sx={{
        position: 'absolute',
        left: (draft.x * 100) + '%',
        top: (draft.y * 100) + '%',
        width: (draft.width * 100) + '%',
        height: (draft.height * 100) + '%',
        border: '2px dashed currentColor',
        bgcolor: 'rgba(255,255,255,0.18)',
        pointerEvents: 'none',
      }} />}
    </Box> : <Alert severity="info">이 환경에서는 원본 raster binary 또는 file URL을 불러올 수 없어 preview가 없습니다.</Alert>}

    {mappings.length > 0 && <Stack spacing={0.75} sx={{ mt: 1.5 }}>
      {mappings.map((mapping) => <Box key={mapping.id} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'center', p: 1, border: '1px solid #e1e6ec', borderRadius: 1 }}>
        <div><strong>{mapping.name}</strong><div style={{ color: '#667085', fontSize: 12 }}>{mapping.spaceType} · x {mapping.rect.x.toFixed(3)} / y {mapping.rect.y.toFixed(3)} / w {mapping.rect.width.toFixed(3)} / h {mapping.rect.height.toFixed(3)}</div></div>
        <Button size="small" color="error" disabled={busy} onClick={() => void remove(mapping.id)}>삭제</Button>
      </Box>)}
    </Stack>}

    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.5fr 1fr auto auto' }, gap: 1, mt: 1.5, alignItems: 'center' }}>
      <TextField size="small" label="공간명" value={name} onChange={(event) => setName(event.target.value)} placeholder="예: 거실, 사무실 A" />
      <TextField select size="small" label="공간 용도" value={spaceType} onChange={(event) => setSpaceType(event.target.value as SpatialSpaceType)}>
        {SPACE_TYPES.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
      </TextField>
      <Button variant="contained" disabled={!imageUrl || !draft || !name.trim() || busy} onClick={() => void save()}>선택 영역 저장</Button>
      <Button variant="outlined" disabled={!mappings.length || busy || mappingStatus === 'mapped'} onClick={() => void complete()}>매핑 완료</Button>
    </Box>
  </Box>;
}
