import { Alert, Chip } from '@mui/material';
import { useMemo } from 'react';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { wallJunctionService } from '../services/wallJunctionService';

export default function WallJunctionPanel({ asset }: { asset: DigitalTwinAsset }) {
  const junctions = useMemo(() => wallJunctionService.build(asset), [asset]);
  return <section style={{ border: '1px solid #d9e0e8', borderRadius: 10, padding: 14, background: '#fbfcfe' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div><strong>Wall Junction / 벽체 접합 후보</strong><p style={{ margin: '4px 0 0', color: '#667085', fontSize: 13 }}>검증된 wall centerline endpoint가 허용오차 안에서 만나는 지점을 접합 후보로 표시합니다.</p></div>
      <Chip size="small" variant="outlined" label={`Junction ${junctions.length}`} />
    </div>
    {junctions.length > 0 ? <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
      {junctions.map((junction) => <div key={junction.junctionId} style={{ display: 'grid', gridTemplateColumns: '120px 100px 150px 1fr', gap: 10, padding: 10, border: '1px solid #e5eaf0', borderRadius: 8, background: '#fff' }}><strong>{junction.junctionId}</strong><span>degree {junction.degree}</span><span>drift {junction.maxEndpointDriftM.toFixed(3)}m</span><span>{junction.segmentIndexes.length} wall segments · geometry merge 미적용</span></div>)}
    </div> : <Alert severity="info" sx={{ mt: 1.5 }}>검증된 벽체 중심선이 준비되고 endpoint가 인접하면 접합 후보가 표시됩니다.</Alert>}
    <Alert severity="warning" sx={{ mt: 1.5 }}>현재 단계는 endpoint proximity 기반 reviewed candidate입니다. T/L/X junction의 실제 벽체 union, miter, 두께 충돌 해결은 아직 수행하지 않으며 geometryMerged=false입니다.</Alert>
  </section>;
}
