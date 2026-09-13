import { useEffect, useMemo, useState } from 'react';
import { RefreshRounded } from '@mui/icons-material';
import { Alert, Button, Chip, CircularProgress, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import FloorPlanGeometryPreview from '../components/FloorPlanGeometryPreview';
import FloorPlanSemanticReviewPanel from '../components/FloorPlanSemanticReviewPanel';
import ScaleCalibrationPanel from '../components/ScaleCalibrationPanel';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { propertyRepository } from '../repositories/propertyRepository';
import type { Property } from '../types';

export default function DigitalTwinWorkspacePage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof propertyDataRoomRepository.getBundle>>>({ documents: [], media: [], verifications: [], verificationCandidates: [], dataSources: [], reportSnapshots: [], digitalTwinAssets: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const selected = useMemo(() => properties.find((item) => item.id === propertyId), [properties, propertyId]);
  const load = async (id = propertyId) => { if (id) setBundle(await propertyDataRoomRepository.getBundle(id)); };

  useEffect(() => {
    (async () => {
      try {
        const list = await propertyRepository.getAll(); setProperties(list);
        const first = list[0]?.id || ''; setPropertyId(first); if (first) await load(first);
      } catch (reason) { setError(reason instanceof Error ? reason.message : 'Digital Twin Workspace를 불러오지 못했습니다.'); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="center"><CircularProgress /><p>Digital Twin Workspace를 준비하는 중입니다.</p></div>;

  const assets = bundle.digitalTwinAssets;
  const geometryAssets = assets.filter((asset) => asset.metadata.geometry && typeof asset.metadata.geometry === 'object');
  const scaleVerifiedAssets = assets.filter((asset) => asset.metadata.scaleCalibration && typeof asset.metadata.scaleCalibration === 'object');
  const readyAssets = assets.filter((asset) => asset.processingStatus === 'ready');
  const reviewJobs = (bundle.agentJobs ?? []).filter((job) => ['floor_plan', 'digital_twin'].includes(job.agentType) && job.status === 'review_required');
  const semanticReviewed = assets.reduce((sum, asset) => sum + (Array.isArray(asset.metadata.semanticLayerReviews) ? asset.metadata.semanticLayerReviews.length : 0), 0);

  return <main style={{ padding: 28, maxWidth: 1360, margin: '0 auto' }}>
    <header style={{ marginBottom: 24 }}>
      <p className="eyebrow">FLOOR PLAN · GEOMETRY · DIGITAL TWIN</p>
      <h1 style={{ margin: '6px 0' }}>Digital Twin Workspace</h1>
      <p style={{ color: '#667085' }}>승인된 DXF geometry를 2D로 확인하고 layer 의미 후보와 Digital Twin 처리 상태를 관리합니다. 실제 치수 환산은 사람이 확인한 기준 치수로만 활성화합니다.</p>
    </header>
    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

    <section style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <FormControl size="small" fullWidth><InputLabel id="twin-property-label">대상 물건</InputLabel><Select labelId="twin-property-label" label="대상 물건" value={propertyId} onChange={async (event) => { setPropertyId(event.target.value); await load(event.target.value); }}>{properties.map((item) => <MenuItem key={item.id} value={item.id}>{item.name} · {item.address}</MenuItem>)}</Select></FormControl>
      <Button startIcon={<RefreshRounded />} onClick={() => load()}>새로고침</Button>
      {selected && <div style={{ gridColumn: '1 / -1', color: '#667085' }}>{selected.propertyNumber || '물건번호 미입력'} · {selected.name}</div>}
    </section>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(120px,1fr))', gap: 12, marginBottom: 20 }}>
      {[
        ['원본 자산', assets.length], ['Geometry 추출', geometryAssets.length], ['축척 검증', scaleVerifiedAssets.length], ['Layer 검토', semanticReviewed], ['Human Review', reviewJobs.length], ['Twin Ready', readyAssets.length],
      ].map(([label, value]) => <div key={String(label)} style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 16 }}><small style={{ color: '#667085' }}>{label}</small><strong style={{ display: 'block', fontSize: 28, marginTop: 6 }}>{value}</strong></div>)}
    </section>

    <Alert severity="warning" sx={{ mb: 2 }}>DXF layer 이름의 wall/door/window/column/stair/elevator 분류와 좌표 축척은 모두 Human Review 대상입니다. 축척이 검증돼도 전체 bounds는 건축면적·전용면적을 의미하지 않으며, DWG는 별도 변환기가 필요합니다.</Alert>

    <div style={{ display: 'grid', gap: 20 }}>
      {assets.map((asset) => {
        const geometryStatus = typeof asset.metadata.geometryStatus === 'string' ? asset.metadata.geometryStatus : '미추출';
        const hasGeometry = Boolean(asset.metadata.geometry && typeof asset.metadata.geometry === 'object');
        const twinModel = asset.metadata.digitalTwinModel && typeof asset.metadata.digitalTwinModel === 'object' ? asset.metadata.digitalTwinModel as Record<string, unknown> : undefined;
        const calibratedBounds = twinModel?.calibratedBounds && typeof twinModel.calibratedBounds === 'object' ? twinModel.calibratedBounds as Record<string, unknown> : undefined;
        return <section key={asset.id} style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
            <div><h2 style={{ margin: 0 }}>{asset.fileName || asset.assetType}</h2><p style={{ margin: '6px 0 0', color: '#667085' }}>{asset.assetType} · {asset.fileFormat} · {asset.floor || '층 미확인'}</p></div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Chip size="small" label={asset.processingStatus} /><Chip size="small" variant="outlined" label={geometryStatus} />{asset.metadata.scaleCalibration && <Chip size="small" color="success" variant="outlined" label="Scale verified" />}{twinModel && <Chip size="small" color="success" variant="outlined" label="Twin model metadata" />}</div>
          </div>
          <FloorPlanGeometryPreview asset={asset} />
          {hasGeometry && <div style={{ marginTop: 18 }}><ScaleCalibrationPanel asset={asset} onSaved={() => load()} /></div>}
          {hasGeometry && <div style={{ marginTop: 18 }}><h3>DXF Layer Human Review</h3><FloorPlanSemanticReviewPanel asset={asset} onSaved={() => load()} /></div>}
          {twinModel && <div style={{ marginTop: 14, padding: 12, background: '#f7f9fb', borderRadius: 8 }}><strong>Digital Twin 처리 상태</strong><p style={{ margin: '6px 0 0', color: '#667085' }}>measurement: {String(twinModel.measurementStatus || 'unknown')} · mesh: {String(twinModel.meshStatus || 'unknown')}</p>{calibratedBounds && <p style={{ margin: '6px 0 0', color: '#475467' }}>검증 축척 기준 전체 bounds: {Number(calibratedBounds.widthM || 0).toFixed(2)}m × {Number(calibratedBounds.heightM || 0).toFixed(2)}m · 면적 확정값 아님</p>}</div>}
        </section>;
      })}
      {!assets.length && <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 36, textAlign: 'center', color: '#7b8794' }}>Spatial Workspace에서 PDF/DWG/DXF 도면 원본을 먼저 등록하세요.</section>}
    </div>
  </main>;
}
