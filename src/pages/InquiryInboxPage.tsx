import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Chip, CircularProgress, MenuItem, Select } from '@mui/material';
import { CallRounded, DescriptionOutlined, ChatBubbleOutlineRounded, MailOutlineRounded, OpenInNewRounded } from '@mui/icons-material';
import { publicListingStore, type InquiryStatus, type ReceivedInquiry } from '../services/publicListingStore';
import { contactHref, INQUIRY_KIND_LABEL, INQUIRY_STATUS_LABEL } from '../domain/platform/publicInquiry';
import '../platform.css';
import '../public-listing.css';

/*
 * 매수 문의함 (2026-11-24, pilot readiness: "시범 사용이 가능한 수준까지 사이트 완성").
 * Buyers' inquiries from the public listing page (/p/:publicId) were stored but no screen showed them. Staff see them
 * here (RLS: active staff read, editors update the status), newest unanswered first. A contact erased by the
 * retention job shows as such; nothing is guessed back.
 */

type Filter = 'open' | InquiryStatus | 'all';
const FILTER_LABEL: Record<Filter, string> = { open: '처리 전', new: '새 문의', answered: '답변함', closed: '종료', all: '전체' };

const when = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function InquiryInboxPage() {
  const [rows, setRows] = useState<ReceivedInquiry[]>();
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('open');
  const [saving, setSaving] = useState<string>();

  const load = useCallback(() => {
    setError('');
    publicListingStore.listInquiries().then(setRows).catch((reason) => { setRows([]); setError(reason instanceof Error ? reason.message : '문의를 불러오지 못했습니다.'); });
  }, []);
  useEffect(load, [load]);

  const counts = useMemo(() => {
    const value: Record<Filter, number> = { open: 0, new: 0, answered: 0, closed: 0, all: rows?.length ?? 0 };
    for (const row of rows ?? []) { value[row.status] += 1; if (row.status === 'new') value.open += 1; }
    return value;
  }, [rows]);
  const shown = (rows ?? []).filter((row) => filter === 'all' || (filter === 'open' ? row.status === 'new' : row.status === filter));

  const change = async (row: ReceivedInquiry, status: InquiryStatus) => {
    setSaving(row.id); setError('');
    try {
      await publicListingStore.setInquiryStatus(row.id, status);
      setRows((list) => list?.map((item) => (item.id === row.id ? { ...item, status } : item)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '상태를 바꾸지 못했습니다.');
    } finally { setSaving(undefined); }
  };

  return <div className="inbox-page">
    <header className="page-header"><div>
      <p className="eyebrow">물건 · 매수 문의</p>
      <h1>매수 문의함</h1>
      <p>공개 매물 화면에서 들어온 문의와 투자 보고서 요청입니다. 연락한 뒤 &lsquo;답변함&rsquo;으로 바꿔 두면 처리 전 목록에서 빠집니다.</p>
    </div></header>

    <div className="inbox-filters" role="group" aria-label="문의 상태">
      {(Object.keys(FILTER_LABEL) as Filter[]).filter((key) => key !== 'new').map((key) => <Chip key={key} label={`${FILTER_LABEL[key]} ${counts[key]}`} color={filter === key ? 'primary' : 'default'} variant={filter === key ? 'filled' : 'outlined'} onClick={() => setFilter(key)} />)}
    </div>
    {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>다시 시도</Button>}>{error}</Alert>}
    {!rows && <div className="center"><CircularProgress /></div>}
    {rows && !shown.length && !error && <p className="home-empty inbox-empty">{rows.length ? `${FILTER_LABEL[filter]} 문의가 없습니다.` : '아직 들어온 문의가 없습니다. 매물을 게시하면 공개 화면의 문의 버튼으로 접수됩니다.'}</p>}

    <ul className="inbox-list">{shown.map((row) => {
      const href = contactHref(row.contact);
      return <li key={row.id} className={`inbox-card status-${row.status}`}>
        <div className="inbox-card-head">
          <span className={`inbox-kind kind-${row.kind}`}>{row.kind === 'report_request' ? <DescriptionOutlined /> : <ChatBubbleOutlineRounded />}{INQUIRY_KIND_LABEL[row.kind]}</span>
          <time dateTime={row.createdAt}>{when(row.createdAt)}</time>
        </div>
        <div className="inbox-card-who">
          <strong>{row.name}</strong>
          {row.contact
            ? (href ? <a href={href} className="inbox-contact">{href.startsWith('mailto:') ? <MailOutlineRounded /> : <CallRounded />}{row.contact}</a> : <span className="inbox-contact">{row.contact}</span>)
            : <span className="inbox-contact erased">연락처 보관 기간이 지나 삭제됨</span>}
        </div>
        {row.message ? <p className="inbox-message">{row.message}</p> : <p className="inbox-message empty">남긴 내용 없음</p>}
        <div className="inbox-card-foot">
          {row.propertyId
            ? <Link to={`/listing/${encodeURIComponent(row.propertyId)}`} className="inbox-listing"><OpenInNewRounded /><span>{row.listingTitle || '게시 매물'}</span></Link>
            : <span className="inbox-listing missing">게시 정보가 없는 매물</span>}
          <Select size="small" value={row.status} disabled={saving === row.id} onChange={(event) => void change(row, event.target.value as InquiryStatus)} aria-label={`${row.name} 문의 상태`}>
            {(Object.keys(INQUIRY_STATUS_LABEL) as InquiryStatus[]).map((value) => <MenuItem key={value} value={value}>{INQUIRY_STATUS_LABEL[value]}</MenuItem>)}
          </Select>
        </div>
      </li>;
    })}</ul>
    <p className="platform-footnote">문의자는 동의 화면에서 수집 항목·목적·보관 기간을 확인하고 보냈습니다. 이 화면의 연락처는 답변 목적 외에 쓰지 않습니다.</p>
  </div>;
}
