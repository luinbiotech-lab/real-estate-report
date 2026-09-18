import { CancelOutlined, CheckCircleOutlineRounded, ContentCopyRounded, DownloadRounded, LinkRounded, LockClockRounded, OpenInBrowserRounded, TaskAltRounded } from '@mui/icons-material';
import { Alert, Button, Chip, FormControlLabel, Switch, TextField } from '@mui/material';
import { useMemo, useState } from 'react';
import type { BuildingReleaseSnapshot } from '../services/buildingReleaseSnapshotService';
import { buildingReleaseCollaborationService, type BuildingReleaseReviewNote, type BuildingReleaseShare, type ReleaseLifecycleStatus } from '../services/buildingReleaseCollaborationService';
import { externalShareProviderService } from '../services/externalShareProviderService';
import { releaseSharePackageService } from '../services/releaseSharePackageService';
import { remoteExternalShareGateway, type RemoteShareRecord } from '../services/remoteExternalShareGateway';

function downloadText(content: string, fileName: string, mime = 'application/json;charset=utf-8') {
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

function shortToken(value: string) {
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

export default function ReleaseShareWorkspace({ snapshot, lifecycleStatus, integrityValid, shares, notes, onSharesChanged, onNotesChanged }: {
  snapshot: BuildingReleaseSnapshot;
  lifecycleStatus: ReleaseLifecycleStatus;
  integrityValid?: boolean;
  shares: BuildingReleaseShare[];
  notes: BuildingReleaseReviewNote[];
  onSharesChanged: (rows: BuildingReleaseShare[]) => void;
  onNotesChanged: (rows: BuildingReleaseReviewNote[]) => void;
}) {
  const [shareDays, setShareDays] = useState('7');
  const [allowDownload, setAllowDownload] = useState(false);
  const [shareNote, setShareNote] = useState('');
  const [reviewer, setReviewer] = useState('');
  const [reviewBody, setReviewBody] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [remoteShares, setRemoteShares] = useState<RemoteShareRecord[]>([]);
  const [issuedPublicUrl, setIssuedPublicUrl] = useState('');

  const localProvider = useMemo(() => externalShareProviderService.getLocal(), []);
  const remoteProvider = useMemo(() => externalShareProviderService.getRemote(), []);
  const activeShares = useMemo(() => shares.filter((item) => item.status === 'active'), [shares]);
  const openNotes = useMemo(() => notes.filter((item) => item.status === 'open'), [notes]);
  const canShare = integrityValid === true && lifecycleStatus === 'current';

  const refreshShares = async () => onSharesChanged(await buildingReleaseCollaborationService.listShares(snapshot.id));
  const refreshNotes = async () => onNotesChanged(await buildingReleaseCollaborationService.listReviewNotes(snapshot.id));
  const refreshRemoteShares = async () => {
    const rows = await remoteExternalShareGateway.listForSnapshot(snapshot.id);
    setRemoteShares(rows);
    return rows;
  };

  const createRemoteShare = async () => {
    setBusy(true); setError(''); setNotice(''); setIssuedPublicUrl('');
    try {
      if (!canShare) throw new Error('CURRENT 상태이며 무결성 검증을 통과한 Snapshot만 공유할 수 있습니다.');
      const days = Number(shareDays);
      const expiresAt = Number.isFinite(days) && days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : undefined;
      const issued = await remoteExternalShareGateway.issue({
        snapshot,
        expiresAt,
        allowDownload,
        recipientNote: shareNote.trim() || undefined,
      });
      setIssuedPublicUrl(issued.publicUrl);
      await refreshRemoteShares();
      setNotice('REMOTE / PUBLIC URL을 발급했습니다. 서버 만료와 원격 회수가 적용됩니다.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'REMOTE / PUBLIC URL을 발급하지 못했습니다.');
    } finally { setBusy(false); }
  };

  const revokeRemoteShare = async (share: RemoteShareRecord) => {
    setBusy(true); setError(''); setNotice('');
    try {
      await remoteExternalShareGateway.revoke(share.remoteShareId);
      await refreshRemoteShares();
      setNotice('REMOTE / PUBLIC 공유를 서버에서 회수했습니다. 이후 token resolve가 차단됩니다.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'REMOTE / PUBLIC 공유를 회수하지 못했습니다.');
    } finally { setBusy(false); }
  };

  const copyPublicUrl = async () => {
    if (!issuedPublicUrl) return;
    try {
      await navigator.clipboard.writeText(issuedPublicUrl);
      setNotice('Public URL을 복사했습니다.');
    } catch {
      setError('브라우저에서 Public URL 복사를 허용하지 않았습니다.');
    }
  };

  const createShare = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      if (!canShare) throw new Error('CURRENT 상태이며 무결성 검증을 통과한 Snapshot만 공유할 수 있습니다.');
      const days = Number(shareDays);
      const expiresAt = Number.isFinite(days) && days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : undefined;
      const share = await buildingReleaseCollaborationService.createShare(snapshot, { expiresAt, allowDownload, note: shareNote });
      downloadText(JSON.stringify(buildingReleaseCollaborationService.buildShareManifest(snapshot, share), null, 2), `${snapshot.id}-share-${share.id}.json`);
      setShareNote('');
      await refreshShares();
      setNotice('LOCAL / OFFLINE 읽기 전용 공유 정책을 생성했습니다. Manifest가 함께 내려받아졌습니다.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '공유 정책을 생성하지 못했습니다.');
    } finally { setBusy(false); }
  };

  const revokeShare = async (share: BuildingReleaseShare) => {
    setBusy(true); setError(''); setNotice('');
    try {
      await buildingReleaseCollaborationService.revokeShare(share);
      await refreshShares();
      setNotice('LOCAL / OFFLINE 감사상태를 REVOKED로 변경했습니다. 이미 전달된 HTML은 원격 차단되지 않습니다.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '공유를 회수하지 못했습니다.');
    } finally { setBusy(false); }
  };

  const copyToken = async (share: BuildingReleaseShare) => {
    try {
      await navigator.clipboard.writeText(share.token);
      setNotice('공유 토큰을 복사했습니다.');
    } catch {
      setError('브라우저에서 클립보드 복사를 허용하지 않았습니다.');
    }
  };

  const exportShareHtml = (share: BuildingReleaseShare) => {
    try {
      downloadText(releaseSharePackageService.toHtml(snapshot, share), `${snapshot.id}-share-${share.id}.html`, 'text/html;charset=utf-8');
      setNotice('LOCAL / OFFLINE 읽기 전용 원격검토 HTML 패키지를 생성했습니다.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '공유 HTML을 생성하지 못했습니다.');
    }
  };

  const addNote = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      await buildingReleaseCollaborationService.addReviewNote(snapshot, reviewer, reviewBody);
      setReviewBody('');
      await refreshNotes();
      setNotice('검토 코멘트를 등록했습니다.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '검토 코멘트를 저장하지 못했습니다.');
    } finally { setBusy(false); }
  };

  const resolveNote = async (note: BuildingReleaseReviewNote) => {
    setBusy(true); setError(''); setNotice('');
    try {
      await buildingReleaseCollaborationService.resolveReviewNote(note);
      await refreshNotes();
      setNotice('검토 항목을 해결 처리했습니다.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '검토 항목을 해결 처리하지 못했습니다.');
    } finally { setBusy(false); }
  };

  return <section style={{ border: '1px solid #dfe5ec', borderRadius: 12, overflow: 'hidden', background: '#fbfcfe' }}>
    <div style={{ padding: '16px 18px', background: '#10243f', color: '#fff', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <div><small style={{ color: '#d7c8a7', letterSpacing: '.12em' }}>EXTERNAL SHARE · REMOTE REVIEW</small><h3 style={{ margin: '5px 0 0' }}>외부 공유 · 원격 검토</h3></div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Chip size="small" sx={{ color: '#fff', borderColor: 'rgba(255,255,255,.35)' }} variant="outlined" icon={canShare ? <CheckCircleOutlineRounded /> : <LockClockRounded />} label={canShare ? 'SHARE READY' : 'SHARE BLOCKED'} />
        <Chip size="small" sx={{ color: '#fff', borderColor: 'rgba(255,255,255,.35)' }} variant="outlined" label={`ACTIVE ${activeShares.length}`} />
        <Chip size="small" sx={{ color: '#fff', borderColor: 'rgba(255,255,255,.35)' }} variant="outlined" label={`OPEN REVIEW ${openNotes.length}`} />
      </div>
    </div>

    <div style={{ padding: 16, display: 'grid', gap: 14 }}>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
        <div style={{ border: '1px solid #b7d8c2', borderRadius: 10, padding: 12, background: '#fff' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong>{localProvider.label}</strong><Chip size="small" color="success" label="READY" /></div><p style={{ margin: '6px 0 0', color: '#667085', fontSize: 12 }}>Standalone HTML · Manifest · 로컬 감사이력. 실제 public URL과 remote revoke는 제공하지 않습니다.</p></div>
        <div style={{ border: '1px solid #b7d8c2', borderRadius: 10, padding: 12, background: '#fff' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong>{remoteProvider.label}</strong><Chip size="small" color="success" label="READY" /></div><p style={{ margin: '6px 0 8px', color: '#667085', fontSize: 12 }}>{remoteProvider.reason}</p><Button size="small" variant="contained" disabled={busy || !canShare} onClick={() => void createRemoteShare()}>Public URL 발급</Button></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8 }}>
        {[
          ['01', '공유 준비', integrityValid ? '무결성 PASS' : '무결성 확인 필요', integrityValid],
          ['02', '접근 정책', '읽기 전용 · 만료 · 다운로드', true],
          ['03', '전달/회수', `${activeShares.length}개 활성 공유`, activeShares.length > 0],
          ['04', '검토 루프', `${openNotes.length}개 미해결`, openNotes.length === 0],
        ].map(([step, title, detail, ok]) => <div key={String(step)} style={{ border: '1px solid #e4e9ef', borderRadius: 10, padding: 11, background: '#fff' }}><small style={{ color: '#9a7c45', fontWeight: 700 }}>{step}</small><strong style={{ display: 'block', marginTop: 3, fontSize: 13 }}>{title}</strong><span style={{ display: 'block', color: '#667085', fontSize: 11, marginTop: 4 }}>{detail}</span><Chip size="small" sx={{ mt: .8 }} color={ok ? 'success' : 'warning'} variant="outlined" label={ok ? 'READY' : 'CHECK'} /></div>)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px,.9fr) minmax(420px,1.4fr)', gap: 12 }}>
        <div style={{ border: '1px solid #e4e9ef', borderRadius: 10, padding: 14, background: '#fff' }}>
          <strong>ACCESS POLICY · LOCAL PACKAGE</strong>
          <p style={{ margin: '4px 0 12px', color: '#667085', fontSize: 12 }}>외부 URL 연결 전에도 공유 정책과 감사 이력을 먼저 고정합니다.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8 }}>
            <TextField size="small" label="만료(일)" value={shareDays} onChange={(event) => setShareDays(event.target.value)} />
            <TextField size="small" label="전달 메모 / 대상" value={shareNote} onChange={(event) => setShareNote(event.target.value)} placeholder="예: 매수 검토팀 / 1차 실사" />
          </div>
          <FormControlLabel sx={{ mt: .5 }} control={<Switch checked={allowDownload} onChange={(event) => setAllowDownload(event.target.checked)} />} label="원본 다운로드 허용" />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="contained" size="small" startIcon={<LinkRounded />} disabled={busy || !canShare} onClick={() => void createShare()}>LOCAL 공유 패키지 생성</Button>
            <Chip size="small" variant="outlined" label="READ ONLY" />
            <Chip size="small" variant="outlined" label={allowDownload ? 'DOWNLOAD ON' : 'DOWNLOAD OFF'} />
          </div>
          {!canShare && <Alert severity="warning" sx={{ mt: 1.2 }}>CURRENT Snapshot + checksum/signature 검증이 완료되어야 새 공유를 만들 수 있습니다.</Alert>}
          {issuedPublicUrl && <Alert severity="success" sx={{ mt: 1.2 }}>
            <strong>REMOTE Public URL 발급 완료</strong>
            <div style={{ overflowWrap: 'anywhere', marginTop: 5, fontSize: 12 }}>{issuedPublicUrl}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <Button size="small" variant="outlined" onClick={() => void copyPublicUrl()}>URL 복사</Button>
              <Button size="small" variant="outlined" href={issuedPublicUrl} target="_blank" rel="noreferrer">열기</Button>
            </div>
          </Alert>}
        </div>

        <div style={{ border: '1px solid #e4e9ef', borderRadius: 10, padding: 14, background: '#fff' }}>
          <strong>SHARE HISTORY · LOCAL / OFFLINE</strong>
          <p style={{ margin: '4px 0 10px', color: '#667085', fontSize: 12 }}>활성·만료·회수 이력이 Snapshot에 귀속됩니다. 각 공유는 서버 없이 열 수 있는 원격검토 HTML로 내보낼 수 있습니다.</p>
          {!shares.length && <div style={{ padding: 14, background: '#f7f9fb', borderRadius: 8, color: '#667085', fontSize: 12 }}>아직 생성된 공유가 없습니다.</div>}
          <div style={{ display: 'grid', gap: 7 }}>{shares.slice(0, 6).map((share) => <div key={share.id} style={{ border: '1px solid #edf0f4', borderRadius: 8, padding: 10, display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
            <div><div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}><Chip size="small" color={share.status === 'active' ? 'success' : share.status === 'expired' ? 'warning' : 'default'} label={share.status.toUpperCase()} /><strong style={{ fontSize: 12 }}>{share.note || '외부 검토 공유'}</strong></div><small style={{ display: 'block', color: '#667085', marginTop: 5 }}>token {shortToken(share.token)} · expires {share.expiresAt ? new Date(share.expiresAt).toLocaleString('ko-KR') : '없음'} · download {share.allowDownload ? '허용' : '차단'}</small></div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}><Button size="small" startIcon={<OpenInBrowserRounded />} onClick={() => exportShareHtml(share)}>공유 HTML</Button><Button size="small" startIcon={<ContentCopyRounded />} onClick={() => void copyToken(share)}>토큰</Button><Button size="small" startIcon={<DownloadRounded />} onClick={() => downloadText(JSON.stringify(buildingReleaseCollaborationService.buildShareManifest(snapshot, share), null, 2), `${snapshot.id}-share-${share.id}.json`)}>Manifest</Button>{share.status === 'active' && <Button size="small" color="warning" startIcon={<CancelOutlined />} disabled={busy} onClick={() => void revokeShare(share)}>로컬 회수</Button>}</div>
          </div>)}</div>
        </div>
      </div>

      <div style={{ border: '1px solid #d5e7da', borderRadius: 10, padding: 14, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div><strong>REMOTE SHARE HISTORY</strong><p style={{ margin: '4px 0 0', color: '#667085', fontSize: 12 }}>서버에서 발급된 공유만 표시합니다. raw token은 목록에 저장·반환하지 않습니다.</p></div>
          <Button size="small" variant="outlined" disabled={busy} onClick={() => void refreshRemoteShares().catch((reason) => setError(reason instanceof Error ? reason.message : '원격 공유 목록을 불러오지 못했습니다.'))}>원격 목록 새로고침</Button>
        </div>
        {!remoteShares.length && <div style={{ marginTop: 10, padding: 12, background: '#f7f9fb', borderRadius: 8, color: '#667085', fontSize: 12 }}>로그인 후 새로고침하면 이 Snapshot의 REMOTE 공유 이력이 표시됩니다.</div>}
        <div style={{ display: 'grid', gap: 7, marginTop: 10 }}>{remoteShares.slice(0, 8).map((share) => <div key={share.remoteShareId} style={{ border: '1px solid #edf0f4', borderRadius: 8, padding: 10, display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
          <div><Chip size="small" color={share.status === 'active' ? 'success' : share.status === 'expired' ? 'warning' : 'default'} label={share.status.toUpperCase()} /><small style={{ display: 'block', color: '#667085', marginTop: 5 }}>created {new Date(share.createdAt).toLocaleString('ko-KR')} · expires {share.expiresAt ? new Date(share.expiresAt).toLocaleString('ko-KR') : '없음'} · download {share.allowDownload ? '허용' : '차단'}</small></div>
          {share.status === 'active' && <Button size="small" color="warning" disabled={busy} onClick={() => void revokeRemoteShare(share)}>REMOTE 회수</Button>}
        </div>)}</div>
      </div>

      <div style={{ border: '1px solid #e4e9ef', borderRadius: 10, padding: 14, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><div><strong>REVIEW LOOP</strong><p style={{ margin: '4px 0 0', color: '#667085', fontSize: 12 }}>외부 검토 의견을 Snapshot 버전에 묶어 보관합니다.</p></div><Chip size="small" variant="outlined" label={`${openNotes.length} OPEN`} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr auto', gap: 8, marginTop: 10 }}><TextField size="small" label="검토자" value={reviewer} onChange={(event) => setReviewer(event.target.value)} /><TextField size="small" label="검토 코멘트" value={reviewBody} onChange={(event) => setReviewBody(event.target.value)} /><Button size="small" variant="outlined" disabled={busy} onClick={() => void addNote()}>등록</Button></div>
        <div style={{ display: 'grid', gap: 7, marginTop: 10 }}>{notes.slice(0, 6).map((note) => <div key={note.id} style={{ padding: 9, background: note.status === 'open' ? '#fffaf0' : '#f7f9fb', border: '1px solid #eceff3', borderRadius: 8, display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}><div><div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Chip size="small" color={note.status === 'open' ? 'warning' : 'success'} variant="outlined" label={note.status.toUpperCase()} /><strong style={{ fontSize: 12 }}>{note.author}</strong><small style={{ color: '#98a2b3' }}>{new Date(note.createdAt).toLocaleString('ko-KR')}</small></div><div style={{ marginTop: 5, fontSize: 13 }}>{note.body}</div></div>{note.status === 'open' && <Button size="small" startIcon={<TaskAltRounded />} disabled={busy} onClick={() => void resolveNote(note)}>해결</Button>}</div>)}</div>
      </div>

      <Alert severity="info"><strong>REMOTE / PUBLIC Provider는 production Supabase에 연결되어 있습니다.</strong> Public URL 발급·서버 만료·remote revoke는 REMOTE AUTH 로그인 후 사용할 수 있습니다. LOCAL standalone HTML은 별도 파일이므로 기존처럼 원격 차단되지 않습니다.</Alert>
    </div>
  </section>;
}