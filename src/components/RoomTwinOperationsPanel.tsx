import { Alert, Chip } from '@mui/material';
import type { DataRoomBundle } from '../domain/propertyDataRoom/types';
import { roomIntelligenceService } from '../services/roomIntelligenceService';

export default function RoomTwinOperationsPanel({ bundle }: { bundle: DataRoomBundle }) {
  const views = roomIntelligenceService.buildViews({
    spaces: bundle.spaces ?? [], assets: bundle.digitalTwinAssets, links: bundle.spaceRoomLinks ?? [], media: bundle.media,
    spaceMediaLinks: bundle.spaceMediaLinks ?? [], facilities: bundle.facilities ?? [], agentResults: bundle.agentResults ?? [], renovationAssessments: bundle.renovationAssessments ?? [],
  });
  const positions = bundle.roomEvidencePositions ?? [];
  const conditions = bundle.roomConditionHistory ?? [];
  const renovations = bundle.roomRenovationAssessments ?? [];
  const renovationHistory = bundle.roomRenovationHistory ?? [];
  return <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20, marginBottom: 20 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><div><h2 style={{ margin: 0 }}>Digital Twin × Room Intelligence Operations</h2><p style={{ color: '#667085', margin: '6px 0 0' }}>검토된 3D Room과 Interior evidence, 위치 Human Review, 상태·리노베이션 이력을 한 운영 화면에서 확인합니다.</p></div><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Chip size="small" label={`Rooms ${views.length}`} /><Chip size="small" label={`Positions ${positions.filter((item) => item.decision === 'approved').length}`} /><Chip size="small" label={`Conditions ${conditions.length}`} /><Chip size="small" label={`Renovation events ${renovationHistory.length}`} /></div></div>
    {!views.length ? <Alert severity="info" sx={{ mt: 1.5 }}>승인된 Interior ↔ 3D Room 연결이 생기면 통합 운영 현황이 활성화됩니다.</Alert> : <div style={{ display: 'grid', gap: 9, marginTop: 14 }}>{views.map((view) => {
      const roomPositions = positions.filter((item) => item.spaceId === view.space.id && item.roomCandidateId === view.room.roomCandidate.id && item.decision === 'approved');
      const roomConditions = conditions.filter((item) => item.spaceId === view.space.id && item.roomCandidateId === view.room.roomCandidate.id);
      const roomRenovations = renovations.filter((item) => item.spaceId === view.space.id && item.roomCandidateId === view.room.roomCandidate.id);
      return <div key={view.link.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,1fr) repeat(5,minmax(90px,.5fr))', gap: 8, alignItems: 'center', padding: 11, border: '1px solid #e3e8ef', borderRadius: 9 }}><div><strong>{view.space.floor || view.room.floor || '층 미확인'} · {view.space.name}</strong><small style={{ display: 'block', color: '#667085' }}>{view.room.roomName} · {view.room.assetLabel}</small></div><Chip size="small" variant="outlined" label={`사진 ${view.media.length}`} /><Chip size="small" variant="outlined" label={`설비 ${view.facilities.length}`} /><Chip size="small" color={roomPositions.length ? 'success' : 'default'} variant="outlined" label={`위치 ${roomPositions.length}`} /><Chip size="small" variant="outlined" label={`상태이력 ${roomConditions.length}`} /><Chip size="small" color={roomRenovations.some((item) => item.decision === 'approved') ? 'success' : 'default'} variant="outlined" label={`리노 ${roomRenovations.length}`} /></div>;
    })}</div>}
    <Alert severity="warning" sx={{ mt: 1.5 }}>이 화면은 운영 통합 뷰입니다. 공간·설비 위치와 리노베이션 판단은 각각의 Human Review 상태를 그대로 따르며 자동으로 법적·시공 확정값으로 승격하지 않습니다.</Alert>
  </section>;
}
