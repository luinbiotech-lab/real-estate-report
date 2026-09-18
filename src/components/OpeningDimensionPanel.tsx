import { useMemo, useState } from 'react';
import { Alert, Button, Chip, TextField } from '@mui/material';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { openingDimensionService } from '../services/openingDimensionService';
import { openingTopologyService, readOpeningAdjacencyReviews } from '../services/openingTopologyService';

export default function OpeningDimensionPanel({ asset, onSaved }: { asset: DigitalTwinAsset; onSaved?: () => void | Promise<void> }) {
  const approvedOpeningIds = useMemo(() => new Set(readOpeningAdjacencyReviews(asset).filter((item) => item.decision === 'approved').map((item) => item.candidateId)), [asset]);
  const candidates = useMemo(() => openingTopologyService.buildCandidates(asset).filter((item) => approvedOpeningIds.has(item.id)), [asset, approvedOpeningIds]);
  const saved = useMemo(() => openingDimensionService.getReviews(asset), [asset]);
  const savedById = useMemo(() => new Map(saved.map((item) => [item.candidateId, item])), [saved]);
  const [drafts, setDrafts] = useState<Record<string, { widthM: string; heightM: string; sillHeightM: string; sourceLabel: string; note: string }>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const getDraft = (id: string) => {
    const current = savedById.get(id);
    return drafts[id] ?? {
      widthM: current ? String(current.widthM) : '',
      heightM: current ? String(current.heightM) : '',
      sillHeightM: current?.sillHeightM != null ? String(current.sillHeightM) : '',
      sourceLabel: current?.sourceLabel || '도면/현장 확인 개구부 치수',
      note: current?.note || '',
    };
  };
  const patch = (id: string, key: string, value: string) => setDrafts((current) => ({ ...current, [id]: { ...getDraft(id), [key]: value } }));

  const save = async (id: string) => {
    const draft = getDraft(id);
    setBusy(id); setError('');
    try {
      await openingDimensionService.save(asset, {
        candidateId: id,
        widthM: Number(draft.widthM),
        heightM: Number(draft.heightM),
        sillHeightM: draft.sillHeightM.trim() ? Number(draft.sillHeightM) : undefined,
        sourceLabel: draft.sourceLabel,
        note: draft.note,
      });
      await onSaved?.();
    } catch (reason) { setError(reason instanceof Error ? reason.message : '개구부 치수를 저장하지 못했습니다.'); }
    finally { setBusy(''); }
  };

  return <section style={{ border: '1px solid #d9e0e8', borderRadius: 10, padding: 14, background: '#fbfcfe' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}>
      <div><strong>Opening Dimension / 개구부 치수</strong><p style={{ margin: '4px 0 0', color: '#667085', fontSize: 13 }}>승인된 door/window 연결 후보에 사람이 확인한 폭·높이만 기록합니다.</p></div>
      <Chip size="small" color={saved.length ? 'success' : 'default'} label={`검증 ${saved.length}`} />
    </div>
    <Alert severity="warning" sx={{ mb: 1.5 }}>폭·높이·창 하단 높이는 자동 추정하지 않습니다. 실제 도면 치수 또는 현장 실측 근거가 있을 때만 저장하세요. 치수 저장만으로 3D mesh 개구부를 자동 절삭하지 않습니다.</Alert>
    {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
    {!candidates.length && <div style={{ padding: 18, textAlign: 'center', color: '#7b8794' }}>먼저 Door / Window Topology에서 연결 후보를 승인하세요.</div>}
    <div style={{ display: 'grid', gap: 10 }}>
      {candidates.map((candidate) => {
        const draft = getDraft(candidate.id); const current = savedById.get(candidate.id);
        return <article key={candidate.id} style={{ border: '1px solid #e1e6ec', borderRadius: 8, padding: 12, background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 9 }}><strong>{candidate.semantic} · {candidate.layer}</strong><Chip size="small" color={current ? 'success' : 'default'} label={current ? '치수 검증됨' : '미검증'} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(120px,1fr))', gap: 8 }}>
            <TextField size="small" label="폭(m)" value={draft.widthM} onChange={(event) => patch(candidate.id, 'widthM', event.target.value)} inputMode="decimal" />
            <TextField size="small" label="높이(m)" value={draft.heightM} onChange={(event) => patch(candidate.id, 'heightM', event.target.value)} inputMode="decimal" />
            <TextField size="small" label="창 하단 높이(m, 선택)" value={draft.sillHeightM} onChange={(event) => patch(candidate.id, 'sillHeightM', event.target.value)} inputMode="decimal" />
            <TextField size="small" label="확인 근거" value={draft.sourceLabel} onChange={(event) => patch(candidate.id, 'sourceLabel', event.target.value)} />
            <TextField size="small" label="검토 메모" value={draft.note} onChange={(event) => patch(candidate.id, 'note', event.target.value)} sx={{ gridColumn: 'span 2' }} />
          </div>
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}><Button size="small" variant="contained" disabled={busy === candidate.id} onClick={() => void save(candidate.id)}>{busy === candidate.id ? '저장 중' : '확인한 치수 저장'}</Button></div>
        </article>;
      })}
    </div>
  </section>;
}
