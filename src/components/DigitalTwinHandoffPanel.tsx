import { DownloadRounded } from '@mui/icons-material';
import { Alert, Button, Chip } from '@mui/material';
import { useMemo } from 'react';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { buildDigitalTwinPackage, DIGITAL_TWIN_PACKAGE_VERSION } from '../services/digitalTwinPackageService';

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'digital-twin';
}

export default function DigitalTwinHandoffPanel({ asset }: { asset: DigitalTwinAsset }) {
  const pkg = useMemo(() => buildDigitalTwinPackage(asset), [asset]);
  const readySignals = [pkg.readiness.geometry, pkg.readiness.scaleVerified, pkg.readiness.verticalVerified, pkg.readiness.roomTopologyReviewed, pkg.readiness.allReviewedOpeningsDimensioned].filter(Boolean).length;

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${safeFileName(asset.fileName || asset.id)}-${DIGITAL_TWIN_PACKAGE_VERSION}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return <section style={{ border: '1px solid #d9e0e8', borderRadius: 10, padding: 14, background: '#fbfcfe' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
      <div>
        <strong>Digital Twin Handoff Package</strong>
        <p style={{ margin: '4px 0 0', color: '#667085', fontSize: 13 }}>Human Review를 통과한 축척·공간 경계·문/창 연결·치수·높이·공간 그래프·extrusion 후보를 후속 3D/원격검토 모듈로 전달합니다.</p>
      </div>
      <Button size="small" variant="outlined" startIcon={<DownloadRounded />} onClick={downloadJson}>JSON 내보내기</Button>
    </div>

    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
      <Chip size="small" label={pkg.schemaVersion} />
      <Chip size="small" variant="outlined" label={`Readiness ${readySignals}/5`} />
      <Chip size="small" color={pkg.readiness.graphStatus === 'ready' ? 'success' : 'default'} variant="outlined" label={`Graph ${pkg.readiness.graphStatus}`} />
      <Chip size="small" color={pkg.readiness.extrusionStatus === 'ready' ? 'success' : 'default'} variant="outlined" label={`Extrusion ${pkg.readiness.extrusionStatus}`} />
      <Chip size="small" color="warning" variant="outlined" label="Production mesh: NOT READY" />
    </div>

    <Alert severity="info" sx={{ mt: 1.5 }}>
      이 JSON은 검토용 handoff package입니다. 공적 장부 면적·구조 안전성·피난 적합성·인허가 적합성·실시설계 치수를 확정하지 않으며 productionMeshReady는 구조/벽 두께/개구부 정합성 검토 전까지 false입니다.
    </Alert>
  </section>;
}
