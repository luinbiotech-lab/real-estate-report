import { BlockRounded, DownloadRounded, OpenInBrowserRounded, RefreshRounded, SearchRounded, ShareRounded } from '@mui/icons-material';
import { Alert, Button, Chip, CircularProgress, InputAdornment, MenuItem, TextField } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { propertyRepository } from '../repositories/propertyRepository';
import { buildingReleaseCollaborationService, type BuildingReleaseReviewNote, type BuildingReleaseShare } from '../services/buildingReleaseCollaborationService';
import { buildingReleaseSnapshotService } from '../services/buildingReleaseSnapshotService';
import { releaseSharePackageService } from '../services/releaseSharePackageService';
import type { Property } from '../types';

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

export default function ExternalShareCenterPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [shares, setShares] = useState<BuildingReleaseShare[]>([]);
  const [notes, setNotes] = useState<BuildingReleaseReviewNote[]>([]);
  const [status, setStatus] = useState<'all' | BuildingReleaseShare['status']>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setError('');
    try {
      const [propertyRows, shareRows, noteRows] = await Promise.all([
        propertyRepository.getAll(),
        buildingReleaseCollaborationService.listAllShares(),
        buildingReleaseCollaborationService.listAllReviewNotes(),
      ]);
      setProperties(propertyRows);
      setShares(shareRows);
      setNotes(noteRows);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '외부 공유 이력을 불러오지 못했습니다.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const propertyMap = useMemo(() => new Map(properties.map((property) => [property.id, property])), [properties]);
  const openReviewBySnapshot = useMemo(() => {
    const map = new Map<string, number>();
    notes.filter((note) => note.status === 'open').forEach((note) => map.set(note.snapshotId, (map.get(note.snapshotId) ?? 0) + 1));
    return map;
  }, [notes]);
  const counts = useMemo(() => ({
    total: shares.length,
    active: shares.filter((item) => item.status === 'active').length,
    expired: shares.filter((item) => item.status === 'expired').length,
    revoked: shares.filter((item) => item.status === 'revoked').length,
    openReview: notes.filter((item) => item.status === 'open').length,
  }), [shares, notes]);
  const filtered = useMemo(() => shares.filter((share) => {
    if (status !== 'all' && share.status !== status) return false;
    const property = propertyMap.get(share.propertyId);
    const haystack = `${property?.name ?? ''} ${property?.address ?? ''} ${share.note ?? ''} ${share.snapshotId}`.toLowerCase();
    return !query.trim() || haystack.includes(query.trim().toLowerCase());
  }), [shares, status, query, propertyMap]);

  const getSnapshot = async (share: BuildingReleaseShare) => {
    const snapshots = await buildingReleaseSnapshotService.list(share.propertyId);
    const snapshot = snapshots.find((item) => item.id === share.snapshotId);
    if (!snapshot) throw new Error('공유에 연결된 Release Snapshot을 찾을 수 없습니다.');
    return snapshot;
  };

  const exportManifest = async (share: BuildingReleaseShare) => {
    setBusyId(share.id); setError(''); setNotice('');
    try {
      const snapshot = await getSnapshot(share);
      downloadText(JSON.stringify(buildingReleaseCollaborationService.buildShareManifest(snapshot, share), null, 2), `${snapshot.id}-share-${share.id}.json`);
      setNotice('Share Manifest를 다시 생성했습니다.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Manifest를 만들지 못했습니다.'); }
    finally { setBusyId(''); }
  };

  const exportHtml = async (share: BuildingReleaseShare) => {
    setBusyId(share.id); setError(''); setNotice('');
    try {
      const snapshot = await getSnapshot(share);
      downloadText(releaseSharePackageService.toHtml(snapshot, share), `${snapshot.id}-share-${share.id}.html`, 'text/html;charset=utf-8');
      setNotice('Standalone 원격검토 HTML을 생성했습니다.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '공유 HTML을 만들지 못했습니다.'); }
    finally { setBusyId(''); }
  };

  const revoke = async (share: BuildingReleaseShare) => {
    setBusyId(share.id); setError(''); setNotice('');
    try {
      await buildingReleaseCollaborationService.revokeShare(share);
      await load();
      setNotice('공유를 회수했습니다.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '공유를 회수하지 못했습니다.'); }
    finally { setBusyId(''); }
  };

  if (loading) return <div className="center"><CircularProgress /><p>외부 공유 감사대장을 준비하는 중입니다.</p></div>;

  return <main style={{ padding: 28, maxWidth: 1380, margin: '0 auto' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 22 }}>
      <div><p className="eyebrow">EXTERNAL SHARE · ACCESS POLICY · REVIEW AUDIT</p><h1 style={{ margin: '5px 0' }}>외부 공유 센터</h1><p style={{ margin: 0, color: '#667085' }}>모든 물건의 Release Snapshot 공유, 만료, 회수와 미해결 검토 의견을 한 화면에서 관리합니다.</p></div>
      <Button startIcon={<RefreshRounded />} onClick={() => void load()}>새로고침</Button>
    </header>

    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(130px,1fr))', gap: 10, marginBottom: 18 }}>
      {[
        ['전체 공유', counts.total], ['ACTIVE', counts.active], ['EXPIRED', counts.expired], ['REVOKED', counts.revoked], ['미해결 검토', counts.openReview],
      ].map(([label, value]) => <div key={String(label)} style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, padding: 14 }}><small style={{ color: '#667085' }}>{label}</small><strong style={{ display: 'block', fontSize: 28, marginTop: 4 }}>{value}</strong></div>)}
    </section>

    <section style={{ background: '#10243f', color: '#fff', borderRadius: 12, padding: 16, marginBottom: 14, display: 'grid', gridTemplateColumns: '1fr 180px', gap: 10 }}>
      <TextField size="small" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="물건명 · 주소 · 공유대상 · Snapshot 검색" sx={{ background: '#fff', borderRadius: 1 }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> }} />
      <TextField select size="small" value={status} onChange={(event) => setStatus(event.target.value as typeof status)} sx={{ background: '#fff', borderRadius: 1 }}><MenuItem value="all">전체 상태</MenuItem><MenuItem value="active">ACTIVE</MenuItem><MenuItem value="expired">EXPIRED</MenuItem><MenuItem value="revoked">REVOKED</MenuItem></TextField>
    </section>

    <section style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.1fr 110px 160px 110px 120px 310px', gap: 10, padding: '11px 14px', background: '#f7f9fb', color: '#667085', fontSize: 12, fontWeight: 700 }}><span>물건 / Snapshot</span><span>공유대상</span><span>상태</span><span>만료</span><span>다운로드</span><span>검토</span><span>작업</span></div>
      {!filtered.length && <div style={{ padding: 34, textAlign: 'center', color: '#667085' }}>조건에 맞는 외부 공유가 없습니다.</div>}
      {filtered.map((share) => {
        const property = propertyMap.get(share.propertyId);
        const openReview = openReviewBySnapshot.get(share.snapshotId) ?? 0;
        return <div key={share.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.1fr 110px 160px 110px 120px 310px', gap: 10, padding: '13px 14px', borderTop: '1px solid #edf0f4', alignItems: 'center' }}>
          <div><strong style={{ display: 'block', fontSize: 13 }}>{property?.name || share.propertyId}</strong><small style={{ color: '#667085' }}>{property?.address || '주소 미등록'}</small><small style={{ display: 'block', color: '#98a2b3', marginTop: 3 }}>{share.snapshotId}</small></div>
          <div><strong style={{ fontSize: 13 }}>{share.note || '외부 검토 공유'}</strong><small style={{ display: 'block', color: '#667085', marginTop: 3 }}>{new Date(share.createdAt).toLocaleString('ko-KR')}</small></div>
          <Chip size="small" color={share.status === 'active' ? 'success' : share.status === 'expired' ? 'warning' : 'default'} label={share.status.toUpperCase()} />
          <small>{share.expiresAt ? new Date(share.expiresAt).toLocaleString('ko-KR') : '만료 없음'}</small>
          <Chip size="small" variant="outlined" label={share.allowDownload ? '허용' : '차단'} />
          <Chip size="small" color={openReview ? 'warning' : 'success'} variant="outlined" label={openReview ? `${openReview} OPEN` : 'CLEAR'} />
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}><Button size="small" startIcon={<OpenInBrowserRounded />} disabled={busyId === share.id} onClick={() => void exportHtml(share)}>공유 HTML</Button><Button size="small" startIcon={<DownloadRounded />} disabled={busyId === share.id} onClick={() => void exportManifest(share)}>Manifest</Button>{share.status === 'active' && <Button size="small" color="warning" startIcon={<BlockRounded />} disabled={busyId === share.id} onClick={() => void revoke(share)}>회수</Button>}</div>
        </div>;
      })}
    </section>

    <Alert severity="info" icon={<ShareRounded />} sx={{ mt: 1.5 }}>현재는 브라우저 로컬 감사대장입니다. public URL과 서버 인증이 연결되면 이 화면의 ACTIVE/EXPIRED/REVOKED 상태가 실제 외부 접근권한과 동기화되는 구조로 확장합니다.</Alert>
  </main>;
}
