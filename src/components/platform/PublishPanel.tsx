import { useEffect, useState } from 'react';
import { Alert, Button } from '@mui/material';
import { OpenInNewRounded, PublicRounded, PublicOffRounded } from '@mui/icons-material';
import type { AddressLevel } from '../../domain/platform/publicListing';
import { PUBLISHABLE_ADDRESS_LEVELS, publishBlockers, type PublicListingSnapshot } from '../../domain/platform/publicListingSnapshot';
import { publicListingStore, type PublicListingRecord } from '../../services/publicListingStore';
import { remoteAuthGateway } from '../../services/authProviderService';
import { REMOTE_OPERATIONAL_MODE } from '../../services/operationalDataMode';
import type { Property } from '../../types';

/*
 * Staff-only publish / re-publish / withdraw panel on the workspace preview (phase 2, 2026-11-18). Not part of the
 * snapshot. It needs the Property row only for the store key and the last privacy check (publishBlockers); what gets
 * published is the snapshot the preview shows, frozen at that moment.
 */
export default function PublishPanel({ property, view, level, ready }: { property: Property; view: PublicListingSnapshot; level: AddressLevel; ready: boolean }) {
  const [record, setRecord] = useState<PublicListingRecord | null>();
  const [canPublish, setCanPublish] = useState(!REMOTE_OPERATIONAL_MODE);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ severity: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    publicListingStore.getForProperty(property.id).then((value) => { if (active) setRecord(value); }).catch(() => { if (active) setRecord(null); });
    if (REMOTE_OPERATIONAL_MODE) void remoteAuthGateway.getSession().then((session) => { if (active) setCanPublish(session?.role === 'owner' || session?.role === 'admin'); }).catch(() => undefined);
    return () => { active = false; };
  }, [property.id]);

  // Remote: samples never go public. Local (QA / demo): allowed, the sample label stays on the page.
  const blockers = publishBlockers(property, view, level, { allowNonOperational: publicListingStore.mode === 'local' });
  const published = record?.status === 'published';
  const url = record ? `${window.location.origin}/p/${record.publicId}` : '';
  const statusLabel = !record ? '미게시' : published ? `게시 중 · v${record.snapshotVersion}` : record.status === 'withdrawn' ? '게시 철회됨' : '준비 중';

  const run = async (action: 'publish' | 'withdraw') => {
    setBusy(true); setMessage(null);
    try {
      if (action === 'publish') {
        const next = await publicListingStore.publish(property.id, view, level);
        setRecord(next);
        setMessage({ severity: 'success', text: published ? '공개 화면을 지금 자료로 다시 만들었습니다.' : '게시했습니다. 아래 주소를 구매자에게 보내면 로그인 없이 열립니다.' });
      } else {
        await publicListingStore.withdraw(property.id);
        setRecord((current) => (current ? { ...current, status: 'withdrawn' } : current));
        setMessage({ severity: 'success', text: '게시를 철회했습니다. 공개 주소는 바로 \'게시가 끝난 매물\'로 바뀝니다.' });
      }
    } catch (reason) {
      setMessage({ severity: 'error', text: reason instanceof Error ? reason.message : '처리하지 못했습니다.' });
    } finally {
      setBusy(false);
    }
  };

  return <section className="publish-panel" aria-label="공개 게시">
    <div className="publish-panel-head">
      <h2>공개 게시 <span className={`publish-status status-${record ? record.status : 'none'}`}>{record === undefined ? '확인 중' : statusLabel}</span></h2>
      <div className="publish-panel-row">
        <Button variant="contained" size="small" startIcon={<PublicRounded />} disabled={busy || !ready || !canPublish || blockers.length > 0 || record === undefined || !PUBLISHABLE_ADDRESS_LEVELS.includes(level)} onClick={() => void run('publish')}>{published ? '지금 자료로 다시 게시' : '게시'}</Button>
        {published && <Button variant="outlined" size="small" color="error" startIcon={<PublicOffRounded />} disabled={busy || !canPublish} onClick={() => void run('withdraw')}>게시 철회</Button>}
      </div>
    </div>
    {published && <p className="publish-panel-row">공개 주소: <a href={url} target="_blank" rel="noreferrer">{url} <OpenInNewRounded sx={{ fontSize: 14, verticalAlign: 'middle' }} /></a></p>}
    {!canPublish && <p className="publish-panel-row">게시·철회는 대표(owner)·관리자(admin)만 할 수 있습니다.</p>}
    {blockers.length > 0 && <ul className="publish-blockers" aria-label="게시할 수 없는 이유">{blockers.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
    {publicListingStore.mode === 'local' && <p className="platform-footnote">로컬 모드: 이 브라우저에만 저장되는 시험 게시입니다. 운영에서는 서버에 저장되고, 게시 시점 화면이 그대로 고정됩니다.</p>}
    {message && <Alert severity={message.severity}>{message.text}</Alert>}
  </section>;
}
