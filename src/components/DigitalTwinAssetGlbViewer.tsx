import { useEffect, useState } from 'react';
import { Alert } from '@mui/material';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import ThreeGlbViewer from './propertyDataRoom/ThreeGlbViewer';

export default function DigitalTwinAssetGlbViewer({ asset }: { asset: DigitalTwinAsset }) {
  const [url, setUrl] = useState(asset.fileUrl || '');

  useEffect(() => {
    if (asset.fileUrl) {
      setUrl(asset.fileUrl);
      return;
    }
    if (!(asset.fileData instanceof Blob)) {
      setUrl('');
      return;
    }
    const objectUrl = URL.createObjectURL(asset.fileData);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [asset.fileData, asset.fileUrl]);

  if (!url) return <Alert severity="info">GLB binary 또는 file URL이 없어 Viewer를 열 수 없습니다.</Alert>;

  return <>
    <Alert severity="warning" sx={{ mb: 1.5 }}>
      이 모델은 {String(asset.metadata.modelClass || '3D asset')}입니다. horizontal scale verified={String(asset.metadata.horizontalScaleVerified === true)} · height status={String(asset.metadata.heightStatus || 'unknown')}
    </Alert>
    <ThreeGlbViewer modelUrl={url} title={asset.fileName || 'GLB Viewer'} />
  </>;
}
