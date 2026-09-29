import { Alert, Chip } from '@mui/material';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { spatialGraphService } from '../services/spatialGraphService';

export default function SpatialGraphPanel({ asset }: { asset: DigitalTwinAsset }) {
  const graph = spatialGraphService.build(asset);
  return <section style={{ border: '1px solid #d9e0e8', borderRadius: 10, padding: 14, background: '#fbfcfe' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
      <div><strong>Spatial Connectivity Graph</strong><p style={{ margin: '4px 0 0', color: '#667085', fontSize: 13 }}>승인된 room boundary와 door/window 연결 후보만으로 공간 연결 그래프를 구성합니다.</p></div>
      <div style={{ display: 'flex', gap: 6 }}><Chip size="small" label={`nodes ${graph.nodes.length}`} /><Chip size="small" label={`edges ${graph.edges.length}`} /><Chip size="small" color={graph.status === 'ready' ? 'success' : graph.status === 'partial' ? 'warning' : 'default'} label={graph.status} /></div>
    </div>
    <Alert severity="info" sx={{ mb: 1.5 }}>그래프는 공간 탐색·동선 검토를 위한 후보 데이터입니다. 피난·법정 출입구·접근성 적합성을 자동 확정하지 않습니다.</Alert>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <div><h4 style={{ margin: '0 0 8px' }}>Room nodes</h4><div style={{ display: 'grid', gap: 6 }}>{graph.nodes.map((node) => <div key={node.id} style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: 8, padding: 9 }}><strong>{node.name}</strong><div style={{ color: '#667085', fontSize: 12, marginTop: 3 }}>{node.floor || '층 미지정'} · {node.layer || 'layer 미지정'}{node.areaSqmCandidate != null ? ` · ${node.areaSqmCandidate.toFixed(2)}㎡ 후보` : ''}</div></div>)}{!graph.nodes.length && <p style={{ color: '#7b8794' }}>승인된 공간 경계가 없습니다.</p>}</div></div>
      <div><h4 style={{ margin: '0 0 8px' }}>Opening edges</h4><div style={{ display: 'grid', gap: 6 }}>{graph.edges.map((edge) => <div key={edge.id} style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: 8, padding: 9 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong>{edge.semantic} · {edge.layer}</strong><Chip size="small" variant="outlined" label={edge.connectivity} /></div><div style={{ color: '#667085', fontSize: 12, marginTop: 3 }}>연결 room 후보 {edge.roomIds.length}개</div></div>)}{!graph.edges.length && <p style={{ color: '#7b8794' }}>승인된 문·창 연결 후보가 없습니다.</p>}</div></div>
    </div>
  </section>;
}
