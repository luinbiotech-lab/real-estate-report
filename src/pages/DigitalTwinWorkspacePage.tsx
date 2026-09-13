import { useEffect, useMemo, useState } from 'react';
import { AutoAwesomeRounded, RefreshRounded } from '@mui/icons-material';
import { Alert, Button, Chip, CircularProgress, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import BuildingStackPanel from '../components/BuildingStackPanel';
import DigitalTwinHandoffPanel from '../components/DigitalTwinHandoffPanel';
import ExtrusionPreview from '../components/ExtrusionPreview';
import FloorPlacementPanel from '../components/FloorPlacementPanel';
import FloorPlanGeometryPreview from '../components/FloorPlanGeometryPreview';
import FloorPlanSemanticReviewPanel from '../components/FloorPlanSemanticReviewPanel';
import OpeningCutPanel from '../components/OpeningCutPanel';
import OpeningDimensionPanel from '../components/OpeningDimensionPanel';
import OpeningTopologyPanel from '../components/OpeningTopologyPanel';
import ReviewedMeshViewer from '../components/ReviewedMeshViewer';
import RoomTopologyPanel from '../components/RoomTopologyPanel';
import ScaleCalibrationPanel from '../components/ScaleCalibrationPanel';
import SpatialGraphPanel from '../components/SpatialGraphPanel';
import VerticalDimensionPanel from '../components/VerticalDimensionPanel';
import WallModelPanel from '../components/WallModelPanel';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { propertyRepository } from '../repositories/propertyRepository';
import { agentOrchestratorService } from '../services/agentOrchestratorService';
import { agentRuntimeService } from '../services/agentRuntimeService';
import type { Property } from '../types';

export default function DigitalTwinWorkspacePage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof propertyDataRoomRepository.getBundle>>>({ documents: [], media: [], verifications: [], verificationCandidates: [], dataSources: [], reportSnapshots: [], digitalTwinAssets: [] });
  const [loading, setLoading] = useState(true);
  const [refreshingTwin, setRefreshingTwin] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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

  const refreshTwinCandidate = async () => {
    if (!propertyId) return;
    setRefreshingTwin(true); setError(''); setNotice('');
    try {
      const job = await agentOrchestratorService.queuePropertyAgent(propertyId, 'digital_twin', 'refresh', { requestedFrom: 'digital-twin-workspace' });
      if (job.status === 'queued') {
        await agentRuntimeService.execute(job);
        setNotice('Digital Twin 후보를 최신 승인 데이터 기준으로 다시 생성했습니다. Agent Operations의 Human Review에서 확인하세요.');
      } else if (job.status === 'review_required') {
        setNotice('이미 검토 대기 중인 Digital Twin 후보가 있습니다. 기존 Human Review를 먼저 처리하세요.');
      } else setNotice(`Digital Twin Agent 상태: ${job.status}`);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Digital Twin 후보를 갱신하지 못했습니다.'); }
    finally { setRefreshingTwin(false); }
  };

  if (loading) return <div className="center"><CircularProgress /><p>Digital Twin Workspace를 준비하는 중입니다.</p></div>;

  const assets = bundle.digitalTwinAssets;
  const geometryAssets = assets.filter((asset) => asset.metadata.geometry && typeof asset.metadata.geometry === 'object');
  const scaleVerifiedAssets = assets.filter((asset) => asset.metadata.scaleCalibration && typeof asset.metadata.scaleCalibration === 'object');
  const heightVerifiedAssets = assets.filter((asset) => asset.metadata.verticalDimensions && typeof asset.metadata.verticalDimensions === 'object');
  const floorPlacedAssets = assets.filter((asset) => asset.metadata.floorPlacement && typeof asset.metadata.floorPlacement === 'object');
  const topologyApproved = assets.reduce((sum, asset) => sum + (Array.isArray(asset.metadata.roomTopologyReviews) ? asset.metadata.roomTopologyReviews.filter((item) => item && typeof item === 'object' && (item as { decision?: string }).decision === 'approved').length : 0), 0);
  const openingApproved = assets.reduce((sum, asset) => sum + (Array.isArray(asset.metadata.openingAdjacencyReviews) ? asset.metadata.openingAdjacencyReviews.filter((item) => item && typeof item === 'object' && (item as { decision?: string }).decision === 'approved').length : 0), 0);
  const openingDimensions = assets.reduce((sum, asset) => sum + (Array.isArray(asset.metadata.openingDimensions) ? asset.metadata.openingDimensions.length : 0), 0);
  const readyAssets = assets.filter((asset) => asset.processingStatus === 'ready');
  const reviewJobs = (bundle.agentJobs ?? []).filter((job) => ['floor_plan', 'digital_twin'].includes(job.agentType) && job.status === 'review_required');
  const semanticReviewed = assets.reduce((sum, asset) => sum + (Array.isArray(asset.metadata.semanticLayerReviews) ? asset.metadata.semanticLayerReviews.length : 0), 0);

  return <main style={{ padding: 28, maxWidth: 1360, margin: '0 auto' }}>
    <header style={{ marginBottom: 24 }}>
      <p className="eyebrow">FLOOR PLAN · WALLS · SLABS · MULTI-FLOOR · 3D PREPARATION</p>
      <h1 style={{ margin: '6px 0' }}>Digital Twin Workspace</h1>
      <p style={{ color: '#667085' }}>DXF geometry, 검증 축척, 공간 경계, 벽체 두께, 문·창, 층고·천장고, 층 기준고와 slab 두께를 Human Review로 연결해 다층 Building Model 후보를 구성합니다.</p>
    </header>
    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
    {notice && <Alert severity="info" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}

    <section style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20, marginBottom: 20, alignItems: 'center' }}>
      <FormControl size="small" fullWidth><InputLabel id="twin-property-label">대상 물건</InputLabel><Select labelId="twin-property-label" label="대상 물건" value={propertyId} onChange={async (event) => { setPropertyId(event.target.value); setNotice(''); await load(event.target.value); }}>{properties.map((item) => <MenuItem key={item.id} value={item.id}>{item.name} · {item.address}</MenuItem>)}</Select></FormControl>
      <Button startIcon={<RefreshRounded />} onClick={() => load()}>새로고침</Button>
      <Button variant="contained" startIcon={<AutoAwesomeRounded />} disabled={!propertyId || refreshingTwin} onClick={() => void refreshTwinCandidate()}>{refreshingTwin ? '후보 생성 중' : 'Twin 후보 갱신'}</Button>
      {selected && <div style={{ gridColumn: '1 / -1', color: '#667085' }}>{selected.propertyNumber || '물건번호 미입력'} · {selected.name}</div>}
    </section>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(11,minmax(78px,1fr))', gap: 10, marginBottom: 20 }}>
      {[
        ['원본', assets.length], ['Geometry', geometryAssets.length], ['축척', scaleVerifiedAssets.length], ['높이', heightVerifiedAssets.length], ['층배치', floorPlacedAssets.length], ['Layer', semanticReviewed], ['공간 경계', topologyApproved], ['문·창 연결', openingApproved], ['개구부 치수', openingDimensions], ['Review', reviewJobs.length], ['Twin Ready', readyAssets.length],
      ].map(([label, value]) => <div key={String(label)} style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 12 }}><small style={{ color: '#667085' }}>{label}</small><strong style={{ display: 'block', fontSize: 24, marginTop: 6 }}>{value}</strong></div>)}
    </section>

    <Alert severity="warning" sx={{ mb: 2 }}>DXF layer 의미, 축척, 공간 경계, 벽 두께, door/window 연결·치수, 층고·천장고, 층 기준고와 slab 두께는 모두 Human Review 대상입니다. 자동 후보는 실시설계·법정면적·구조·피난·인허가 판단을 대체하지 않습니다.</Alert>
    <BuildingStackPanel assets={assets} />

    <div style={{ display: 'grid', gap: 20 }}>
      {assets.map((asset) => {
        const geometryStatus = typeof asset.metadata.geometryStatus === 'string' ? asset.metadata.geometryStatus : '미추출';
        const hasGeometry = Boolean(asset.metadata.geometry && typeof asset.metadata.geometry === 'object');
        const hasScaleCalibration = Boolean(asset.metadata.scaleCalibration && typeof asset.metadata.scaleCalibration === 'object');
        const hasVerticalDimensions = Boolean(asset.metadata.verticalDimensions && typeof asset.metadata.verticalDimensions === 'object');
        const hasFloorPlacement = Boolean(asset.metadata.floorPlacement && typeof asset.metadata.floorPlacement === 'object');
        const roomReviews = Array.isArray(asset.metadata.roomTopologyReviews) ? asset.metadata.roomTopologyReviews : [];
        const approvedRooms = roomReviews.filter((item) => item && typeof item === 'object' && (item as { decision?: string }).decision === 'approved').length;
        const openingReviews = Array.isArray(asset.metadata.openingAdjacencyReviews) ? asset.metadata.openingAdjacencyReviews : [];
        const approvedOpenings = openingReviews.filter((item) => item && typeof item === 'object' && (item as { decision?: string }).decision === 'approved').length;
        const dimensionCount = Array.isArray(asset.metadata.openingDimensions) ? asset.metadata.openingDimensions.length : 0;
        const twinModel = asset.metadata.digitalTwinModel && typeof asset.metadata.digitalTwinModel === 'object' ? asset.metadata.digitalTwinModel as Record<string, unknown> : undefined;
        const calibratedBounds = twinModel?.calibratedBounds && typeof twinModel.calibratedBounds === 'object' ? twinModel.calibratedBounds as Record<string, unknown> : undefined;
        return <section key={asset.id} style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
            <div><h2 style={{ margin: 0 }}>{asset.fileName || asset.assetType}</h2><p style={{ margin: '6px 0 0', color: '#667085' }}>{asset.assetType} · {asset.fileFormat} · {asset.floor || '층 미확인'}</p></div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Chip size="small" label={asset.processingStatus} /><Chip size="small" variant="outlined" label={geometryStatus} />{hasScaleCalibration && <Chip size="small" color="success" variant="outlined" label="Scale verified" />}{hasVerticalDimensions && <Chip size="small" color="success" variant="outlined" label="Height verified" />}{hasFloorPlacement && <Chip size="small" color="success" variant="outlined" label="Floor placed" />}{approvedRooms > 0 && <Chip size="small" color="success" variant="outlined" label={`Room ${approvedRooms}`} />}{approvedOpenings > 0 && <Chip size="small" color="success" variant="outlined" label={`Opening ${approvedOpenings}`} />}{dimensionCount > 0 && <Chip size="small" color="success" variant="outlined" label={`Dimension ${dimensionCount}`} />}{twinModel && <Chip size="small" color="success" variant="outlined" label="Twin metadata" />}</div>
          </div>
          <FloorPlanGeometryPreview asset={asset} />
          {hasGeometry && <div style={{ marginTop: 18 }}><ScaleCalibrationPanel asset={asset} onSaved={() => load()} /></div>}
          {hasGeometry && <div style={{ marginTop: 18 }}><VerticalDimensionPanel asset={asset} onSaved={() => load()} /></div>}
          {hasGeometry && <div style={{ marginTop: 18 }}><FloorPlacementPanel asset={asset} onSaved={() => load()} /></div>}
          {hasGeometry && <div style={{ marginTop: 18 }}><h3>DXF Layer Human Review</h3><FloorPlanSemanticReviewPanel asset={asset} onSaved={() => load()} /></div>}
          {hasGeometry && <div style={{ marginTop: 18 }}><WallModelPanel asset={asset} onSaved={() => load()} /></div>}
          {hasGeometry && <div style={{ marginTop: 18 }}><RoomTopologyPanel asset={asset} onSaved={() => load()} /></div>}
          {hasGeometry && <div style={{ marginTop: 18 }}><OpeningTopologyPanel asset={asset} onSaved={() => load()} /></div>}
          {hasGeometry && <div style={{ marginTop: 18 }}><OpeningDimensionPanel asset={asset} onSaved={() => load()} /></div>}
          {hasGeometry && <div style={{ marginTop: 18 }}><OpeningCutPanel asset={asset} /></div>}
          {hasGeometry && <div style={{ marginTop: 18 }}><SpatialGraphPanel asset={asset} /></div>}
          {hasGeometry && <div style={{ marginTop: 18 }}><ExtrusionPreview asset={asset} /></div>}
          {hasGeometry && <div style={{ marginTop: 18 }}><ReviewedMeshViewer asset={asset} /></div>}
          {hasGeometry && <div style={{ marginTop: 18 }}><DigitalTwinHandoffPanel asset={asset} /></div>}
          {twinModel && <div style={{ marginTop: 14, padding: 12, background: '#f7f9fb', borderRadius: 8 }}><strong>Digital Twin 처리 상태</strong><p style={{ margin: '6px 0 0', color: '#667085' }}>measurement: {String(twinModel.measurementStatus || 'unknown')} · topology: {String(twinModel.topologyStatus || 'review_required')} · openings: {String(twinModel.openingTopologyStatus || 'review_required')} · opening dimensions: {String(twinModel.openingDimensionStatus || 'review_required')} · extrusion: {String(twinModel.extrusionStatus || 'blocked')}</p>{calibratedBounds && <p style={{ margin: '6px 0 0', color: '#475467' }}>검증 축척 기준 전체 bounds: {Number(calibratedBounds.widthM || 0).toFixed(2)}m × {Number(calibratedBounds.heightM || 0).toFixed(2)}m · 면적 확정값 아님</p>}</div>}
        </section>;
      })}
      {!assets.length && <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 36, textAlign: 'center', color: '#7b8794' }}>Spatial Workspace에서 PDF/DWG/DXF 도면 원본을 먼저 등록하세요.</section>}
    </div>
  </main>;
}
