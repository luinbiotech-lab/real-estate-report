import { BuildRounded, CheckCircleRounded } from '@mui/icons-material';
import { Alert, Button, Chip } from '@mui/material';
import { useMemo, useState } from 'react';
import type { RoomRenovationAssessment } from '../domain/propertyDataRoom/types';
import type { RoomIntelligenceView } from '../services/roomIntelligenceService';
import { roomRenovationService } from '../services/roomRenovationService';

export default function RoomRenovationPanel({ view, assessments, onSaved }: { view: RoomIntelligenceView; assessments: RoomRenovationAssessment[]; onSaved: () => void | Promise<void>; }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const current = useMemo(() => assessments.filter((item) => item.spaceId === view.space.id && item.digitalTwinAssetId === view.room.assetId && item.roomCandidateId === view.room.roomCandidate.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0], [assessments, view]);
  const run = async (action: 'draft' | 'approved' | 'held' | 'rejected') => {
    setBusy(true); setError('');
    try {
      if (action === 'draft') await roomRenovationService.saveDraft(view);
      else {
        if (!current) throw new Error('먼저 방 단위 검토 초안을 생성하세요.');
        await roomRenovationService.review(current, action);
      }
      await onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Room Renovation 검토를 저장하지 못했습니다.'); }
    finally { setBusy(false); }
  };

  return <div style={{ border: '1px solid #e3e8ef', borderRadius: 10, padding: 14 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <div><strong><BuildRounded fontSize="small" sx={{ verticalAlign: 'middle', mr: .6 }} />Room Renovation Assessment</strong><small style={{ display: 'block', color: '#667085', marginTop: 4 }}>Property-level 평가와 분리된 방 단위 검토 데이터입니다.</small></div>
      <Chip size="small" color={current?.decision === 'approved' ? 'success' : 'default'} variant="outlined" label={current?.decision?.toUpperCase() || 'NOT CREATED'} />
    </div>
    {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
    {!current ? <Alert severity="info" sx={{ mt: 1.2 }}>승인된 Room Intelligence 근거로 검토 초안을 만들 수 있습니다. 자동 초안은 공사 범위 확정이 아닙니다.</Alert> : <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><strong>{current.title}</strong><Chip size="small" label={current.scope} /></div>
      <p style={{ color: '#475467', margin: '8px 0' }}>{current.summary}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div><small style={{ color: '#667085' }}>추천 검토 항목</small>{current.recommendedItems.length ? <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{current.recommendedItems.map((item) => <li key={item}>{item}</li>)}</ul> : <p style={{ color: '#98a2b3' }}>없음</p>}</div>
        <div><small style={{ color: '#667085' }}>리스크/확인 필요</small><ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{current.riskItems.map((item) => <li key={item}>{item}</li>)}</ul></div>
      </div>
      <small style={{ color: '#667085' }}>비용: {current.costStatus === 'not_estimated' ? '미산정' : '범위 후보'} · Evidence refs {current.evidenceRefs.length}건</small>
    </div>}
    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 12 }}>
      <Button size="small" variant="outlined" disabled={busy} onClick={() => void run('draft')}>{current ? '초안 재생성' : '방별 초안 생성'}</Button>
      <Button size="small" variant={current?.decision === 'approved' ? 'contained' : 'outlined'} color="success" startIcon={<CheckCircleRounded />} disabled={busy || !current} onClick={() => void run('approved')}>승인</Button>
      <Button size="small" disabled={busy || !current} onClick={() => void run('held')}>보류</Button>
      <Button size="small" color="inherit" disabled={busy || !current} onClick={() => void run('rejected')}>거절</Button>
    </div>
    <Alert severity="warning" sx={{ mt: 1.2 }}>방 단위 리노베이션 평가는 검토 후보입니다. 구조·소방·전기·설비·인허가·정확 비용은 현장조사와 전문가 검토 없이 확정하지 않습니다.</Alert>
  </div>;
}
