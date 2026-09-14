import { DownloadRounded, LockRounded, VerifiedRounded, ViewInArRounded } from '@mui/icons-material';
import { Alert, Button, Chip, CircularProgress } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { bimExternalHandoffService } from '../services/bimExternalHandoffService';
import { buildingProductionGateService } from '../services/buildingProductionGateService';
import { BUILDING_RELEASE_SNAPSHOT_VERSION, buildingReleaseSnapshotService, type BuildingReleaseSnapshot } from '../services/buildingReleaseSnapshotService';
import { gltfExportService } from '../services/gltfExportService';
import { productionRemoteViewerService } from '../services/productionRemoteViewerService';

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function downloadText(content: string, fileName: string, mime = 'application/json;charset=utf-8') { downloadBlob(new Blob([content], { type: mime }), fileName); }

export default function BuildingReleasePanel({ assets }: { assets: DigitalTwinAsset[] }) {
  const gate = useMemo(() => buildingProductionGateService.build(assets), [assets]);
  const propertyId = assets[0]?.propertyId || '';
  const [snapshots, setSnapshots] = useState<BuildingReleaseSnapshot[]>([]);
  const [selected, setSelected] = useState<BuildingReleaseSnapshot>();
  const [verification, setVerification] = useState<{ valid: boolean; checksumValid: boolean; signatureValid: boolean; canonicalMatches: boolean }>();
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');

  const load = async () => {
    if (!propertyId) { setSnapshots([]); setSelected(undefined); return; }
    const rows = await buildingReleaseSnapshotService.list(propertyId); setSnapshots(rows); setSelected((current) => current && rows.some((row) => row.id === current.id) ? current : rows[0]);
  };
  useEffect(() => { void load(); }, [propertyId]);
  useEffect(() => { setVerification(undefined); if (selected) void buildingReleaseSnapshotService.verify(selected).then(setVerification).catch(() => setVerification({ valid: false, checksumValid: false, signatureValid: false, canonicalMatches: false })); }, [selected]);

  const createSnapshot = async () => {
    setBusy(true); setError(''); setNotice('');
    try { const created = await buildingReleaseSnapshotService.create(assets); await load(); setSelected(created); setNotice('불변 Building Release Snapshot을 생성하고 SHA-256 checksum + ECDSA P-256 signature를 저장했습니다.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Release Snapshot 생성에 실패했습니다.'); }
    finally { setBusy(false); }
  };

  const exportSelected = (kind: 'snapshot' | 'viewer' | 'gltf' | 'glb' | 'bim') => {
    if (!selected) return;
    if (kind === 'snapshot') downloadText(JSON.stringify(selected, null, 2), `${selected.id}.json`);
    if (kind === 'viewer') downloadText(productionRemoteViewerService.toHtml(selected), `${selected.id}-remote-viewer.html`, 'text/html;charset=utf-8');
    if (kind === 'gltf') downloadText(JSON.stringify(gltfExportService.toGltf(selected).gltf, null, 2), `${selected.id}.gltf`, 'model/gltf+json');
    if (kind === 'glb') downloadBlob(new Blob([gltfExportService.toGlb(selected)], { type: 'model/gltf-binary' }), `${selected.id}.glb`);
    if (kind === 'bim') downloadText(JSON.stringify(bimExternalHandoffService.build(selected), null, 2), `${selected.id}-bim-handoff.json`);
  };

  return <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 18, marginBottom: 20 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div><h2 style={{ margin: 0 }}>Building Release Snapshot / Immutable Handoff</h2><p style={{ margin: '6px 0 0', color: '#667085' }}>RELEASE READY 다층 candidate를 불변 Snapshot으로 저장하고 checksum/signature, production 전용 remote viewer, glTF/GLB, BIM/외부 3D handoff를 생성합니다.</p></div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip size="small" color={gate.productionCandidateReady ? 'success' : 'warning'} label={gate.productionCandidateReady ? 'GATE READY' : 'GATE BLOCKED'} />
        <Chip size="small" variant="outlined" label={`Snapshots ${snapshots.length}`} />
        <Button variant="contained" startIcon={busy ? <CircularProgress size={16} /> : <LockRounded />} disabled={busy || !gate.productionCandidateReady} onClick={() => void createSnapshot()}>불변 Release Snapshot 생성</Button>
      </div>
    </div>
    {error && <Alert severity="error" sx={{ mt: 1.5 }} onClose={() => setError('')}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mt: 1.5 }} onClose={() => setNotice('')}>{notice}</Alert>}

    {snapshots.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px,.8fr) minmax(420px,1.8fr)', gap: 14, marginTop: 16 }}>
      <div style={{ display: 'grid', gap: 7, alignContent: 'start' }}>{snapshots.map((snapshot) => <button key={snapshot.id} onClick={() => setSelected(snapshot)} style={{ textAlign: 'left', padding: 10, borderRadius: 8, border: selected?.id === snapshot.id ? '2px solid #1e3a5f' : '1px solid #e5eaf0', background: '#fff', cursor: 'pointer' }}><strong style={{ display: 'block', fontSize: 13 }}>{snapshot.id}</strong><small style={{ color: '#667085' }}>{snapshot.createdAt}</small></button>)}</div>
      {selected && <div style={{ border: '1px solid #e5eaf0', borderRadius: 10, padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><div><strong>{BUILDING_RELEASE_SNAPSHOT_VERSION}</strong><small style={{ display: 'block', color: '#667085', marginTop: 3 }}>{selected.id}</small></div><Chip icon={<VerifiedRounded />} color={verification?.valid ? 'success' : verification ? 'error' : 'default'} label={verification?.valid ? 'CHECKSUM + SIGNATURE VALID' : verification ? 'INTEGRITY FAILED' : 'VERIFYING'} /></div>
        <p style={{ wordBreak: 'break-all', fontSize: 12, color: '#475467' }}>SHA-256: {selected.checksumHex}</p>
        <p style={{ fontSize: 12, color: '#667085' }}>ECDSA P-256 · immutable=true · constructionReady=false · legalBimReady=false</p>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 12 }}>
          <Button size="small" variant="outlined" startIcon={<DownloadRounded />} onClick={() => exportSelected('snapshot')}>Snapshot JSON</Button>
          <Button size="small" variant="outlined" startIcon={<ViewInArRounded />} onClick={() => exportSelected('viewer')}>Remote Viewer HTML</Button>
          <Button size="small" variant="outlined" onClick={() => exportSelected('gltf')}>glTF</Button>
          <Button size="small" variant="outlined" onClick={() => exportSelected('glb')}>GLB</Button>
          <Button size="small" variant="outlined" onClick={() => exportSelected('bim')}>BIM Handoff JSON</Button>
        </div>
        <Alert severity="info" sx={{ mt: 1.5 }}>glTF/GLB browser adapter는 wall partitions/junction fills를 review mesh로 내보냅니다. core hole을 가진 slab은 release/BIM metadata가 authoritative이며 브라우저 adapter가 임의 triangulation하지 않습니다.</Alert>
      </div>}
    </div>}
    {!snapshots.length && <Alert severity="info" sx={{ mt: 1.5 }}>모든 층이 CURRENT production candidate 상태가 되면 불변 release snapshot을 생성할 수 있습니다.</Alert>}
    <Alert severity="warning" sx={{ mt: 1.5 }}>서명은 이 브라우저 프로필에서 생성·보관되는 로컬 ECDSA P-256 signing identity를 사용합니다. 조직 PKI/공인 전자서명과 동일하지 않습니다. Native IFC는 이 단계에서 생성하지 않으며 BIM handoff manifest를 전문 IFC writer/geometry kernel로 전달해야 합니다.</Alert>
  </section>;
}