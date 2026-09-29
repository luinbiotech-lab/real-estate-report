import { CameraAltRounded, Inventory2Rounded } from '@mui/icons-material';
import type { PropertyFacility, PropertyMedia, RoomEvidencePosition } from '../domain/propertyDataRoom/types';

function projectPoint(point: { x: number; y: number }, bounds: { minX: number; minY: number; width: number; height: number }, z = 0) {
  const nx = (point.x - bounds.minX) / bounds.width - 0.5;
  const ny = (point.y - bounds.minY) / bounds.height - 0.5;
  const x = 210 + nx * 230 - ny * 95;
  const y = 170 + nx * 55 + ny * 65 - z * 55;
  return { x, y };
}

export default function RoomIntelligence3DOverlay({ points, media, facilities, positions, ceilingHeightM }: { points: Array<{ x: number; y: number }>; media: PropertyMedia[]; facilities: PropertyFacility[]; positions: RoomEvidencePosition[]; ceilingHeightM?: number; }) {
  if (points.length < 3) return <div style={{ height: 300, display: 'grid', placeItems: 'center', background: '#f6f8fb', borderRadius: 12, color: '#98a2b3' }}>3D room boundary 없음</div>;
  const xs = points.map((point) => point.x), ys = points.map((point) => point.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const bounds = { minX, minY, width: maxX - minX || 1, height: maxY - minY || 1 };
  const ring = points[0].x === points.at(-1)?.x && points[0].y === points.at(-1)?.y ? points.slice(0, -1) : points;
  const floor = ring.map((point) => projectPoint(point, bounds));
  const heightScale = Math.max(0.45, Math.min(1.15, (ceilingHeightM || 2.7) / 3));
  const roof = ring.map((point) => projectPoint(point, bounds, heightScale));
  const polygon = (values: Array<{ x: number; y: number }>) => values.map((point) => `${point.x},${point.y}`).join(' ');
  const approved = positions.filter((item) => item.decision === 'approved');
  const markerPoint = (item: RoomEvidencePosition) => projectPoint({ x: minX + item.normalizedX * bounds.width, y: minY + item.normalizedY * bounds.height }, bounds, item.normalizedZ * heightScale);

  return <div style={{ border: '1px solid #e3e8ef', borderRadius: 12, overflow: 'hidden', background: '#f7f9fc' }}>
    <svg viewBox="0 0 460 300" style={{ width: '100%', height: 300, display: 'block' }} aria-label="Room evidence 3D overlay">
      <polygon points={polygon(floor)} fill="#dfe7ef" stroke="#1f3b5b" strokeWidth="2" />
      <polygon points={polygon(roof)} fill="#f8fafc" fillOpacity="0.65" stroke="#7c8da0" strokeWidth="1.5" />
      {floor.map((point, index) => <line key={`wall-${index}`} x1={point.x} y1={point.y} x2={roof[index].x} y2={roof[index].y} stroke="#8090a3" strokeWidth="1.5" />)}
      <text x="18" y="22" fontSize="12" fill="#667085">Reviewed room geometry · approved evidence coordinates</text>
      {approved.map((item, index) => { const marker = markerPoint(item); const isMedia = item.resourceType === 'media'; return <g key={item.id} transform={`translate(${marker.x},${marker.y})`}>
        {isMedia ? <circle r="14" fill="#fff" stroke="#49647d" strokeWidth="2.5" /> : <rect x="-14" y="-12" width="28" height="24" rx="6" fill="#fff" stroke="#8b6c2d" strokeWidth="2.5" />}
        <text textAnchor="middle" dy="4" fontSize="9" fill={isMedia ? '#1f3b5b' : '#755719'}>{isMedia ? 'P' : 'F'}{index + 1}</text>
      </g>; })}
    </svg>
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '10px 12px', borderTop: '1px solid #e3e8ef', background: '#fff', fontSize: 12, color: '#667085' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CameraAltRounded fontSize="inherit" />사진 {media.length}건</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Inventory2Rounded fontSize="inherit" />설비 {facilities.length}건</span>
      <span>승인 위치 {approved.length}건 · room-local Human Review 좌표이며 측량/BIM 기준좌표가 아닙니다.</span>
    </div>
  </div>;
}
