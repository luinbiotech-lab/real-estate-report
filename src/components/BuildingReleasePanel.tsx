import { DownloadRounded, LockRounded, VerifiedRounded, ViewInArRounded } from '@mui/icons-material';
import { Alert, Button, Chip, CircularProgress } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { bimExternalHandoffService } from '../services/bimExternalHandoffService';
import { bimWriterAdapterService } from '../services/bimWriterAdapterService';
import { buildingProductionGateService } from '../services/buildingProductionGateService';
import { buildingReleaseCollaborationService, type BuildingReleaseReviewNote, type BuildingReleaseShare, type ReleaseLifecycleStatus } from '../services/buildingReleaseCollaborationService';
import { buildingReleaseCompareService } from '../services/buildingReleaseCompareService';
import { BUILDING_RELEASE_SNAPSHOT_VERSION, buildingReleaseSnapshotService, type BuildingReleaseSnapshot } from '../services/buildingReleaseSnapshotService';
import { gltfExportService } from '../services/gltfExportService';
import { productionRemoteViewerService } from '../services/productionRemoteViewerService';
import ReleaseShareWorkspace from './ReleaseShareWorkspace';

function downloadBlob(blob: Blob, fileName: string) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
function downloadText(content: string, fileName: string, mime = 'application/json;charset=utf-8') { downloadBlob(new Blob([content], { type: mime }), fileName); }

export default function BuildingReleasePanel({ assets }: { assets: DigitalTwinAsset[] }) {
  const gate = useMemo(() => buildingProductionGateService.build(assets), [assets]);
  const propertyId = assets[0]?.propertyId || '';
  const [snapshots, setSnapshots] = useState<BuildingReleaseSnapshot[]>([]);
  const [selected, setSelected] = useState<BuildingReleaseSnapshot>();
  const [verification, setVerification] = useState<{ valid: boolean; checksumValid: boolean; signatureValid: boolean; canonicalMatches: boolean }>();
  const [statuses, setStatuses] = useState<Record<string, ReleaseLifecycleStatus>>({});
  const [shares, setShares] = useState<BuildingReleaseShare[]>([]);
  const [notes, setNotes] = useState<BuildingReleaseReviewNote[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    if (!propertyId) { setSnapshots([]); setSelected(undefined); return; }
    const rows = await buildingReleaseSnapshotService.list(propertyId);
    setSnapshots(rows);
    const stateRows = await buildingReleaseCollaborationService.getSnapshotStates(propertyId);
    const stateMap: Record<string, ReleaseLifecycleStatus> = {};
    for (const row of stateRows.sort((a, b) => a.changedAt.localeCompare(b.changedAt))) stateMap[row.snapshotId] = row.status;
    setStatuses(stateMap);
    setSelected((current) => current && rows.some((row) => row.id === current.id) ? current : rows[0]);
  };

  useEffect(() => { void load(); }, [propertyId]);
  useEffect(() => {
    setVerification(undefined); setShares([]); setNotes([]);
    if (selected) {
      void buildingReleaseSnapshotService.verify(selected).then(setVerification).catch(() => setVerification({ valid: false, checksumValid: false, signatureValid: false, canonicalMatches: false }));
      void buildingReleaseCollaborationService.listShares(selected.id).then(setShares);
      void buildingReleaseCollaborationService.listReviewNotes(selected.id).then(setNotes);
    }
  }, [selected]);

  const previous = useMemo(() => selected ? snapshots.find((item) => item.createdAt < selected.createdAt) : undefined, [selected, snapshots]);
  const comparison = useMemo(() => selected && previous ? buildingReleaseCompareService.compare(previous, selected) : undefined, [selected, previous]);

  const createSnapshot = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const created = await buildingReleaseSnapshotService.create(assets);
      for (const snapshot of snapshots.filter((item) => (statuses[item.id] ?? 'current') === 'current')) await buildingReleaseCollaborationService.setSnapshotState(snapshot, 'superseded', `새 release ${created.id} 생성`);
      await buildingReleaseCollaborationService.setSnapshotState(created, 'current', '최신 release 생성');
      await load();
      setSelected(created);
      setNotice('불변 Building Release Snapshot을 생성하고 이전 CURRENT release를 superseded 처리했습니다.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Release Snapshot 생성에 실패했습니다.');
    } finally { setBusy(false); }
  };

  const exportSelected = (kind: 'snapshot' | 'viewer' | 'gltf' | 'glb' | 'bim' | 'writer') => {
    if (!selected) return;
    if (kind === 'snapshot') downloadText(JSON.stringify(selected, null, 2), `${selected.id}.json`);
    if (kind === 'viewer') downloadText(productionRemoteViewerService.toHtml(selected), `${selected.id}-remote-viewer-v2.html`, 'text/html;charset=utf-8');
    if (kind === 'gltf') downloadText(JSON.stringify(gltfExportService.toGltf(selected).gltf, null, 2), `${selected.id}.gltf`, 'model/gltf+json');
    if (kind === 'glb') downloadBlob(new Blob([gltfExportService.toGlb(selected)], { type: 'model/gltf-binary' }), `${selected.id}.glb`);
    if (kind === 'bim') downloadText(JSON.stringify(bimExternalHandoffService.build(selected), null, 2), `${selected.id}-bim-handoff.json`);
    if (kind === 'writer') downloadText(JSON.stringify(bimWriterAdapterService.buildHandoff(selected), null, 2), `${selected.id}-ifc-writer-handoff.json`);
  };

  return <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 18, marginBottom: 20 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div>
        <h2 style={{ margin: 0 }}>Building Release & Collaboration Layer</h2>
        <p style={{ margin: '6px 0 0', color: '#667085' }}>불변 Snapshot history, integrity, remote viewer v2, GLB/BIM handoff와 외부 공유·검토 이력을 한 곳에서 관리합니다.</p>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Chip size="small" color={gate.productionCandidateReady ? 'success' : 'warning'} label={gate.productionCandidateReady ? 'GATE READY' : 'GATE BLOCKED'} />
        <Chip size="small" variant="outlined" label={`Snapshots ${snapshots.length}`} />
        <Button variant="contained" startIcon={busy ? <CircularProgress size={16} /> : <LockRounded />} disabled={busy || !gate.productionCandidateReady} onClick={() => void createSnapshot()}>불변 Release Snapshot 생성</Button>
      </div>
    </div>

    {error && <Alert severity="error" sx={{ mt: 1.5 }} onClose={() => setError('')}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mt: 1.5 }} onClose={() => setNotice('')}>{notice}</Alert>}

    {snapshots.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px,.85fr) minmax(480px,1.8fr)', gap: 14, marginTop: 16 }}>
      <div style={{ display: 'grid', gap: 7, alignContent: 'start' }}>
        {snapshots.map((snapshot) => <button key={snapshot.id} onClick={() => setSelected(snapshot)} style={{ textAlign: 'left', padding: 10, borderRadius: 8, border: selected?.id === snapshot.id ? '2px solid #1e3a5f' : '1px solid #e5eaf0', background: '#fff', cursor: 'pointer' }}>
          <strong style={{ display: 'block', fontSize: 13 }}>{snapshot.id}</strong>
          <small style={{ color: '#667085' }}>{snapshot.createdAt}</small>
          <Chip size="small" sx={{ mt: .6 }} color={(statuses[snapshot.id] ?? 'current') === 'current' ? 'success' : 'default'} label={(statuses[snapshot.id] ?? 'current').toUpperCase()} />
        </button>)}
      </div>

      {selected && <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ border: '1px solid #e5eaf0', borderRadius: 10, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div><strong>{BUILDING_RELEASE_SNAPSHOT_VERSION}</strong><small style={{ display: 'block', color: '#667085', marginTop: 3 }}>{selected.id}</small></div>
            <Chip icon={<VerifiedRounded />} color={verification?.valid ? 'success' : verification ? 'error' : 'default'} label={verification?.valid ? 'CHECKSUM + SIGNATURE VALID' : verification ? 'INTEGRITY FAILED' : 'VERIFYING'} />
          </div>
          <p style={{ wordBreak: 'break-all', fontSize: 12, color: '#475467' }}>SHA-256: {selected.checksumHex}</p>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <Button size="small" variant="outlined" startIcon={<DownloadRounded />} onClick={() => exportSelected('snapshot')}>Snapshot JSON</Button>
            <Button size="small" variant="outlined" startIcon={<ViewInArRounded />} onClick={() => exportSelected('viewer')}>Remote Viewer v2</Button>
            <Button size="small" variant="outlined" onClick={() => exportSelected('gltf')}>glTF v2</Button>
            <Button size="small" variant="outlined" onClick={() => exportSelected('glb')}>GLB</Button>
            <Button size="small" variant="outlined" onClick={() => exportSelected('bim')}>BIM Handoff</Button>
            <Button size="small" variant="outlined" onClick={() => exportSelected('writer')}>IFC Writer Handoff</Button>
          </div>
        </div>

        {comparison && <Alert severity={comparison.checksumChanged ? 'info' : 'success'}>이전 Snapshot 대비 checksum {comparison.checksumChanged ? '변경됨' : '동일'} · floor Δ {comparison.floorCountDelta} · {comparison.floors.filter((floor) => Object.values(floor.delta).some((value) => value !== 0) || floor.added || floor.removed).length}개 층 geometry 변화</Alert>}

        <ReleaseShareWorkspace
          snapshot={selected}
          lifecycleStatus={statuses[selected.id] ?? 'current'}
          integrityValid={verification?.valid}
          shares={shares}
          notes={notes}
          onSharesChanged={setShares}
          onNotesChanged={setNotes}
        />
      </div>}
    </div>}

    {!snapshots.length && <Alert severity="info" sx={{ mt: 1.5 }}>모든 층이 CURRENT production candidate 상태가 되면 불변 release snapshot을 생성할 수 있습니다.</Alert>}
    <Alert severity="warning" sx={{ mt: 1.5 }}>공유는 현재 로컬 우선 foundation입니다. 조직 인증/권한 서버가 연결되기 전에는 public URL을 만들지 않습니다. constructionReady=false / legalBimReady=false / nativeIfcGenerated=false를 유지합니다.</Alert>
  </section>;
}
