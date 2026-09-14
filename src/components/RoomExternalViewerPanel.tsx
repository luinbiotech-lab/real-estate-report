import { LaunchRounded } from '@mui/icons-material';
import { Alert, Button } from '@mui/material';
import type { RoomConditionHistoryEntry, RoomEvidencePosition, RoomRenovationAssessment, RoomRenovationHistoryEntry } from '../domain/propertyDataRoom/types';
import { roomExternalViewerService } from '../services/roomExternalViewerService';
import type { RoomIntelligenceView } from '../services/roomIntelligenceService';

export default function RoomExternalViewerPanel({ view, positions, conditionHistory, renovationAssessments, renovationHistory }: { view: RoomIntelligenceView; positions: RoomEvidencePosition[]; conditionHistory: RoomConditionHistoryEntry[]; renovationAssessments: RoomRenovationAssessment[]; renovationHistory: RoomRenovationHistoryEntry[]; }) {
  const approvedCount = positions.filter((item) => item.spaceId === view.space.id && item.roomCandidateId === view.room.roomCandidate.id && item.decision === 'approved').length;
  return <div style={{ border: '1px solid #e3e8ef', borderRadius: 10, padding: 14 }}>
    <strong>External Room Viewer</strong>
    <p style={{ color: '#667085', margin: '6px 0 10px' }}>현재 승인된 Room Intelligence를 읽기 전용 standalone HTML로 내보냅니다. 사진·설비 위치는 Human Review 승인 좌표만 geometry 위에 표시됩니다.</p>
    <Button size="small" variant="outlined" startIcon={<LaunchRounded />} onClick={() => roomExternalViewerService.download({ view, positions, conditionHistory, renovationAssessments, renovationHistory })}>Room Viewer HTML</Button>
    <Alert severity="info" sx={{ mt: 1.2 }}>승인 위치 {approvedCount}건 · 실제 공유 URL/인증 서버는 아직 연결하지 않습니다. 생성 파일 자체가 외부 검토용 read-only package입니다.</Alert>
  </div>;
}
