import { DownloadRounded, ViewInArRounded } from '@mui/icons-material';
import { Alert, Button, Chip } from '@mui/material';
import { useMemo } from 'react';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { buildDigitalTwinPackage, DIGITAL_TWIN_PACKAGE_VERSION } from '../services/digitalTwinPackageService';
import { buildReviewedMeshCandidate, reviewedMeshCandidateToObj, REVIEWED_MESH_CANDIDATE_VERSION } from '../services/reviewedMeshCandidateService';

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
  const readySignals = [pkg.readiness.geometry, pkg.readiness.scaleVerified, pkg.readiness.verticalVerified, pkg.readiness.roomTopologyReviewed, pkg.readiness.allReviewedOpeningsDimensioned].filter(Boolean).length;
  const baseName = safeFileName(asset.fileName || asset.id);

  const downloadJson = () => downloadText(JSON.stringify(pkg, null, 2), 'application/json;charset=utf-8', `${baseName}-${DIGITAL_TWIN_PACKAGE_VERSION}.json`);
  const downloadObj = () => downloadText(reviewedMeshCandidateToObj(mesh), 'text/plain;charset=utf-8', `${baseName}-${REVIEWED_MESH_CANDIDATE_VERSION}.obj`);

  return <section style={{ border: '1px solid #d9e0e8', borderRadius: 10, padding: 14, background: '#fbfcfe' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 520px' }}>
        <strong>Digital Twin Handoff Package</strong>
        <p style={{ margin: '4px 0 0', color: '#667085', fontSize: 13 }}>Human Review를 통과한 축척·공간 경계·문/창 연결·치수·높이·공간 그래프·extrusion 후보를 후속 3D/원격검토 모듈로 전달합니다.</p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button size="small" variant="outlined" startIcon={<DownloadRounded />} onClick={downloadJson}>JSON 내보내기</Button>
        <Button size="small" variant="outlined" startIcon={<ViewInArRounded />} disabled={mesh.status !== 'ready'} onClick={downloadObj}>검토용 OBJ 내보내기</Button>
      </div>
    </div>

    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
      <Chip size="small" label={pkg.schemaVersion} />
      <Chip size="small" variant="outlined" label={`Readiness ${readySignals}/5`} />
      <Chip size="small" color={pkg.readiness.graphStatus === 'ready' ? 'success' : 'default'} variant="outlined" label={`Graph ${pkg.readiness.graphStatus}`} />
      <Chip size="small" color={pkg.readiness.extrusionStatus === 'ready' ? 'success' : 'default'} variant="outlined" label={`Extrusion ${pkg.readiness.extrusionStatus}`} />
      <Chip size="small" color={mesh.status === 'ready' ? 'success' : 'default'} variant="outlined" label={`Reviewed mesh ${mesh.status}`} />
      <Chip size="small" color="warning" variant="outlined" label="Production mesh: NOT READY" />
    </div>

    <Alert severity="info" sx={{ mt: 1.5 }}>
      JSON은 검토용 handoff package이고 OBJ는 승인 공간 경계를 확인 높이로 단순 extrusion한 prism 후보입니다. OBJ에는 문·창 절삭, 벽 두께, 슬래브, 구조체가 적용되지 않습니다. 공적 장부 면적·구조 안전성·피난 적합성·인허가 적합성·실시설계 치수를 확정하지 않으며 productionMeshReady는 계속 false입니다.
    </Alert>
  </section>;
}
