import { Alert, Chip, Slider } from '@mui/material';
import { useMemo, useState } from 'react';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { buildReviewedMeshCandidate } from '../services/reviewedMeshCandidateService';

type Projected = { x: number; y: number };

function rotateAndProject(vertex: { x: number; y: number; z: number }, yawDeg: number, pitchDeg: number): Projected {
  const yaw = yawDeg * Math.PI / 180;
  const pitch = pitchDeg * Math.PI / 180;
  const x1 = vertex.x * Math.cos(yaw) - vertex.y * Math.sin(yaw);
  const y1 = vertex.x * Math.sin(yaw) + vertex.y * Math.cos(yaw);
  const y2 = y1 * Math.cos(pitch) - vertex.z * Math.sin(pitch);
  return { x: x1, y: y2 };
}

function pathPoints(points: Projected[]) {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
}

export default function ReviewedMeshViewer({ asset }: { asset: DigitalTwinAsset }) {
  const mesh = useMemo(() => buildReviewedMeshCandidate(asset), [asset]);
  const [yaw, setYaw] = useState(35);
  const [pitch, setPitch] = useState(-28);

  const scene = useMemo(() => {
    if (mesh.status !== 'ready') return undefined;
    const projectedRooms = mesh.rooms.map((room) => ({
      room,
      projected: room.vertices.map((vertex) => rotateAndProject(vertex, yaw, pitch)),
    }));
    const all = projectedRooms.flatMap((item) => item.projected);
    if (!all.length) return undefined;
    const minX = Math.min(...all.map((point) => point.x));
    const maxX = Math.max(...all.map((point) => point.x));
    const minY = Math.min(...all.map((point) => point.y));
    const maxY = Math.max(...all.map((point) => point.y));
    const width = Math.max(0.1, maxX - minX);
    const height = Math.max(0.1, maxY - minY);
    const padding = Math.max(width, height) * 0.12;
    return { projectedRooms, viewBox: `${minX - padding} ${minY - padding} ${width + padding * 2} ${height + padding * 2}` };
  }, [mesh, yaw, pitch]);

  return <section style={{ border: '1px solid #d9e0e8', borderRadius: 10, padding: 14, background: '#fff' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
      <div><strong>Reviewed Mesh Viewer / 원격 3D 검토 기반</strong><p style={{ margin: '4px 0 0', color: '#667085', fontSize: 13 }}>승인 공간 경계와 확인 높이로 만든 prism 후보를 브라우저에서 회전·기울기 조절해 확인합니다.</p></div>
      <Chip size="small" color={mesh.status === 'ready' ? 'success' : 'default'} variant="outlined" label={mesh.status === 'ready' ? `${mesh.rooms.length} room mesh candidate` : '입력 검증 필요'} />
    </div>

    {mesh.status !== 'ready' || !scene ? <Alert severity="info">검증 축척 + 승인 공간 경계 + 확인 층고/천장고가 준비되면 3D 검토 후보가 표시됩니다.</Alert> : <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 10 }}>
        <div><small>회전 {yaw}°</small><Slider size="small" min={-180} max={180} value={yaw} onChange={(_, value) => setYaw(Number(value))} /></div>
        <div><small>기울기 {pitch}°</small><Slider size="small" min={-75} max={15} value={pitch} onChange={(_, value) => setPitch(Number(value))} /></div>
      </div>
      <div style={{ height: 360, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#f8fafc' }}>
        <svg viewBox={scene.viewBox} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Reviewed 3D mesh candidate preview">
          <g transform="scale(1,-1)">
            {scene.projectedRooms.map(({ room, projected }) => room.faces.map((face, faceIndex) => {
              const points = face.map((index) => projected[index - 1]).filter(Boolean);
              return <polygon key={`${room.roomId}-${faceIndex}`} points={pathPoints(points)} fill="rgba(30,58,95,0.08)" stroke="#1e3a5f" strokeWidth="0.03" vectorEffect="non-scaling-stroke" />;
            }))}
          </g>
        </svg>
      </div>
      <Alert severity="warning" sx={{ mt: 1.5 }}>현재 뷰어는 검토용 prism mesh입니다. 문·창 절삭, 벽 두께, 슬래브, 구조체, 재료/텍스처 및 실측 정합성이 적용된 production Digital Twin이 아닙니다.</Alert>
    </>}
  </section>;
}
