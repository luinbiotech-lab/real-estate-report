import { useMemo, useState } from 'react';
import { Alert, Button, Chip } from '@mui/material';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { readScaleCalibration } from '../services/measurementCalibrationService';

export default function SchematicGlbExportPanel({
  asset,
  onSaved,
}: {
  asset: DigitalTwinAsset;
  onSaved?: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const calibration = useMemo(() => readScaleCalibration(asset), [asset]);

  const exportGlb = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const { schematicGlbExportService } = await import('../services/schematicGlbExportService');
      const saved = await schematicGlbExportService.exportFromRasterSpaces(asset);
      setMessage(`${saved.fileName || 'GLB'} 생성 완료 · ${Math.round((saved.fileData?.size || 0) / 1024)}KB`);
      await onSaved?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'GLB 생성에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  if (!asset.metadata.raster || typeof asset.metadata.raster !== 'object') return null;

  return <section style={{ border: '1px solid #d9e0e8', borderRadius: 10, padding: 14, background: '#fbfcfe', marginTop: 18 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
      <div>
        <strong>Schematic GLB Export</strong>
        <p style={{ margin: '4px 0 0', color: '#667085', fontSize: 13 }}>
          축척 검증된 raster 공간 박스를 GLB binary로 생성합니다. 평면 치수만 meter scale이며 높이는 시각화용 임시값입니다.
        </p>
      </div>
      <Chip size="small" color={calibration ? 'success' : 'warning'} label={calibration ? 'horizontal scale verified' : 'scale required'} />
    </div>
    <Alert severity="warning" sx={{ my: 1.5 }}>
      생성 GLB는 schematic_estimated 자산입니다. 실측 3D, BIM, 법정면적, 실제 층고를 의미하지 않습니다.
    </Alert>
    {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
    {message && <Alert severity="success" sx={{ mb: 1.5 }}>{message}</Alert>}
    <Button variant="contained" disabled={!calibration || busy} onClick={() => void exportGlb()}>
      {busy ? 'GLB 생성 중…' : '추정 GLB 생성'}
    </Button>
  </section>;
}
