import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, TextField } from '@mui/material';
import { ChatBubbleOutlineRounded, DescriptionOutlined, VerifiedUserOutlined } from '@mui/icons-material';
import PublicListingView from '../components/platform/PublicListingView';
import { inquiryProblems, INQUIRY_LIMITS, publicListingStore, type InquiryKind, type PublicListingRecord } from '../services/publicListingStore';
import '../platform.css';
import '../public-listing.css';

/*
 * Public listing page (phase 2, 2026-11-18). Served outside the workspace login: a buyer opens /p/<public id>.
 * Reads the published snapshot with the anon key only and renders nothing else; the internal property id is not
 * known to this page. Inquiries need explicit consent and are never readable back from here.
 */

const KIND_LABEL: Record<InquiryKind, string> = { inquiry: '매물 문의', report_request: '투자 보고서 요청' };

/**
 * 루인 #71 review: switching /p/A → /p/B must not show A's listing or keep A's open inquiry form (whose text would be
 * sent to B). The page body is keyed by the public id, so a new id remounts it: record, dialog and form state start
 * empty, and an answer for an earlier id is dropped (it is bound to the id it was asked for).
 */
export default function PublicListingPage() {
  const { publicId = '' } = useParams();
  return <PublicListingBody key={publicId} publicId={publicId} />;
}

function PublicListingBody({ publicId }: { publicId: string }) {
  const [loaded, setLoaded] = useState<{ publicId: string; record: PublicListingRecord | null; error: string } | null>(null);
  const [kind, setKind] = useState<InquiryKind | null>(null);
  const record = loaded && loaded.publicId === publicId ? loaded.record : undefined;
  const loadError = loaded && loaded.publicId === publicId ? loaded.error : '';

  useEffect(() => {
    let active = true;
    publicListingStore.getPublished(publicId)
      .then((value) => { if (active) setLoaded({ publicId, record: value, error: '' }); })
      .catch(() => { if (active) setLoaded({ publicId, record: null, error: '매물 정보를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.' }); });
    return () => { active = false; };
  }, [publicId]);

  useEffect(() => {
    document.title = record ? `${record.snapshot.title} · DA:ON 검증 매물` : 'DA:ON 검증 매물';
  }, [record]);

  const open = (next: InquiryKind) => setKind(next);
  const buttons = <>
    <Button variant="contained" size="large" startIcon={<ChatBubbleOutlineRounded />} onClick={() => open('inquiry')}>문의하기</Button>
    <Button variant="outlined" size="large" startIcon={<DescriptionOutlined />} onClick={() => open('report_request')}>투자 보고서 요청</Button>
  </>;

  return <div className="public-shell">
    <header className="public-topbar">
      <a className="public-brand" href={`/p/${encodeURIComponent(publicId)}`}><i>D</i><span><b>DA:ON</b><small>근거가 확인된 건물 매물</small></span></a>
      <span className="public-topbar-note"><VerifiedUserOutlined /><span>값마다 공적서류 근거를 표시합니다</span></span>
    </header>
    <main className="public-content">
      {record === undefined && <div className="public-empty"><CircularProgress /></div>}
      {record === null && <div className="public-empty">
        <h1>게시가 끝났거나 없는 매물입니다</h1>
        <p>{loadError || '이 주소의 매물은 지금 공개되어 있지 않습니다. 매물을 소개받은 중개사에게 문의해 주세요.'}</p>
      </div>}
      {record && <PublicListingView view={record.snapshot} actions={buttons}
        footnote={<p>{record.publishedAt ? `${record.publishedAt.slice(0, 10)} 게시 · ` : ''}게시 시점에 확인된 자료로 만든 화면입니다. 계약 전 권리관계와 현장을 다시 확인해야 합니다.</p>} />}
    </main>
    {record && <div className="public-mobile-cta">{buttons}</div>}
    <footer className="public-footer">
      DA:ON은 자료실에 실제로 있는 공적서류와 담당자가 확인한 값만 '공식확인'으로 표시합니다. 비교거래는 같은 건물 거래로 확정하지 않은 후보이며,
      평당가는 매매가를 대지면적으로 나눈 계산값입니다. 사진이 없는 매물의 그림은 실제 건물이 아닌 일러스트입니다.
    </footer>
    {record && kind && <InquiryDialog key={`${publicId}:${kind}`} publicId={publicId} kind={kind} title={record.snapshot.title} onClose={() => setKind(null)} />}
  </div>;
}

function InquiryDialog({ publicId, kind, title, onClose }: { publicId: string; kind: InquiryKind; title: string; onClose: () => void }) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const input = { kind, name, contact, message, consent };
  const problems = inquiryProblems(input);

  const submit = async () => {
    setBusy(true); setError('');
    try {
      await publicListingStore.submitInquiry(publicId, input);
      setDone(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '문의를 보내지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return <Dialog open onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="inquiry-title">
    <DialogTitle id="inquiry-title">{KIND_LABEL[kind]}</DialogTitle>
    <DialogContent sx={{ display: 'grid', gap: 1.5, pt: '4px !important' }}>
      {done ? <div className="inquiry-done" role="status"><b>접수되었습니다</b><span>담당 중개사가 남겨 주신 연락처로 연락드립니다.</span></div> : <>
        <p className="pl-lead" style={{ margin: 0 }}>{title}</p>
        <TextField size="small" label="이름" value={name} onChange={(event) => setName(event.target.value)} inputProps={{ maxLength: INQUIRY_LIMITS.name }} autoComplete="name" />
        <TextField size="small" label="연락처 (전화 또는 이메일)" value={contact} onChange={(event) => setContact(event.target.value)} inputProps={{ maxLength: INQUIRY_LIMITS.contact }} autoComplete="tel" />
        <TextField size="small" label={kind === 'report_request' ? '받아 보실 내용 (선택)' : '문의 내용 (선택)'} value={message} onChange={(event) => setMessage(event.target.value)} multiline minRows={3} inputProps={{ maxLength: INQUIRY_LIMITS.message }} />
        <p className="inquiry-consent">수집 항목: 이름, 연락처, 문의 내용 · 목적: 이 매물 문의에 대한 답변 · 보관: 연락처는 접수일로부터 90일 뒤 삭제, 이름·문의 내용은 문의 이력으로 3년 보관 뒤 삭제. 동의하지 않으면 문의를 보낼 수 없습니다.</p>
        <FormControlLabel control={<Checkbox checked={consent} onChange={(event) => setConsent(event.target.checked)} />} label="개인정보 수집·이용에 동의합니다 (필수)" />
        {error && <Alert severity="error">{error}</Alert>}
      </>}
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>{done ? '닫기' : '취소'}</Button>
      {!done && <Button variant="contained" disabled={busy || problems.length > 0} onClick={() => void submit()}>{busy ? '보내는 중…' : '보내기'}</Button>}
    </DialogActions>
  </Dialog>;
}
