import { useMemo, useState } from 'react';
import { Button, Chip, MenuItem, Select, Stack } from '@mui/material';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { floorPlanSemanticReviewService, type ReviewedSemanticKind } from '../services/floorPlanSemanticReviewService';

type Candidate = { layer?: string; semantic?: ReviewedSemanticKind; confidence?: number; requiresReview?: boolean };
type Geometry = { semanticLayerCandidates?: Candidate[] };

const LABELS: Record<ReviewedSemanticKind, string> = {
  wall: '벽 후보', door: '문 후보', window: '창 후보', column: '기둥 후보', stair: '계단 후보', elevator: '엘리베이터 후보', unknown: '미분류',
};

export default function FloorPlanSemanticReviewPanel({ asset, onSaved }: { asset: DigitalTwinAsset; onSaved: () => void | Promise<void> }) {
  const geometry = asset.metadata.geometry && typeof asset.metadata.geometry === 'object' ? asset.metadata.geometry as Geometry : undefined;
  const candidates = Array.isArray(geometry?.semanticLayerCandidates) ? geometry!.semanticLayerCandidates!.filter((item) => item.layer) : [];
  const existing = floorPlanSemanticReviewService.getReviews(asset);
  const initial = useMemo(() => Object.fromEntries(candidates.map((item) => [item.layer!, existing.find((review) => review.layer === item.layer)?.semantic ?? item.semantic ?? 'unknown'])) as Record<string, ReviewedSemanticKind>, [asset.id, asset.updatedAt]);
  const [selections, setSelections] = useState<Record<string, ReviewedSemanticKind>>(initial);
  const [busyLayer, setBusyLayer] = useState('');

  if (!candidates.length) return <div style={{ padding: 14, background: '#f7f9fb', borderRadius: 8, color: '#7b8794' }}>검토할 semantic layer 후보가 없습니다.</div>;

  const save = async (layer: string, decision: 'approved' | 'held' | 'rejected') => {
    setBusyLayer(layer);
    try {
      await floorPlanSemanticReviewService.review(asset, { layer, semantic: selections[layer] ?? 'unknown', decision });
      await onSaved();
    } finally { setBusyLayer(''); }
  };

  return <div style={{ display: 'grid', gap: 10 }}>
    <p style={{ margin: 0, color: '#667085' }}>DXF layer 이름에서 추정한 의미를 검토합니다. 승인은 “이 layer를 이 의미로 해석해도 된다”는 편집 판단이며 구조안전·법적 용도를 확정하는 의미가 아닙니다.</p>
    {candidates.map((candidate) => {
      const layer = candidate.layer!;
      const review = existing.find((item) => item.layer === layer);
      return <div key={layer} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1fr) 180px auto', gap: 10, alignItems: 'center', border: '1px solid #e1e6ec', borderRadius: 9, padding: 10 }}>
        <div><strong>{layer}</strong><div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}><Chip size="small" variant="outlined" label={`자동 후보: ${LABELS[candidate.semantic ?? 'unknown']}`} /><Chip size="small" variant="outlined" label={`${Math.round((candidate.confidence ?? 0) * 100)}%`} />{review && <Chip size="small" color={review.decision === 'approved' ? 'success' : review.decision === 'held' ? 'warning' : 'default'} label={review.decision} />}</div></div>
        <Select size="small" value={selections[layer] ?? 'unknown'} onChange={(event) => setSelections((prev) => ({ ...prev, [layer]: event.target.value as ReviewedSemanticKind }))}>{floorPlanSemanticReviewService.allowedSemantics.map((semantic) => <MenuItem key={semantic} value={semantic}>{LABELS[semantic]}</MenuItem>)}</Select>
        <Stack direction="row" spacing={1}><Button size="small" disabled={busyLayer === layer} onClick={() => save(layer, 'held')}>보류</Button><Button size="small" color="error" disabled={busyLayer === layer} onClick={() => save(layer, 'rejected')}>거절</Button><Button size="small" variant="contained" color="success" disabled={busyLayer === layer} onClick={() => save(layer, 'approved')}>승인</Button></Stack>
      </div>;
    })}
  </div>;
}
