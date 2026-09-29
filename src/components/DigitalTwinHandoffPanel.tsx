import { DownloadRounded, OpenInBrowserRounded, ViewInArRounded } from '@mui/icons-material';
import { Alert, Button, Chip } from '@mui/material';
import { useMemo } from 'react';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { buildDigitalTwinPackage, DIGITAL_TWIN_PACKAGE_VERSION } from '../services/digitalTwinPackageService';
import { buildReviewedMeshCandidate, reviewedMeshCandidateToObj, REVIEWED_MESH_CANDIDATE_VERSION } from '../services/reviewedMeshCandidateService';
import { buildStandaloneRemoteInspectionHtml, REMOTE_INSPECTION_EXPORT_VERSION } from '../services/remoteInspectionExportService';

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'digital-twin';
}

function downloadText(content: string, mime: string, fileName: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function DigitalTwinHandoffPanel({ asset }: { asset: DigitalTwinAsset }) {
  const pkg = useMemo(() => buildDigitalTwinPackage(asset), [asset]);
  const mesh = useMemo(() => buildReviewedMeshCandidate(asset), [asset]);
  const readySignals = [pkg.readiness.geometry, pkg.readiness.scaleVerified, pkg.readiness.verticalVerified, pkg.readiness.floorPlacementVerified, pkg.readiness.roomTopologyReviewed, pkg.readiness.wallThicknessReviewed, pkg.readiness.allReviewedOpeningsDimensioned, pkg.readiness.openingCutsPrepared].filter(Boolean).length;
  const baseName = safeFileName(asset.fileName || asset.id);

  const downloadJson = () => downloadText(JSON.stringify(pkg, null, 2), 'application/json;charset=utf-8', `${baseName}-${DIGITAL_TWIN_PACKAGE_VERSION}.json`);
  const downloadObj = () => downloadText(reviewedMeshCandidateToObj(mesh), 'text/plain;charset=utf-8', `${baseName}-${REVIEWED_MESH_CANDIDATE_VERSION}.obj`);
  const downloadRemoteViewer = () => downloadText(buildStandaloneRemoteInspectionHtml(asset), 'text/html;charset=utf-8', `${baseName}-${REMOTE_INSPECTION_EXPORT_VERSION}.html`);

  return <section style={{ border: '1px solid #d9e0e8', borderRadius: 10, padding: 14, background: '#fbfcfe' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 520px' }}>
        <strong>Digital Twin Handoff Package</strong>
        <p style={{ margin: '4px 0 0', color: '#667085', fontSize: 13 }}>Human Review를 통과한 축척·공간 경계·벽체 두께·문/창 연결·치수·층 기준고·slab 정보를 후속 3D/원격검토 모듈로 전달합니다.</p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button size="small" variant="outlined" startIcon={<DownloadRounded />} onClick={downloadJson}>JSON 내보내기</Button>
        <Button size="small" variant="outlined" startIcon={<ViewInArRounded />} disabled={mesh.status !== 'ready'} onClick={downloadObj}>검토용 OBJ 내보내기</Button>
        <Button size="small" variant="contained" startIcon={<OpenInBrowserRounded />} disabled={mesh.status !== 'ready'} onClick={downloadRemoteViewer}>원격검토 HTML 내보내기</Button>
      </div>
    </div>

    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
      <Chip size="small" label={pkg.schemaVersion} />
      <Chip size="small" variant="outlined" label={`Readiness ${readySignals}/8`} />
      <Chip size="small" color={pkg.readiness.wallThicknessReviewed ? 'success' : 'default'} variant="outlined" label={`Walls ${pkg.walls.length}`} />
      <Chip size="small" color={pkg.readiness.floorPlacementVerified ? 'success' : 'default'} variant="outlined" label={pkg.readiness.floorPlacementVerified ? 'Floor placed' : 'Floor placement required'} />
      <Chip size="small" color={pkg.readiness.openingCutsPrepared ? 'success' : 'default'} variant="outlined" label={`Opening cuts ${pkg.openingCuts.length}`} />
      <Chip size="small" color={pkg.readiness.graphStatus === 'ready' ? 'success' : 'default'} variant="outlined" label={`Graph ${pkg.readiness.graphStatus}`} />
      <Chip size="small" color={pkg.readiness.extrusionStatus === 'ready' ? 'success' : 'default'} variant="outlined" label={`Extrusion ${pkg.readiness.extrusionStatus}`} />
      <Chip size="small" color={mesh.status === 'ready' ? 'success' : 'default'} variant="outlined" label={`Reviewed mesh ${mesh.status}`} />
      <Chip size="small" color="warning" variant="outlined" label="Production mesh: NOT READY" />
    </div>

    <Alert severity="info" sx={{ mt: 1.5 }}>
      JSON은 reviewed data handoff, OBJ는 아직 room prism 기반 검토용 mesh, HTML은 서버 없이 열 수 있는 원격 검토 뷰어입니다. 벽 두께·개구부 절삭·slab 배치 데이터는 handoff에 포함되지만 실제 boolean/구조체 mesh는 아직 생성하지 않습니다. productionMeshReady는 계속 false입니다.
    </Alert>
  </section>;
}
