import { CloudOffRounded, DownloadRounded, FactCheckRounded, Inventory2Rounded, PlayArrowRounded, ShieldRounded, WarningAmberRounded } from '@mui/icons-material';
import { Alert, Button, Chip, CircularProgress } from '@mui/material';
import { useState } from 'react';
import type { Settings } from '../types';
import { remoteMigrationDryRunService } from '../services/remoteMigrationDryRunService';
import { remoteMigrationHandoffService } from '../services/remoteMigrationHandoffService';
import type { RemoteMigrationPlan } from '../services/remoteMigrationPlanService';

interface Props {
  settings: Settings;
}

const cards: Array<{ key: keyof RemoteMigrationPlan['counts']; label: string }> = [
  { key: 'properties', label: 'PROPERTIES' },
  { key: 'objects', label: 'OBJECTS' },
  { key: 'assets', label: 'ASSET META' },
  { key: 'assetUploads', label: 'STORAGE UPLOADS' },
  { key: 'verificationCandidates', label: 'VERIFY CANDIDATES' },
  { key: 'verifications', label: 'VERIFIED HISTORY' },
  { key: 'reportSnapshots', label: 'REPORT SNAPSHOTS' },
  { key: 'blockers', label: 'BLOCKERS' },
];

const rehearsal = [
  '부동산 전용 Supabase 프로젝트 식별자와 GPS/Sports 프로젝트가 분리되어 있는지 확인',
  'Auth/profile migration → 최초 OWNER bootstrap → last-owner protection을 먼저 검증',
  'Property/Data RLS + private asset Storage migration 적용 전 SQL review 수행',
  '이 화면의 BLOCKER가 0인지 확인하고 dry-run JSON을 별도 보관',
  'VIEWER / EDITOR / ADMIN / OWNER 권한별 server-side RLS E2E 수행',
  'Storage 업로드 후 문서·미디어·3D metadata와 binary round-trip 확인',
  'cross-device 동일 데이터 확인 후에만 local-first → remote persistence 전환',
];

export default function RemoteMigrationReadinessPage({ settings }: Props) {
  const [plan, setPlan] = useState<RemoteMigrationPlan>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const runDryRun = async () => {
    setBusy(true); setError('');
    try {
      const result = await remoteMigrationDryRunService.run({ companySettings: settings });
      setPlan(result.plan);
    } catch (reason) {
      setPlan(undefined);
      setError(reason instanceof Error ? reason.message : 'Migration dry-run을 실행하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return <main style={{ padding: 28, maxWidth: 1380, margin: '0 auto' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 20 }}>
      <div>
        <p className="eyebrow">REMOTE MIGRATION · DRY-RUN ONLY</p>
        <h1 style={{ margin: '5px 0' }}>Migration Readiness Review</h1>
        <p style={{ margin: 0, color: '#667085', maxWidth: 760 }}>현재 브라우저 IndexedDB를 원격 Property/Data schema와 private Storage 구조로 옮겼을 때의 계획만 생성합니다. 이 화면은 Supabase에 쓰지 않습니다.</p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="contained" startIcon={busy ? <CircularProgress size={17} color="inherit" /> : <PlayArrowRounded />} disabled={busy} onClick={() => void runDryRun()}>Dry-Run 실행</Button>
        <Button variant="outlined" startIcon={<DownloadRounded />} disabled={!plan || busy} onClick={() => plan && remoteMigrationDryRunService.download(plan)}>Manifest JSON 다운로드</Button>
        <Button variant="outlined" startIcon={<Inventory2Rounded />} disabled={!plan || busy} onClick={() => plan && remoteMigrationHandoffService.download(plan)}>Handoff Bundle 다운로드</Button>
      </div>
    </header>

    {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError('')}>{error}</Alert>}
    <Alert severity="info" icon={<CloudOffRounded />} sx={{ mb: 2 }}><strong>NETWORK WRITES = 0</strong> · 원격 DB insert/update, Storage upload, Auth 변경을 수행하지 않습니다. 실제 배포 연결은 별도 승인 단계입니다.</Alert>

    {!plan && !busy && <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 14, padding: 28, textAlign: 'center', marginBottom: 16 }}>
      <ShieldRounded sx={{ fontSize: 44, color: '#073a69' }} />
      <h2 style={{ margin: '8px 0 6px' }}>현재 로컬 데이터로 사전 리허설</h2>
      <p style={{ margin: 0, color: '#667085' }}>Dry-Run 실행 후 이관 건수, Storage 업로드 예정량, 차단 사유를 확인할 수 있습니다.</p>
    </section>}

    {busy && <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 14, padding: 34, textAlign: 'center', marginBottom: 16 }}><CircularProgress size={28} /><p style={{ color: '#667085' }}>IndexedDB를 읽고 migration manifest를 계산하고 있습니다.</p></section>}

    {plan && <>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 10, marginBottom: 16 }}>
        {cards.map((card) => <div key={card.key} style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 14 }}><small style={{ color: '#667085' }}>{card.label}</small><strong style={{ display: 'block', marginTop: 3, fontSize: 27 }}>{plan.counts[card.key]}</strong></div>)}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.35fr) minmax(340px,.65fr)', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 14 }}>
          <section style={{ background: '#fff', border: `1px solid ${plan.readyForRemoteWrite ? '#b9d8c4' : '#edc5c5'}`, borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div><p className="eyebrow">MIGRATION GATE</p><h2 style={{ margin: '4px 0' }}>{plan.readyForRemoteWrite ? 'READY FOR REMOTE WRITE REVIEW' : 'BLOCKED BEFORE REMOTE WRITE'}</h2></div>
              <Chip color={plan.readyForRemoteWrite ? 'success' : 'error'} label={plan.readyForRemoteWrite ? 'BLOCKER 0' : `BLOCKER ${plan.blockers.length}`} />
            </div>
            <p style={{ color: '#667085', marginBottom: 0 }}>schema {plan.schemaVersion} · 생성 {new Date(plan.generatedAt).toLocaleString('ko-KR')} · dryRun={String(plan.dryRun)} · networkWrites={plan.networkWrites}</p>
          </section>

          <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 14, padding: 18 }}>
            <p className="eyebrow">BLOCKER REVIEW</p><h2 style={{ margin: '4px 0 12px' }}>차단 항목</h2>
            {!plan.blockers.length && <Alert severity="success"><strong>구조적 blocker가 없습니다.</strong> 이것은 실제 Supabase migration 승인이나 production READY를 의미하지 않습니다.</Alert>}
            {!!plan.blockers.length && <div style={{ display: 'grid', gap: 8 }}>{plan.blockers.map((blocker, index) => <div key={`${blocker.code}-${blocker.store}-${blocker.id ?? index}`} style={{ border: '1px solid #efcaca', background: '#fffafa', borderRadius: 10, padding: 12 }}><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}><Chip size="small" color="error" label={blocker.code} /><Chip size="small" variant="outlined" label={blocker.store} />{blocker.id && <Chip size="small" variant="outlined" label={blocker.id} />}</div><strong>{blocker.message}</strong>{blocker.propertyId && <small style={{ display: 'block', color: '#667085', marginTop: 4 }}>propertyId: {blocker.propertyId}</small>}</div>)}</div>}
          </section>

          <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 14, padding: 18 }}>
            <p className="eyebrow">STORAGE PLAN</p><h2 style={{ margin: '4px 0 12px' }}>Private Storage 업로드 예정</h2>
            {!plan.assetUploads.length && <p style={{ color: '#667085' }}>업로드 예정 asset이 없습니다.</p>}
            {!!plan.assetUploads.length && <div style={{ display: 'grid', gap: 7 }}>{plan.assetUploads.slice(0, 40).map((asset) => <div key={`${asset.resourceType}-${asset.id}`} style={{ display: 'grid', gridTemplateColumns: '110px minmax(0,1fr) 150px', gap: 10, padding: '9px 10px', border: '1px solid #e4e9ef', borderRadius: 9, alignItems: 'center', fontSize: 12 }}><strong>{asset.resourceType}</strong><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{asset.storagePath}</span><span>{asset.binarySource}{asset.fileSize != null ? ` · ${(asset.fileSize / 1024 / 1024).toFixed(1)} MiB` : ''}</span></div>)}</div>}
            {plan.assetUploads.length > 40 && <p style={{ color: '#667085', fontSize: 12 }}>외 {plan.assetUploads.length - 40}건은 JSON manifest에서 확인할 수 있습니다.</p>}
          </section>
        </div>

        <aside style={{ display: 'grid', gap: 14, position: 'sticky', top: 24 }}>
          <section style={{ background: '#10243f', color: '#fff', borderRadius: 14, padding: 18 }}>
            <p className="eyebrow" style={{ color: '#d7c8a7' }}>SAFETY BOUNDARY</p><h2 style={{ margin: '4px 0 12px' }}>실제 Remote Write는 비활성</h2>
            <div style={{ display: 'grid', gap: 8, fontSize: 13 }}><div>DB writes <strong style={{ float: 'right' }}>{plan.networkWrites}</strong></div><div>Storage writes <strong style={{ float: 'right' }}>0</strong></div><div>Auth writes <strong style={{ float: 'right' }}>0</strong></div><div>REMOTE AUTH <strong style={{ float: 'right' }}>NOT CONFIGURED</strong></div></div>
          </section>

          <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 14, padding: 18 }}>
            <p className="eyebrow">REHEARSAL CHECKLIST</p><h2 style={{ margin: '4px 0 12px' }}>실제 연결 전 순서</h2>
            <div style={{ display: 'grid', gap: 10 }}>{rehearsal.map((item, index) => <div key={item} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: 8, alignItems: 'start' }}><span style={{ width: 24, height: 24, display: 'grid', placeItems: 'center', borderRadius: 20, background: '#edf3f8', color: '#073a69', fontWeight: 800, fontSize: 12 }}>{index + 1}</span><span style={{ fontSize: 12, lineHeight: 1.55 }}>{item}</span></div>)}</div>
          </section>

          <Alert severity="warning" icon={<WarningAmberRounded />}>BLOCKER 0이어도 실제 backend, RLS E2E, Storage policy, cross-device 검증 전에는 Production READY로 승격하지 않습니다.</Alert>
          <Button variant="outlined" startIcon={<FactCheckRounded />} onClick={() => void runDryRun()} disabled={busy}>현재 데이터 다시 검사</Button>
        </aside>
      </section>
    </>}
  </main>;
}
