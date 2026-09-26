import { Alert, Button, Chip, MenuItem, TextField } from '@mui/material';
import { useMemo, useState } from 'react';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { verticalCoreService, type VerticalCoreSemantic } from '../services/verticalCoreService';

export default function VerticalCorePanel({ assets, onSaved }: { assets: DigitalTwinAsset[]; onSaved: () => void | Promise<void> }) {
  const [assetId, setAssetId] = useState(assets[0]?.id ?? '');
  const [layer, setLayer] = useState('');
  const [coreId, setCoreId] = useState('');
  const [sourceLabel, setSourceLabel] = useState('현장/도면 대조 확인');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selected = assets.find((asset) => asset.id === assetId) ?? assets[0];
  const approvedLayers = useMemo(() => selected ? verticalCoreService.approvedLayers(selected) : [], [selected]);
  const selectedLayer = approvedLayers.find((item) => item.layer === layer) ?? approvedLayers[0];
  const connections = useMemo(() => verticalCoreService.buildConnections(assets), [assets]);

  const save = async () => {
    if (!selected || !selectedLayer) return;
    setSaving(true); setError('');
    try {
      await verticalCoreService.saveReview(selected, {
        coreId,
        semantic: selectedLayer.semantic as VerticalCoreSemantic,
        layer: selectedLayer.layer,
        sourceLabel,
      });
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Vertical core 검토값 저장에 실패했습니다.');
    } finally { setSaving(false); }
  };

  return <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 20, marginBottom: 20 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div><h2 style={{ margin: 0 }}>Vertical Core / 계단·엘리베이터 층간 연결</h2><p style={{ margin: '6px 0 0', color: '#667085' }}>승인된 stair/elevator layer를 같은 Core ID로 연결해 층간 XY 정렬 편차를 검토합니다. 자동 연결은 하지 않습니다.</p></div>
      <Chip variant="outlined" label={`Connections ${connections.length}`} />
    </div>

    {assets.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr 1.4fr auto', gap: 10, marginTop: 14 }}>
      <TextField select size="small" label="도면 자산" value={selected?.id ?? ''} onChange={(event) => { setAssetId(event.target.value); setLayer(''); }}>
        {assets.map((asset) => <MenuItem key={asset.id} value={asset.id}>{asset.floor || '층 미확인'} · {asset.fileName}</MenuItem>)}
      </TextField>
      <TextField select size="small" label="Core layer" value={selectedLayer?.layer ?? ''} onChange={(event) => setLayer(event.target.value)}>
        {approvedLayers.map((item) => <MenuItem key={`${item.semantic}:${item.layer}`} value={item.layer}>{item.semantic} · {item.layer}</MenuItem>)}
      </TextField>
      <TextField size="small" label="Core ID" placeholder="예: STAIR-A" value={coreId} onChange={(event) => setCoreId(event.target.value)} />
      <TextField size="small" label="확인 근거" value={sourceLabel} onChange={(event) => setSourceLabel(event.target.value)} />
      <Button variant="contained" disabled={saving || !selectedLayer || !coreId.trim()} onClick={() => void save()}>{saving ? '저장 중' : '검증 저장'}</Button>
    </div>}

    {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
    {!approvedLayers.length && selected && <Alert severity="info" sx={{ mt: 1.5 }}>이 자산에는 Human Review에서 승인된 stair/elevator layer가 없습니다.</Alert>}

    <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
      {connections.map((connection) => <div key={`${connection.semantic}:${connection.coreId}`} style={{ display: 'grid', gridTemplateColumns: '120px 110px 1fr 150px 180px', gap: 10, alignItems: 'center', padding: 10, border: '1px solid #e5eaf0', borderRadius: 8 }}>
        <strong>{connection.coreId}</strong>
        <Chip size="small" variant="outlined" label={connection.semantic} />
        <span>{connection.floors.join(' → ') || '층 미연결'}</span>
        <span>drift {connection.maxPlanDriftM.toFixed(2)}m</span>
        <Chip size="small" color={connection.alignmentStatus === 'aligned' ? 'success' : 'warning'} variant="outlined" label={connection.alignmentStatus} />
      </div>)}
      {!connections.length && <div style={{ color: '#667085', fontSize: 13 }}>같은 Core ID가 2개 이상 층에서 검증되면 층간 정렬 상태를 확인할 수 있습니다.</div>}
    </div>

    <Alert severity="warning" sx={{ mt: 1.5 }}>Core ID와 층간 위치는 Human Review 값입니다. 정렬 허용오차 이내라도 계단 단수·참·경사, 승강로 치수, 방화구획, 피난 및 법규 적합성을 확정하지 않으며 production connectivity는 아직 false입니다.</Alert>
  </section>;
}
