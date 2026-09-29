import { SaveRounded } from '@mui/icons-material';
import { Alert, Button, Chip, TextField } from '@mui/material';
import { useMemo, useState } from 'react';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { wallModelService } from '../services/wallModelService';

export default function WallModelPanel({ asset, onSaved }: { asset: DigitalTwinAsset; onSaved: () => void | Promise<void> }) {
  const layers = useMemo(() => wallModelService.getApprovedWallLayers(asset), [asset]);
  const reviews = useMemo(() => wallModelService.readThicknessReviews(asset), [asset]);
  const model = useMemo(() => wallModelService.build(asset), [asset]);
  const [drafts, setDrafts] = useState<Record<string, { thickness: string; source: string }>>({});
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');

  if (!layers.length) return <Alert severity="info">DXF Layer Human Review에서 wall layer를 먼저 승인해야 벽체 모델을 준비할 수 있습니다.</Alert>;

  return <section style={{ border: '1px solid #d9e0e8', borderRadius: 10, padding: 14, background: '#fbfcfe' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div>
        <strong>Wall Model / 벽 두께 검증</strong>
        <p style={{ margin: '4px 0 0', color: '#667085', fontSize: 13 }}>승인된 wall layer의 중심선을 기준으로 두께를 사람이 확인해 저장합니다. 자동 추정값만으로 벽 두께를 확정하지 않습니다.</p>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Chip size="small" variant="outlined" label={`Wall layer ${layers.length}`} />
        <Chip size="small" color={model.length ? 'success' : 'default'} variant="outlined" label={`Reviewed segment ${model.length}`} />
      </div>
    </div>

    {error && <Alert severity="error" sx={{ mt: 1.5 }} onClose={() => setError('')}>{error}</Alert>}
    <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
      {layers.map((layer) => {
        const review = reviews.find((item) => item.layer === layer);
        const draft = drafts[layer] ?? { thickness: review ? String(review.thicknessM) : '', source: review?.sourceLabel ?? '' };
        return <div key={layer} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,1fr) 150px minmax(220px,1.2fr) auto', gap: 10, alignItems: 'center', padding: 10, border: '1px solid #e5eaf0', borderRadius: 8, background: '#fff' }}>
          <div><strong>{layer}</strong>{review && <small style={{ display: 'block', color: '#667085', marginTop: 3 }}>검증됨 · {review.thicknessM}m</small>}</div>
          <TextField size="small" label="두께(m)" type="number" inputProps={{ min: 0.01, max: 2, step: 0.01 }} value={draft.thickness} onChange={(event) => setDrafts((current) => ({ ...current, [layer]: { ...draft, thickness: event.target.value } }))} />
          <TextField size="small" label="확인 근거" placeholder="도면 치수 / 현장 확인 / 설계자료" value={draft.source} onChange={(event) => setDrafts((current) => ({ ...current, [layer]: { ...draft, source: event.target.value } }))} />
          <Button size="small" variant="outlined" startIcon={<SaveRounded />} disabled={saving === layer} onClick={async () => {
            setSaving(layer); setError('');
            try {
              await wallModelService.saveThicknessReview(asset, { layer, thicknessM: Number(draft.thickness), sourceLabel: draft.source });
              await onSaved();
            } catch (reason) { setError(reason instanceof Error ? reason.message : '벽 두께를 저장하지 못했습니다.'); }
            finally { setSaving(''); }
          }}>확인한 두께 저장</Button>
        </div>;
      })}
    </div>

    <Alert severity="warning" sx={{ mt: 1.5 }}>현재 벽체는 검증된 중심선 + 확인 두께 + 확인 높이 기반 후보입니다. 벽체 접합, 외벽/내벽 법적 구분, 구조체, 내화성능, 시공 상세는 아직 확정하지 않습니다.</Alert>
  </section>;
}
