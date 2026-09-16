import { BackupRounded, CloudSyncRounded, DownloadRounded, FactCheckRounded, RestoreRounded, UploadFileRounded, WarningAmberRounded } from '@mui/icons-material';
import { Alert, Button, Chip, CircularProgress } from '@mui/material';
import { useState, type ChangeEvent } from 'react';
import { localBackupService, type BackupPreview, type DaonLocalBackup } from '../services/localBackupService';
import { remoteMigrationDryRunService, type RemoteMigrationDryRunResult } from '../services/remoteMigrationDryRunService';

function downloadJson(content: string, fileName: string) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function DataBackupCenterPage() {
  const [backup, setBackup] = useState<DaonLocalBackup>();
  const [preview, setPreview] = useState<BackupPreview>();
  const [dryRun, setDryRun] = useState<RemoteMigrationDryRunResult>();
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const createBackup = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const payload = await localBackupService.create();
      const stamp = payload.createdAt.replace(/[:.]/g, '-');
      downloadJson(localBackupService.stringify(payload), `daon-local-backup-${stamp}.json`);
      setNotice(`전체 로컬 백업을 생성했습니다. ${localBackupService.preview(payload).recordCount}개 레코드를 포함합니다.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '백업을 만들지 못했습니다.'); }
    finally { setBusy(false); }
  };

  const runMigrationDryRun = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await remoteMigrationDryRunService.run();
      setDryRun(result);
      setNotice(result.plan.readyForRemoteWrite
        ? `원격 전환 사전점검을 완료했습니다. ${result.plan.counts.blockers}개 blocker, network write ${result.plan.networkWrites}건입니다.`
        : `원격 전환 사전점검을 완료했습니다. ${result.plan.counts.blockers}개 blocker를 먼저 해결해야 합니다.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '원격 전환 사전점검을 실행하지 못했습니다.'); }
    finally { setBusy(false); }
  };

  const selectBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const parsed = localBackupService.parse(await file.text());
      setBackup(parsed); setPreview(localBackupService.preview(parsed)); setFileName(file.name);
    } catch (reason) {
      setBackup(undefined); setPreview(undefined); setFileName('');
      setError(reason instanceof Error ? reason.message : '백업 파일을 읽지 못했습니다.');
    } finally { setBusy(false); event.target.value = ''; }
  };

  const restore = async (mode: 'merge' | 'replace') => {
    if (!backup) return;
    if (mode === 'replace' && !window.confirm('현재 로컬 데이터를 백업 파일 기준으로 교체합니다. 이 작업 전 현재 상태를 별도 백업하는 것을 권장합니다. 계속할까요?')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await localBackupService.restore(backup, mode);
      setNotice(`${mode === 'merge' ? '병합' : '전체 교체'} 복원을 완료했습니다. ${result.restoredRecords}개 레코드와 ${result.restoredLocalStorage}개 로컬 설정을 처리했습니다. 새로고침 후 복원 상태를 확인하세요.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '복원하지 못했습니다.'); }
    finally { setBusy(false); }
  };

  return <main style={{ padding: 28, maxWidth: 1320, margin: '0 auto' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 20 }}>
      <div><p className="eyebrow">LOCAL DATA SAFETY · FULL EXPORT / RESTORE</p><h1 style={{ margin: '5px 0' }}>Data Backup Center</h1><p style={{ margin: 0, color: '#667085' }}>부동산 플랫폼의 브라우저 로컬 데이터를 보존·복원하고, 원격 운영 전환 전 데이터 이관 상태를 사전점검합니다.</p></div>
      <Button variant="contained" startIcon={<BackupRounded />} disabled={busy} onClick={() => void createBackup()}>전체 백업 다운로드</Button>
    </header>

    {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError('')}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setNotice('')}>{notice}</Alert>}

    <Alert severity="warning" icon={<WarningAmberRounded />} sx={{ mb: 2 }}><strong>현재 단계는 local-first입니다.</strong> 브라우저 저장소를 지우거나 PC를 교체하기 전에 백업 파일을 별도 보관하세요. 원격 전환 사전점검은 읽기 전용 dry-run이며 Supabase·Storage·외부 서버에 데이터를 쓰지 않습니다.</Alert>

    <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 14, padding: 18, marginBottom: 16 }} data-testid="remote-migration-dry-run">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div><p className="eyebrow">REMOTE MIGRATION · DRY RUN ONLY</p><h2 style={{ margin: '4px 0' }}>원격 전환 사전점검</h2><p style={{ margin: 0, color: '#667085', fontSize: 13 }}>IndexedDB의 Property/Data Room/Agent/3D/Report 데이터를 원격 schema와 private Storage 구조로 옮길 수 있는지 검사합니다. 실제 원격 쓰기는 실행하지 않습니다.</p></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<FactCheckRounded />} disabled={busy} onClick={() => void runMigrationDryRun()}>Dry Run 실행</Button>
          <Button variant="contained" startIcon={<DownloadRounded />} disabled={!dryRun || busy} onClick={() => dryRun && remoteMigrationDryRunService.download(dryRun.plan)}>Manifest 다운로드</Button>
        </div>
      </div>
      <Alert severity="info" icon={<CloudSyncRounded />} sx={{ mt: 1.5 }}>회사 설정은 전체 <code>settings</code> store를 자동 이관하지 않습니다. signing identity 등 내부 설정 혼입을 막기 위해 production 연결 시 명시적으로 선택된 회사 설정만 별도 이관합니다.</Alert>
      {!dryRun && !busy && <div style={{ padding: 22, marginTop: 14, border: '1px dashed #ccd5df', borderRadius: 10, textAlign: 'center', color: '#667085' }}>아직 사전점검을 실행하지 않았습니다. 이 작업은 로컬 데이터를 읽기만 하며 네트워크 write는 0건입니다.</div>}
      {busy && !dryRun && <div style={{ padding: 24, textAlign: 'center' }}><CircularProgress size={24} /></div>}
      {dryRun && <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 8 }}>
          {[
            ['NETWORK WRITES', dryRun.plan.networkWrites],
            ['PROPERTY', dryRun.plan.counts.properties],
            ['OBJECT', dryRun.plan.counts.objects],
            ['ASSET', dryRun.plan.counts.assets],
            ['SNAPSHOT', dryRun.plan.counts.reportSnapshots],
            ['BLOCKER', dryRun.plan.counts.blockers],
          ].map(([label, value]) => <div key={String(label)} style={{ border: '1px solid #e4e9ef', borderRadius: 9, padding: 10, background: label === 'NETWORK WRITES' ? '#f7f9fb' : '#fff' }}><small style={{ color: '#667085' }}>{label}</small><strong style={{ display: 'block', fontSize: 22 }}>{value}</strong></div>)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Chip color={dryRun.plan.readyForRemoteWrite ? 'success' : 'warning'} label={dryRun.plan.readyForRemoteWrite ? 'READY FOR REMOTE WRITE REVIEW' : 'BLOCKED'} />
          <Chip variant="outlined" label={dryRun.plan.schemaVersion} />
          <Chip variant="outlined" label={`Storage upload ${dryRun.plan.counts.assetUploads}`} />
          <Chip variant="outlined" label={`Verification ${dryRun.plan.counts.verifications}`} />
        </div>
        {dryRun.plan.blockers.length > 0 && <div style={{ border: '1px solid #f0d2a8', background: '#fffaf2', borderRadius: 10, padding: 12 }}>
          <strong>Blocker 확인</strong>
          <div style={{ display: 'grid', gap: 7, marginTop: 9 }}>{dryRun.plan.blockers.slice(0, 20).map((blocker, index) => <div key={`${blocker.code}-${blocker.store}-${blocker.id ?? index}`} style={{ fontSize: 12, padding: 9, background: '#fff', borderRadius: 8, border: '1px solid #f2dfc3' }}><strong>{blocker.code}</strong> · {blocker.store}{blocker.id ? ` / ${blocker.id}` : ''}<span style={{ display: 'block', color: '#667085', marginTop: 3 }}>{blocker.message}</span></div>)}</div>
          {dryRun.plan.blockers.length > 20 && <small style={{ display: 'block', marginTop: 8, color: '#667085' }}>나머지 {dryRun.plan.blockers.length - 20}건은 다운로드한 manifest에서 확인하세요.</small>}
        </div>}
      </div>}
    </section>

    <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(340px,.75fr)', gap: 16, alignItems: 'start' }}>
      <div style={{ display: 'grid', gap: 14 }}>
        <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 14, padding: 18 }}>
          <p className="eyebrow">BACKUP SCOPE</p><h2 style={{ margin: '4px 0 12px' }}>백업 범위</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
            {['물건 / 회사설정', 'Data Room 문서·미디어', '검증 / Provenance', '보고서 Snapshot', '3D / Digital Twin', 'Agent / Review / Risk', '외부 공유 이력', 'Room / Renovation', 'daon: 로컬 운영상태'].map((item) => <div key={item} style={{ padding: 11, background: '#f7f9fb', borderRadius: 9, fontSize: 12 }}>{item}</div>)}
          </div>
          <Alert severity="info" sx={{ mt: 1.5 }}>Blob/ArrayBuffer 원본도 Base64로 포함합니다. 미디어와 3D 파일이 많으면 백업 JSON의 용량이 커질 수 있습니다.</Alert>
        </section>

        <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 14, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}><div><p className="eyebrow">RESTORE PREVIEW</p><h2 style={{ margin: '4px 0' }}>백업 파일 검사</h2><p style={{ margin: 0, color: '#667085', fontSize: 13 }}>복원 전에 스키마와 레코드 수를 먼저 확인합니다.</p></div><Button component="label" startIcon={<UploadFileRounded />}>백업 파일 선택<input hidden type="file" accept="application/json,.json" onChange={(event) => void selectBackup(event)} /></Button></div>
          {busy && <div style={{ padding: 24, textAlign: 'center' }}><CircularProgress size={24} /></div>}
          {!busy && !preview && <div style={{ padding: 26, marginTop: 14, border: '1px dashed #ccd5df', borderRadius: 10, textAlign: 'center', color: '#667085' }}>선택된 백업 파일이 없습니다.</div>}
          {preview && <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
            <div style={{ padding: 13, background: '#10243f', color: '#fff', borderRadius: 10 }}><strong>{fileName}</strong><small style={{ display: 'block', marginTop: 5, color: '#d7c8a7' }}>{preview.schemaVersion} · 생성 {new Date(preview.createdAt).toLocaleString('ko-KR')}</small></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8 }}>{[['STORE', preview.storeCount], ['RECORD', preview.recordCount], ['LOCAL STATE', preview.localStorageCount], ['DB VERSION', preview.databaseVersion]].map(([label, value]) => <div key={String(label)} style={{ border: '1px solid #e4e9ef', borderRadius: 9, padding: 10 }}><small style={{ color: '#667085' }}>{label}</small><strong style={{ display: 'block', fontSize: 22 }}>{value}</strong></div>)}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{preview.storeCounts.slice(0, 14).map((store) => <Chip key={store.name} size="small" variant="outlined" label={`${store.name} ${store.count}`} />)}</div>
          </div>}
        </section>
      </div>

      <aside style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 14, padding: 18, position: 'sticky', top: 24 }}>
        <p className="eyebrow">RESTORE MODE</p><h2 style={{ margin: '4px 0 12px' }}>복원 실행</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ padding: 12, border: '1px solid #dfe5ec', borderRadius: 10 }}><strong>MERGE</strong><p style={{ margin: '5px 0 10px', color: '#667085', fontSize: 12 }}>현재 데이터를 유지하면서 같은 key는 백업 값으로 갱신하고 없는 레코드는 추가합니다.</p><Button fullWidth variant="outlined" startIcon={<RestoreRounded />} disabled={!backup || busy} onClick={() => void restore('merge')}>병합 복원</Button></div>
          <div style={{ padding: 12, border: '1px solid #f1c7c7', borderRadius: 10, background: '#fffafa' }}><strong>REPLACE</strong><p style={{ margin: '5px 0 10px', color: '#667085', fontSize: 12 }}>현재 로컬 store와 daon: 운영상태를 비우고 백업 파일 기준으로 교체합니다. 실행 전 확인창이 표시됩니다.</p><Button fullWidth color="error" variant="outlined" startIcon={<RestoreRounded />} disabled={!backup || busy} onClick={() => void restore('replace')}>전체 교체 복원</Button></div>
        </div>
        <Button fullWidth sx={{ mt: 1.2 }} startIcon={<DownloadRounded />} disabled={busy} onClick={() => void createBackup()}>복원 전 현재 백업</Button>
      </aside>
    </section>
  </main>;
}
