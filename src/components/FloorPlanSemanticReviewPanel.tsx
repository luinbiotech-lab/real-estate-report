import { useMemo, useState } from 'react';
import { Button, Chip, MenuItem, Select, Stack } from '@mui/material';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { floorPlanSemanticReviewService, type ReviewedSemanticKind } from '../services/floorPlanSemanticReviewService';

type Candidate = { layer?: string; semantic?: ReviewedSemanticKind; confidence?: number; requiresReview?: boolean; basis?: string; elementId?: string; tag?: string };
type Geometry = { semanticLayerCandidates?: Candidate[]; elementSemanticCandidates?: Candidate[] };

const LABELS: Record<ReviewedSemanticKind, string> = {
  wall: '벽 후보', door: '문 후보', window: '창 후보', column: '기둥 후보', stair: '계단 후보', elevator: '엘리베이터 후보', unknown: '미분류',
};
const BASIS_LABELS: Record<string, string> = {
  layer_name: 'layer/id/class', thin_rect_geometry: '얇은 사각형', slim_rect_geometry: '창호형 사각형', curved_path_geometry: '곡선 path',
};

export default function FloorPlanSemanticReviewPanel({ asset, onSaved }: { asset: DigitalTwinAsset; onSaved: () => void | Promise<void> }) {
  const geometry = asset.metadata.geometry && typeof asset.metadata.geometry === 'object' ? asset.metadata.geometry as Geometry : undefined;
  const layerCandidates = Array.isArray(geometry?.semanticLayerCandidates) ? geometry!.semanticLayerCandidates!.filter((item) => item.layer) : [];
  const elementCandidates = Array.isArray(geometry?.elementSemanticCandidates) ? geometry!.elementSemanticCandidates!.filter((item) => item.elementId) : [];
  const candidates = [
    ...layerCandidates.map((item) => ({ ...item, reviewKey: item.layer!, displayName: item.layer!, sourceKind: 'layer' as const, basis: item.basis ?? 'layer_name' })),
    ...elementCandidates.map((item) => ({ ...item, reviewKey: `element:${item.elementId}`, displayName: `${item.elementId}${item.tag ? ` · ${item.tag}` : ''}`, sourceKind: 'element' as const })),
  ];
  const existing = floorPlanSemanticReviewService.getReviews(asset);
  const initial = useMemo(() => Object.fromEntries(candidates.map((item) => [item.reviewKey, existing.find((review) => review.layer === item.reviewKey)?.semantic ?? item.semantic ?? 'unknown'])) as Record<string, ReviewedSemanticKind>, [asset.id, asset.updatedAt]);
  const [selections, setSelections] = useState<Record<string, ReviewedSemanticKind>>(initial);
  const [busyLayer, setBusyLayer] = useState('');

  if (!candidates.length) return <div style={{ padding: 14, background: '#f7f9fb', borderRadius: 8, color: '#7b8794' }}>검토할 semantic 후보가 없습니다.</div>;

  const save = async (reviewKey: string, decision: 'approved' | 'held' | 'rejected') => {
    setBusyLayer(reviewKey);
    try {
      await floorPlanSemanticReviewService.review(asset, { layer: reviewKey, semantic: selections[reviewKey] ?? 'unknown', decision });
      await onSaved();
    } finally { setBusyLayer(''); }
  };

  return <div style={{ display: 'grid', gap: 10 }}>
    <p style={{ margin: 0, color: '#667085' }}>DXF/SVG 벡터 도면의 layer·id·class 이름에서 추정한 의미를 검토합니다. 저신뢰 도형 규칙에서 생성된 SVG element 후보도 함께 검토합니다. 승인은 “이 도형 그룹을 이 의미로 해석해도 된다”는 편집 판단이며 구조안전·법적 용도를 확정하는 의미가 아닙니다.</p>
    {candidates.map((candidate) => {
      const review = existing.find((item) => item.layer === candidate.reviewKey);
      return <div key={candidate.reviewKey} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1fr) 180px auto', gap: 10, alignItems: 'center', border: '1px solid #e1e6ec', borderRadius: 9, padding: 10 }}>
        <div><strong>{candidate.displayName}</strong><div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}><Chip size="small" variant="outlined" label={candidate.sourceKind === 'element' ? 'SVG element 후보' : 'Layer 후보'} /><Chip size="small" variant="outlined" label={`자동 후보: ${LABELS[candidate.semantic ?? 'unknown']}`} /><Chip size="small" variant="outlined" label={BASIS_LABELS[candidate.basis ?? ''] ?? candidate.basis ?? 'basis 미확인'} /><Chip size="small" variant="outlined" label={`${Math.round((candidate.confidence ?? 0) * 100)}%`} />{review && <Chip size="small" color={review.decision === 'approved' ? 'success' : review.decision === 'held' ? 'warning' : 'default'} label={review.decision} />}</div></div>
        <Select size="small" value={selections[candidate.reviewKey] ?? 'unknown'} onChange={(event) => setSelections((prev) => ({ ...prev, [candidate.reviewKey]: event.target.value as ReviewedSemanticKind }))}>{floorPlanSemanticReviewService.allowedSemantics.map((semantic) => <MenuItem key={semantic} value={semantic}>{LABELS[semantic]}</MenuItem>)}</Select>
        <Stack direction="row" spacing={1}><Button size="small" disabled={busyLayer === candidate.reviewKey} onClick={() => save(candidate.reviewKey, 'held')}>보류</Button><Button size="small" color="error" disabled={busyLayer === candidate.reviewKey} onClick={() => save(candidate.reviewKey, 'rejected')}>거절</Button><Button size="small" variant="contained" color="success" disabled={busyLayer === candidate.reviewKey} onClick={() => save(candidate.reviewKey, 'approved')}>승인</Button></Stack>
      </div>;
    })}
  </div>;
}
