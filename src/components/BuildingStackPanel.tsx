import { Alert, Chip, Slider } from '@mui/material';
import { useMemo, useState } from 'react';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { buildingStackService } from '../services/buildingStackService';

function project(point: { x: number; y: number; z: number }, yawDeg: number, pitchDeg: number) {
  const yaw = yawDeg * Math.PI / 180;
  const pitch = pitchDeg * Math.PI / 180;
  const x1 = point.x * Math.cos(yaw) - point.y * Math.sin(yaw);
  const y1 = point.x * Math.sin(yaw) + point.y * Math.cos(yaw);
  const y2 = y1 * Math.cos(pitch) - point.z * Math.sin(pitch);
  return { x: x1, y: y2 };
}

export default function BuildingStackPanel({ assets }: { assets: DigitalTwinAsset[] }) {
  const stack = useMemo(() => buildingStackService.build(assets), [assets]);
  const [yaw, setYaw] = useState(35);
  const [pitch, setPitch] = useState(-28);
  const scene = useMemo(() => {
    const floors = stack.floors.map((floor) => ({ floor, points: floor.vertices.map((vertex) => project(vertex, yaw, pitch)) }));
    const all = floors.flatMap((item) => item.points);
    if (!all.length) return undefined;
    const minX = Math.min(...all.map((p) => p.x)); const maxX = Math.max(...all.map((p) => p.x));
    const minY = Math.min(...all.map((p) => p.y)); const maxY = Math.max(...all.map((p) => p.y));
    const width = Math.max(.1, maxX - minX); const height = Math.max(.1, maxY - minY); const pad = Math.max(width, height) * .12;
    return { floors, viewBox: `${minX - pad} ${minY - pad} ${width + pad * 2} ${height + pad * 2}` };
  }, [stack, yaw, pitch]);

  return <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20, marginBottom: 20 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div><h2 style={{ margin: 0 }}>Multi-floor Building Model / 층간 Stack</h2><p style={{ margin: '6px 0 0', color: '#667085' }}>각 도면 자산의 검증된 층 기준고와 slab 두께를 이용해 다층 3D 배치 후보를 구성합니다.</p></div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Chip label={stack.status} color={stack.status === 'ready' ? 'success' : stack.status === 'partial' ? 'warning' : 'default'} /><Chip variant="outlined" label={`Floors ${stack.floors.length}`} />{stack.totalHeightM != null && <Chip variant="outlined" label={`Height ${stack.totalHeightM.toFixed(2)}m`} />}</div>
    </div>

    {!scene ? <Alert severity="info" sx={{ mt: 1.5 }}>각 층 자산에 검증된 층 배치와 reviewed mesh가 준비되면 다층 모델이 표시됩니다.</Alert> : <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 14 }}>
        <div><small>회전 {yaw}°</small><Slider size="small" min={-180} max={180} value={yaw} onChange={(_, value) => setYaw(Number(value))} /></div>
        <div><small>기울기 {pitch}°</small><Slider size="small" min={-75} max={15} value={pitch} onChange={(_, value) => setPitch(Number(value))} /></div>
      </div>
      <div style={{ height: 420, border: '1px solid #e5e7eb', borderRadius: 8, background: '#f8fafc', overflow: 'hidden' }}>
        <svg viewBox={scene.viewBox} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Multi-floor reviewed building stack">
          <g transform="scale(1,-1)">
            {scene.floors.map(({ floor, points }) => <g key={floor.assetId}>{points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="0.05" fill="none" stroke="currentColor" vectorEffect="non-scaling-stroke" />)}</g>)}
          </g>
        </svg>
      </div>
      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>{stack.floors.map((floor) => <div key={floor.assetId} style={{ display: 'grid', gridTemplateColumns: '90px 100px 100px 1fr', gap: 10, padding: 10, border: '1px solid #e5eaf0', borderRadius: 8 }}><strong>{floor.floorLabel}</strong><span>Z {floor.elevationM.toFixed(2)}m</span><span>slab {floor.slabThicknessM.toFixed(2)}m</span><span>{floor.roomCount} rooms · {floor.wallSegmentCount} wall segments · {floor.openingCutCount} opening cuts</span></div>)}</div>
    </>}

    <Alert severity="warning" sx={{ mt: 1.5 }}>{stack.warnings.join(' ')}</Alert>
  </section>;
}
