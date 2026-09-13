import { Alert } from '@mui/material';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { extrusionGeometryService } from '../services/extrusionGeometryService';

function project(point: { x: number; y: number; z: number }) {
  return { x: point.x - point.y * 0.55, y: point.x * 0.28 + point.y * 0.28 - point.z };
}

export default function ExtrusionPreview({ asset }: { asset: DigitalTwinAsset }) {
  const result = extrusionGeometryService.build(asset);
  if (result.status !== 'ready') {
    const reason = result.reason === 'scale_required' ? '축척 검증 필요' : result.reason === 'height_required' ? '층고/천장고 검증 필요' : '공간 경계 승인 필요';
    return <section style={{ border: '1px dashed #cbd5e1', borderRadius: 10, padding: 14, background: '#f8fafc' }}><strong>3D Extrusion Preview</strong><p style={{ color: '#667085', marginBottom: 0 }}>{reason} — 필요한 Human Review가 완료되면 3D 후보가 생성됩니다.</p></section>;
  }

  const projected = result.rooms.flatMap((room) => [...room.bottom, ...room.top].map(project));
  const minX = Math.min(...projected.map((point) => point.x)); const maxX = Math.max(...projected.map((point) => point.x));
  const minY = Math.min(...projected.map((point) => point.y)); const maxY = Math.max(...projected.map((point) => point.y));
  const width = Math.max(1, maxX - minX); const height = Math.max(1, maxY - minY); const pad = Math.max(width, height) * 0.08;

  return <section style={{ border: '1px solid #d9e0e8', borderRadius: 10, padding: 14, background: '#fbfcfe' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}><div><strong>3D Extrusion Preview</strong><p style={{ margin: '4px 0 0', color: '#667085', fontSize: 13 }}>승인된 공간 경계에 검증된 높이를 적용한 로컬 3D 후보입니다.</p></div><strong>{result.rooms.length} rooms</strong></div>
    <svg viewBox={`${minX - pad} ${minY - pad} ${width + pad * 2} ${height + pad * 2}`} style={{ width: '100%', minHeight: 300, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
      {result.rooms.map((room) => {
        const bottom = room.bottom.map(project); const top = room.top.map(project);
        const topPoints = top.map((point) => `${point.x},${point.y}`).join(' ');
        return <g key={room.id}>
          {room.walls.map((wall, index) => <polygon key={`${room.id}-wall-${index}`} points={`${bottom[wall.a].x},${bottom[wall.a].y} ${bottom[wall.b].x},${bottom[wall.b].y} ${top[wall.b].x},${top[wall.b].y} ${top[wall.a].x},${top[wall.a].y}`} fill="rgba(15,71,110,.12)" stroke="rgba(15,71,110,.45)" strokeWidth="0.02" />)}
          <polygon points={topPoints} fill="rgba(180,122,37,.20)" stroke="rgba(180,122,37,.8)" strokeWidth="0.03" />
        </g>;
      })}
    </svg>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 8, marginTop: 10 }}>{result.rooms.map((room) => <div key={room.id} style={{ padding: 10, background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }}><strong>{room.name}</strong><div style={{ color: '#667085', fontSize: 13, marginTop: 4 }}>{room.areaSqmCandidate != null ? `${room.areaSqmCandidate.toFixed(2)}㎡ 후보` : '면적 후보 없음'} · 높이 {room.heightM.toFixed(2)}m{room.volumeM3Candidate != null ? ` · 체적 ${room.volumeM3Candidate.toFixed(2)}㎥ 후보` : ''}</div></div>)}</div>
    <Alert severity="warning" sx={{ mt: 1.5 }}>{result.warnings[1]}</Alert>
  </section>;
}
