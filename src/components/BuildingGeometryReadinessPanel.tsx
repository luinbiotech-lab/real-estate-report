import { DownloadRounded, PublicRounded } from '@mui/icons-material';
import { Alert, Button, Chip } from '@mui/material';
import { useMemo } from 'react';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { openingBooleanEligibilityService } from '../services/openingBooleanEligibilityService';
import { remoteInspectionService, REMOTE_INSPECTION_VERSION } from '../services/remoteInspectionService';
import { slabCoreAlignmentService } from '../services/slabCoreAlignmentService';
import { verticalCoreService } from '../services/verticalCoreService';
import { wallGeometryMergeService } from '../services/wallGeometryMergeService';

function downloadText(content: string, mime: string, fileName: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = fileName; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
}

export default function BuildingGeometryReadinessPanel({ assets }: { assets: DigitalTwinAsset[] }) {
  const data = useMemo(() => remoteInspectionService.build(assets), [assets]);
  const wall = useMemo(() => assets.flatMap((asset) => wallGeometryMergeService.build(asset).map((item) => ({ asset, item }))), [assets]);
  const openings = useMemo(() => assets.flatMap((asset) => openingBooleanEligibilityService.build(asset).map((item) => ({ asset, item }))), [assets]);
  const slabCore = useMemo(() => assets.flatMap((asset) => slabCoreAlignmentService.build(asset).map((item) => ({ asset, item }))), [assets]);
  const cores = useMemo(() => verticalCoreService.buildConnections(assets), [assets]);

  const exportJson = () => downloadText(JSON.stringify(data, null, 2), 'application/json;charset=utf-8', `${REMOTE_INSPECTION_VERSION}.json`);
  const exportHtml = () => downloadText(remoteInspectionService.toHtml(assets), 'text/html;charset=utf-8', `${REMOTE_INSPECTION_VERSION}.html`);

  return <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20, marginBottom: 20 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div><h2 style={{ margin: 0 }}>Geometry Readiness · Remote Inspection</h2><p style={{ margin: '6px 0 0', color: '#667085' }}>wall junction merge 준비, opening boolean eligibility, slab/core opening 정합, 다층 원격검토 패키지를 한 곳에서 확인합니다.</p></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Chip color={data.readiness.blockerCount ? 'warning' : 'success'} label={`Blocker ${data.readiness.blockerCount}`} />
        <Button size="small" variant="outlined" startIcon={<DownloadRounded />} disabled={!assets.length} onClick={exportJson}>Inspection JSON</Button>
        <Button size="small" variant="contained" startIcon={<PublicRounded />} disabled={!data.readiness.reviewable} onClick={exportHtml}>Remote Inspection HTML</Button>
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12, marginTop: 16 }}>
      <div style={{ border: '1px solid #e5eaf0', borderRadius: 10, padding: 12 }}><small>Wall Junction Merge Ready</small><strong style={{ display: 'block', fontSize: 24 }}>{wall.filter(({ item }) => item.eligible).length}/{wall.length}</strong></div>
      <div style={{ border: '1px solid #e5eaf0', borderRadius: 10, padding: 12 }}><small>Opening Boolean Eligible</small><strong style={{ display: 'block', fontSize: 24 }}>{openings.filter(({ item }) => item.eligible).length}/{openings.length}</strong></div>
      <div style={{ border: '1px solid #e5eaf0', borderRadius: 10, padding: 12 }}><small>Slab/Core Aligned</small><strong style={{ display: 'block', fontSize: 24 }}>{slabCore.filter(({ item }) => item.alignmentStatus === 'aligned').length}/{slabCore.length}</strong></div>
      <div style={{ border: '1px solid #e5eaf0', borderRadius: 10, padding: 12 }}><small>Vertical Core Aligned</small><strong style={{ display: 'block', fontSize: 24 }}>{cores.filter((item) => item.alignmentStatus === 'aligned').length}/{cores.length}</strong></div>
    </div>

    <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
      {wall.map(({ asset, item }) => <div key={`${asset.id}-${item.junctionId}`} style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 10, padding: 10, border: '1px solid #e5eaf0', borderRadius: 8 }}><strong>{asset.floor || '층 미지정'}</strong><span>Wall {item.junctionId} · degree {item.degree} · drift {item.maxEndpointDriftM.toFixed(3)}m · thickness Δ {item.maxThicknessDeltaM.toFixed(3)}m</span><Chip size="small" color={item.eligible ? 'success' : 'warning'} label={item.eligible ? 'MERGE READY' : 'REVIEW'} /></div>)}
      {openings.map(({ asset, item }) => <div key={`${asset.id}-${item.candidateId}`} style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 10, padding: 10, border: '1px solid #e5eaf0', borderRadius: 8 }}><strong>{asset.floor || '층 미지정'}</strong><span>{item.semantic} · {item.wallLayer} · clearance {item.clearanceM != null ? `${item.clearanceM.toFixed(2)}m` : '확인 불가'}</span><Chip size="small" color={item.eligible ? 'success' : 'warning'} label={item.eligible ? 'BOOLEAN ELIGIBLE' : 'BLOCKED'} /></div>)}
      {slabCore.map(({ asset, item }) => <div key={`${asset.id}-${item.coreId}-${item.layer}`} style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 10, padding: 10, border: '1px solid #e5eaf0', borderRadius: 8 }}><strong>{item.floorLabel}</strong><span>{item.semantic} · Core {item.coreId} · opening footprint {item.widthM.toFixed(2)}m × {item.depthM.toFixed(2)}m</span><Chip size="small" color={item.alignmentStatus === 'aligned' ? 'success' : 'warning'} label={item.alignmentStatus} /></div>)}
    </div>

    {data.blockers.length > 0 ? <Alert severity="warning" sx={{ mt: 1.5 }}>아직 {data.blockers.length}개의 geometry blocker가 있습니다. 실제 merge/boolean은 blocker가 해소된 뒤 별도 실행 단계에서만 적용합니다.</Alert> : <Alert severity="success" sx={{ mt: 1.5 }}>현재 검토 데이터 기준 geometry eligibility blocker는 없습니다. 그래도 productionReady=false를 유지하며 실제 시공/구조 BIM으로 승격하지 않습니다.</Alert>}
  </section>;
}
