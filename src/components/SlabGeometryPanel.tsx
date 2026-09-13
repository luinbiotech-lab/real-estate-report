import { Alert, Chip } from '@mui/material';
import { useMemo } from 'react';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { slabGeometryService } from '../services/slabGeometryService';

export default function SlabGeometryPanel({ asset }: { asset: DigitalTwinAsset }) {
  const slab = useMemo(() => slabGeometryService.build(asset), [asset]);
  return <section style={{ border: '1px solid #d9e0e8', borderRadius: 10, padding: 14, background: '#fbfcfe' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div><strong>Slab Geometry / 슬래브 형상 후보</strong><p style={{ margin: '4px 0 0', color: '#667085', fontSize: 13 }}>승인된 room boundary와 검증된 층 기준고·slab 두께로 room-footprint slab 후보를 생성합니다.</p></div>
      <div style={{ display: 'flex', gap: 6 }}><Chip size="small" color={slab.status === 'ready' ? 'success' : 'default'} variant="outlined" label={slab.status} /><Chip size="small" variant="outlined" label={`Polygon ${slab.polygons.length}`} /></div>
    </div>
    {slab.polygons.length > 0 ? <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
      {slab.polygons.map((polygon) => <div key={polygon.roomId} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 110px 110px', gap: 10, padding: 10, border: '1px solid #e5eaf0', borderRadius: 8, background: '#fff' }}><strong>{polygon.roomName}</strong><span>{polygon.floorLabel}</span><span>Z {polygon.elevationM.toFixed(2)}m</span><span>{polygon.thicknessM.toFixed(2)}m slab</span></div>)}
    </div> : <Alert severity="info" sx={{ mt: 1.5 }}>승인된 공간 경계, 검증 축척, 층 기준고/slab 두께가 준비되면 slab 후보가 생성됩니다.</Alert>}
    <Alert severity="warning" sx={{ mt: 1.5 }}>현재는 room-footprint 후보이며 전체 floor slab union, 코어 개구부, 구조 슬래브 경계와 실제 구조 안전성을 확정하지 않습니다. productionSlabReady=false 상태를 유지합니다.</Alert>
  </section>;
}
