import { DownloadRounded, ViewInArRounded } from '@mui/icons-material';
import { Alert, Button, Chip, Slider } from '@mui/material';
import { useMemo, useState } from 'react';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { BUILDING_STACK_VERSION, buildingStackService } from '../services/buildingStackService';
import BuildingGeometryReadinessPanel from './BuildingGeometryReadinessPanel';

function project(point: { x: number; y: number; z: number }, yawDeg: number, pitchDeg: number) {
  const yaw = yawDeg * Math.PI / 180;
  const pitch = pitchDeg * Math.PI / 180;
  const x1 = point.x * Math.cos(yaw) - point.y * Math.sin(yaw);
  const y1 = point.x * Math.sin(yaw) + point.y * Math.cos(yaw);
  const y2 = y1 * Math.cos(pitch) - point.z * Math.sin(pitch);
  return { x: x1, y: y2 };
}

function downloadText(content: string, mime: string, fileName: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = fileName; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
}

export default function BuildingStackPanel({ assets }: { assets: DigitalTwinAsset[] }) {
  const stack = useMemo(() => buildingStackService.build(assets), [assets]);
  const [yaw, setYaw] = useState(35);
  const [pitch, setPitch] = useState(-28);
  const [visibleFloors, setVisibleFloors] = useState<Record<string, boolean>>({});
  const scene = useMemo(() => {
    const floors = stack.floors.filter((floor) => visibleFloors[floor.assetId] !== false).map((floor) => ({
      floor,
      rooms: floor.rooms.map((room) => ({ room, points: room.vertices.map((vertex) => project(vertex, yaw, pitch)) })),
    }));
    const all = floors.flatMap((item) => item.rooms.flatMap((room) => room.points));
    if (!all.length) return undefined;
    const minX = Math.min(...all.map((p) => p.x)); const maxX = Math.max(...all.map((p) => p.x));
    const minY = Math.min(...all.map((p) => p.y)); const maxY = Math.max(...all.map((p) => p.y));
    const width = Math.max(.1, maxX - minX); const height = Math.max(.1, maxY - minY); const pad = Math.max(width, height) * .12;
    return { floors, viewBox: `${minX - pad} ${minY - pad} ${width + pad * 2} ${height + pad * 2}` };
  }, [stack, yaw, pitch, visibleFloors]);

  const exportJson = () => downloadText(JSON.stringify(stack, null, 2), 'application/json;charset=utf-8', `${BUILDING_STACK_VERSION}.json`);
  const exportObj = () => downloadText(buildingStackService.toObj(stack), 'text/plain;charset=utf-8', `${BUILDING_STACK_VERSION}.obj`);

  return <>
    <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div><h2 style={{ margin: 0 }}>Multi-floor Building Model / 층간 Stack</h2><p style={{ margin: '6px 0 0', color: '#667085' }}>검증된 층 기준고와 slab 두께를 이용해 다층 3D 검토 후보를 구성합니다. 층별 표시를 켜고 끄며 원격검토 관점에서 확인할 수 있습니다.</p></div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip label={stack.status} color={stack.status === 'ready' ? 'success' : stack.status === 'partial' ? 'warning' : 'default'} />
          <Chip variant="outlined" label={`Floors ${stack.floors.length}`} />
          {stack.totalHeightM != null && <Chip variant="outlined" label={`Height ${stack.totalHeightM.toFixed(2)}m`} />}
          <Button size="small" variant="outlined" startIcon={<DownloadRounded />} disabled={!stack.floors.length} onClick={exportJson}>Building JSON</Button>
          <Button size="small" variant="outlined" startIcon={<ViewInArRounded />} disabled={!stack.floors.length} onClick={exportObj}>Building OBJ</Button>
        </div>
      </div>

      {!scene ? <Alert severity="info" sx={{ mt: 1.5 }}>각 층 자산에 검증된 층 배치와 reviewed mesh가 준비되면 다층 모델이 표시됩니다.</Alert> : <>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 14 }}>
          <div><small>회전 {yaw}°</small><Slider size="small" min={-180} max={180} value={yaw} onChange={(_, value) => setYaw(Number(value))} /></div>
          <div><small>기울기 {pitch}°</small><Slider size="small" min={-75} max={15} value={pitch} onChange={(_, value) => setPitch(Number(value))} /></div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {stack.floors.map((floor) => <Button key={floor.assetId} size="small" variant={visibleFloors[floor.assetId] === false ? 'outlined' : 'contained'} onClick={() => setVisibleFloors((current) => ({ ...current, [floor.assetId]: current[floor.assetId] === false }))}>{floor.floorLabel}</Button>)}
        </div>
        <div style={{ height: 480, border: '1px solid #e5e7eb', borderRadius: 8, background: '#f8fafc', overflow: 'hidden' }}>
          <svg viewBox={scene.viewBox} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Multi-floor remote inspection building viewer">
            <g transform="scale(1,-1)">
              {scene.floors.map(({ floor, rooms }) => <g key={floor.assetId}>{rooms.map(({ room, points }) => room.faces.map((face, faceIndex) => <polygon key={`${room.roomId}-${faceIndex}`} points={face.map((index) => { const p = points[index - 1]; return p ? `${p.x.toFixed(3)},${p.y.toFixed(3)}` : ''; }).filter(Boolean).join(' ')} fill="rgba(30,58,95,.06)" stroke="#1e3a5f" strokeWidth=".03" vectorEffect="non-scaling-stroke" />))}</g>)}
            </g>
          </svg>
        </div>
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>{stack.floors.map((floor) => <div key={floor.assetId} style={{ display: 'grid', gridTemplateColumns: '90px 100px 110px 1fr', gap: 10, padding: 10, border: '1px solid #e5eaf0', borderRadius: 8 }}><strong>{floor.floorLabel}</strong><span>Z {floor.elevationM.toFixed(2)}m</span><span>slab {floor.slabThicknessM.toFixed(2)}m</span><span>{floor.roomCount} rooms · {floor.wallSegmentCount} wall segments · {floor.openingCutCount} opening cuts</span></div>)}</div>
      </>}

      <Alert severity="warning" sx={{ mt: 1.5 }}>{stack.warnings.join(' ')}</Alert>
    </section>
    <BuildingGeometryReadinessPanel assets={assets} />
  </>;
}
