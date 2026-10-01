import { useMemo, useState } from 'react';
import { Alert, Button, Chip, TextField } from '@mui/material';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { readRoomTopologyReviews, roomTopologyService, type RoomBoundaryCandidate } from '../services/roomTopologyService';

type Point = { x: number; y: number };
type GeometryMetadata = {
  bounds?: { minX?: number; minY?: number; maxX?: number; maxY?: number; width?: number; height?: number };
  previewSegments?: Array<{ points?: Point[] }>;
};

function normalizedPoints(points: Point[], bounds: NonNullable<GeometryMetadata['bounds']>) {
  const minX = Number(bounds.minX ?? 0);
  const maxY = Number(bounds.maxY ?? 0);
  const width = Math.max(1e-6, Number(bounds.width ?? 1));
  const height = Math.max(1e-6, Number(bounds.height ?? 1));
  return points.map((point) => ({ x: ((point.x - minX) / width) * 1000, y: ((maxY - point.y) / height) * 700 }));
}

function polygonCenter(points: Point[]) {
  if (!points.length) return { x: 0, y: 0 };
  const body = points.length > 1 && points[0].x === points[points.length - 1].x && points[0].y === points[points.length - 1].y ? points.slice(0, -1) : points;
  return {
    x: body.reduce((sum, point) => sum + point.x, 0) / Math.max(1, body.length),
    y: body.reduce((sum, point) => sum + point.y, 0) / Math.max(1, body.length),
  };
}

export default function RoomTopologyPanel({ asset, onSaved }: { asset: DigitalTwinAsset; onSaved?: () => void | Promise<void> }) {
  const candidates = useMemo(() => roomTopologyService.buildCandidates(asset), [asset]);
  const reviews = useMemo(() => readRoomTopologyReviews(asset), [asset]);
  const reviewById = useMemo(() => new Map(reviews.map((item) => [item.candidateId, item])), [reviews]);
  const geometry = asset.metadata.geometry && typeof asset.metadata.geometry === 'object' ? asset.metadata.geometry as GeometryMetadata : undefined;
  const bounds = geometry?.bounds;
  const baseSegments = Array.isArray(geometry?.previewSegments) ? geometry.previewSegments.filter((segment) => Array.isArray(segment.points) && segment.points.length > 1) : [];
  const [names, setNames] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [focusedId, setFocusedId] = useState('');
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
  const priorityCandidates = candidates.filter((candidate) => candidate.areaSqmCandidate == null || (candidate.areaSqmCandidate >= 2 && candidate.areaSqmCandidate <= 80));
  const secondaryCandidates = candidates.filter((candidate) => !priorityCandidates.some((item) => item.id === candidate.id));
  const visibleCandidates = showAll ? candidates : priorityCandidates;
  const visibleIndexById = new Map(visibleCandidates.map((candidate, index) => [candidate.id, index + 1]));

  return <section style={{ border: '1px solid #d9e0e8', borderRadius: 10, padding: 14, background: '#fbfcfe' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}>
      <div><strong>Room Topology / 공간 경계 후보</strong><p style={{ margin: '4px 0 0', color: '#667085', fontSize: 13 }}>폐합 도면 폴리라인을 공간 후보로 제시합니다. 도면 위 번호와 아래 검토 카드를 대조해 사람이 승인합니다.</p></div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}><Chip size="small" color="primary" variant="outlined" label={`우선 검토 ${priorityCandidates.length}`} /><Chip size="small" label={`전체 ${candidates.length}`} /><Chip size="small" color={approved ? 'success' : 'default'} label={`승인 ${approved}`} /></div>
    </div>

    <Alert severity="warning" sx={{ mb: 1.5 }}>축척이 확인된 경우 2~80㎡ 범위 후보를 우선 표시합니다. 이는 검토 편의를 위한 정렬 기준일 뿐 공간 확정 규칙이 아닙니다. 벽 중심선, 샤프트, 가구 외곽선 등도 반드시 사람이 확인해야 합니다.</Alert>

    {bounds && baseSegments.length > 0 && visibleCandidates.length > 0 && <div style={{ marginBottom: 14, background: '#fff', border: '1px solid #d9e0e8', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #edf0f4', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div><strong style={{ fontSize: 13 }}>도면 위 공간 후보 검토</strong><div style={{ fontSize: 11, color: '#667085', marginTop: 2 }}>후보를 클릭하면 아래 카드가 강조됩니다. 녹색=승인, 주황=보류, 적색=거절, 청색=미검토/선택.</div></div>
        {focusedId && <Button size="small" onClick={() => setFocusedId('')}>선택 해제</Button>}
      </div>
      <svg viewBox="0 0 1000 700" role="img" aria-label="공간 경계 후보 도면 검토" style={{ width: '100%', minHeight: 340, maxHeight: 560, background: '#fbfcfd' }}>
        {baseSegments.map((segment, index) => {
          const points = normalizedPoints(segment.points ?? [], bounds).map((point) => `${point.x},${point.y}`).join(' ');
          return <polyline key={`base-${index}`} points={points} fill="none" stroke="#a7b1bd" strokeWidth="0.7" opacity="0.32" vectorEffect="non-scaling-stroke" />;
        })}
        {visibleCandidates.map((candidate) => {
          const review = reviewById.get(candidate.id);
          const active = focusedId === candidate.id;
          const viewPoints = normalizedPoints(candidate.points, bounds);
          const points = viewPoints.map((point) => `${point.x},${point.y}`).join(' ');
          const center = polygonCenter(viewPoints);
          const stroke = review?.decision === 'approved' ? '#2e7d32' : review?.decision === 'rejected' ? '#c62828' : review?.decision === 'held' ? '#ed6c02' : active ? '#073a69' : '#2b6ea6';
          const fill = review?.decision === 'approved' ? 'rgba(46,125,50,.18)' : review?.decision === 'rejected' ? 'rgba(198,40,40,.12)' : review?.decision === 'held' ? 'rgba(237,108,2,.13)' : active ? 'rgba(7,58,105,.20)' : 'rgba(43,110,166,.10)';
          return <g key={candidate.id} role="button" tabIndex={0} aria-label={`공간 후보 ${visibleIndexById.get(candidate.id)}`} onClick={() => setFocusedId(candidate.id)} style={{ cursor: 'pointer' }}>
            <polygon points={points} fill={fill} stroke={stroke} strokeWidth={active ? 3 : 1.7} vectorEffect="non-scaling-stroke" />
            <circle cx={center.x} cy={center.y} r={active ? 15 : 12} fill={stroke} stroke="#fff" strokeWidth="2" />
            <text x={center.x} y={center.y + 5} textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff">{visibleIndexById.get(candidate.id)}</text>
          </g>;
        })}
      </svg>
    </div>}

    {secondaryCandidates.length > 0 && <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10 }}><Button size="small" variant="text" onClick={() => setShowAll((value) => !value)}>{showAll ? '우선 후보만 보기' : `기타 후보 ${secondaryCandidates.length}개 펼치기`}</Button></div>}
    {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
    {!candidates.length && <div style={{ padding: 18, textAlign: 'center', color: '#7b8794' }}>폐합 폴리라인 기반 공간 후보가 없습니다.</div>}
    <div style={{ display: 'grid', gap: 10 }}>
      {visibleCandidates.map((candidate) => {
        const review = reviewById.get(candidate.id);
        const index = visibleIndexById.get(candidate.id);
        const focused = focusedId === candidate.id;
        return <article key={candidate.id} onClick={() => setFocusedId(candidate.id)} style={{ border: focused ? '2px solid #073a69' : '1px solid #e1e6ec', borderRadius: 8, padding: 12, background: focused ? '#f6f9fc' : '#fff', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}><span style={{ width: 26, height: 26, borderRadius: 999, background: '#073a69', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800 }}>{index}</span><div><strong>{candidate.layer || 'layer 미지정'}</strong><div style={{ color: '#667085', fontSize: 13, marginTop: 4 }}>drawing area {candidate.drawingArea.toFixed(2)}{candidate.areaSqmCandidate != null ? ` · 약 ${candidate.areaSqmCandidate.toFixed(2)}㎡ 후보` : ' · 실제 면적 미산정'}{candidate.perimeterMCandidate != null ? ` · 둘레 약 ${candidate.perimeterMCandidate.toFixed(2)}m 후보` : ''}</div></div></div>
            <Chip size="small" color={review?.decision === 'approved' ? 'success' : review?.decision === 'rejected' ? 'error' : review?.decision === 'held' ? 'warning' : 'default'} label={review?.decision || '미검토'} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }} onClick={(event) => event.stopPropagation()}>
            <TextField size="small" label="공간명(선택)" value={names[candidate.id] ?? review?.name ?? ''} onChange={(event) => setNames((current) => ({ ...current, [candidate.id]: event.target.value }))} placeholder="예: 1층 사무실" />
            <TextField size="small" label="검토 메모" value={notes[candidate.id] ?? review?.note ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [candidate.id]: event.target.value }))} placeholder="경계 근거·제외 사유" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 10 }} onClick={(event) => event.stopPropagation()}>
            <Button size="small" disabled={busy === candidate.id} onClick={() => void act(candidate, 'held')}>보류</Button>
            <Button size="small" color="error" disabled={busy === candidate.id} onClick={() => void act(candidate, 'rejected')}>거절</Button>
            <Button size="small" variant="contained" color="success" disabled={busy === candidate.id} onClick={() => void act(candidate, 'approved')}>경계 승인</Button>
          </div>
        </article>;
      })}
    </div>
  </section>;
}
