import { CheckCircleRounded, LinkRounded } from '@mui/icons-material';
import { Alert, Button, Chip } from '@mui/material';
import { useMemo, useState } from 'react';
import type { DigitalTwinAsset, PropertySpace, SpaceRoomLink } from '../domain/propertyDataRoom/types';
import { interiorRoomLinkService } from '../services/interiorRoomLinkService';

function MiniRoom({ points }: { points: Array<{ x: number; y: number }> }) {
  if (!points.length) return <div style={{ height: 120, background: '#f6f8fb', borderRadius: 8 }} />;
  const xs = points.map((p) => p.x); const ys = points.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const width = maxX - minX || 1, height = maxY - minY || 1;
  const mapped = points.map((p) => `${10 + ((p.x - minX) / width) * 180},${110 - ((p.y - minY) / height) * 100}`).join(' ');
  return <svg viewBox="0 0 200 120" style={{ width: '100%', height: 120, background: '#f7f9fc', borderRadius: 8 }}><polygon points={mapped} fill="#eef2f7" stroke="#1f3b5b" strokeWidth="2" /></svg>;
}

export default function InteriorRoomLinkPanel({ propertyId, spaces, assets, links, onSaved }: { propertyId: string; spaces: PropertySpace[]; assets: DigitalTwinAsset[]; links: SpaceRoomLink[]; onSaved: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(''); const [error, setError] = useState('');
  const approvedRooms = useMemo(() => interiorRoomLinkService.listApprovedRooms(assets), [assets]);
  const candidates = useMemo(() => interiorRoomLinkService.buildCandidates(spaces, assets), [spaces, assets]);
  const approvedLinks = links.filter((item) => item.decision === 'approved');

  const review = async (spaceId: string, assetId: string, roomId: string, decision: SpaceRoomLink['decision'], confidence: number | undefined, basis: string[]) => {
    const key = `${spaceId}:${roomId}`; setBusy(key); setError('');
    try { await interiorRoomLinkService.review({ propertyId, spaceId, digitalTwinAssetId: assetId, roomCandidateId: roomId, decision, confidence, basis }); await onSaved(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '공간 연결을 저장하지 못했습니다.'); }
    finally { setBusy(''); }
  };

  return <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20, marginBottom: 20 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div><h2 style={{ margin: 0 }}>Interior ↔ 3D Room Linking</h2><p style={{ color: '#667085', margin: '6px 0 0' }}>승인된 Interior 공간 모델을 Human Review된 Digital Twin room boundary에 연결합니다. 자동 후보는 확정 연결이 아닙니다.</p></div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Chip size="small" variant="outlined" label={`Interior spaces ${spaces.length}`} /><Chip size="small" variant="outlined" label={`3D rooms ${approvedRooms.length}`} /><Chip size="small" color={approvedLinks.length ? 'success' : 'default'} variant="outlined" label={`Linked ${approvedLinks.length}`} /></div>
    </div>
    {error && <Alert severity="error" sx={{ mt: 1.5 }} onClose={() => setError('')}>{error}</Alert>}

    {approvedLinks.length > 0 && <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>{approvedLinks.map((link) => {
      const space = spaces.find((item) => item.id === link.spaceId); const room = approvedRooms.find((item) => item.assetId === link.digitalTwinAssetId && item.roomCandidate.id === link.roomCandidateId);
      if (!space || !room) return null;
      return <div key={link.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto', gap: 10, alignItems: 'center', padding: 10, border: '1px solid #dce7df', background: '#fbfefc', borderRadius: 9 }}><div><strong>{space.name}</strong><small style={{ display: 'block', color: '#667085' }}>{space.floor || '층 미확인'} · {space.spaceType}</small></div><LinkRounded fontSize="small" /><div><strong>{room.roomName}</strong><small style={{ display: 'block', color: '#667085' }}>{room.floor || '층 미확인'} · {room.assetLabel}</small></div><Chip icon={<CheckCircleRounded />} size="small" color="success" label="연결 승인" /></div>;
    })}</div>}

    <h3 style={{ marginBottom: 10, marginTop: 18 }}>추천 연결 후보</h3>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(310px,1fr))', gap: 12 }}>
      {candidates.slice(0, 12).map((candidate) => {
        const key = `${candidate.space.id}:${candidate.room.roomCandidate.id}`;
        const existing = links.find((item) => item.spaceId === candidate.space.id && item.digitalTwinAssetId === candidate.room.assetId && item.roomCandidateId === candidate.room.roomCandidate.id);
        return <article key={key} style={{ border: '1px solid #e1e6ec', borderRadius: 10, padding: 12 }}>
          <MiniRoom points={candidate.room.roomCandidate.points} />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 10 }}><div><strong>{candidate.space.name}</strong><div style={{ color: '#667085', fontSize: 13 }}>→ {candidate.room.roomName}</div></div><Chip size="small" label={`${Math.round(candidate.confidence * 100)}%`} /></div>
          <p style={{ color: '#667085', fontSize: 12, minHeight: 32 }}>{candidate.basis.join(' · ') || '자동 일치 근거 부족'}</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Button size="small" variant={existing?.decision === 'approved' ? 'contained' : 'outlined'} disabled={busy === key} onClick={() => void review(candidate.space.id, candidate.room.assetId, candidate.room.roomCandidate.id, 'approved', candidate.confidence, candidate.basis)}>연결 승인</Button>
            <Button size="small" disabled={busy === key} onClick={() => void review(candidate.space.id, candidate.room.assetId, candidate.room.roomCandidate.id, 'held', candidate.confidence, candidate.basis)}>보류</Button>
            <Button size="small" color="inherit" disabled={busy === key} onClick={() => void review(candidate.space.id, candidate.room.assetId, candidate.room.roomCandidate.id, 'rejected', candidate.confidence, candidate.basis)}>거절</Button>
          </div>
        </article>;
      })}
      {!candidates.length && <Alert severity="info">연결 후보가 아직 없습니다. 승인된 공간 모델과 Human Review된 3D room boundary가 모두 있어야 합니다.</Alert>}
    </div>
    <Alert severity="warning" sx={{ mt: 1.5 }}>공간명·층·면적 유사도는 추천용 신호일 뿐입니다. 최종 Interior ↔ 3D Room 연결은 반드시 사람이 승인해야 하며 법정 면적·용도·구획을 확정하지 않습니다.</Alert>
  </section>;
}
