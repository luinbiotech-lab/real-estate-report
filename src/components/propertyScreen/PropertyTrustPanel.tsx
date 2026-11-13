import { DescriptionOutlined, PictureAsPdfOutlined, PostAddRounded, VisibilityOutlined } from '@mui/icons-material';
import { Button } from '@mui/material';
import { trustRows, type TrustSummaryInput } from '../../domain/propertyDetail/propertyScreenModel';
import type { Property } from '../../types';

interface Props {
  property: Property;
  summary?: TrustSummaryInput;
  latestReportVersion?: number;
  creating: boolean;
  onOpenVerification: () => void;
  onOpenDocuments: () => void;
  onReport: () => void;
  onProposal: () => void;
  onDetailReport: () => void;
}

/**
 * DA:ON's own column: where each value stands (filled, official, pending) and the report it feeds.
 * It only reads the Data Room summary; approving evidence stays in the 자료 검증 tab.
 */
export default function PropertyTrustPanel({ property, summary, latestReportVersion, creating, onOpenVerification, onOpenDocuments, onReport, onProposal, onDetailReport }: Props) {
  const rows = trustRows(property, summary);
  return <aside className="property-trust-panel" aria-label="근거 · 신뢰도">
    <h2>근거 · 신뢰도</h2>
    <p className="trust-note">값마다 출처와 검증 상태를 따로 관리합니다. 자동으로 '확인됨'이 되지 않습니다.</p>
    <ul className="trust-rows">{rows.map((row) => <li key={row.key} className={`trust-row tone-${row.tone}`}>
      <span className="trust-label">{row.label}</span><b>{row.value}</b>
      {row.ratio !== undefined && <span className="trust-bar" aria-hidden="true"><i style={{ width: `${Math.round(row.ratio * 100)}%` }} /></span>}
    </li>)}</ul>
    <div className="trust-links">
      {(summary?.verificationPending ?? 0) > 0 && <button type="button" onClick={onOpenVerification}>자료 검증 열기</button>}
      <button type="button" onClick={onOpenDocuments}>문서 · 출처 보기</button>
    </div>
    <section className="trust-report">
      <h3>보고서</h3>
      <p>{latestReportVersion ? `전문 보고서 v${latestReportVersion}` : '아직 만든 보고서가 없습니다.'}{summary && !summary.reportReady ? ' · 필수 자료 확인 전' : ''}</p>
      <Button fullWidth variant="contained" startIcon={latestReportVersion ? <VisibilityOutlined /> : <PostAddRounded />} disabled={creating} onClick={onReport}>{creating ? '생성 중…' : latestReportVersion ? '보고서 보기' : '보고서 만들기'}</Button>
      <div className="trust-report-docs"><Button size="small" startIcon={<PictureAsPdfOutlined />} onClick={onProposal}>1P 제안서</Button><Button size="small" startIcon={<DescriptionOutlined />} onClick={onDetailReport}>투자분석보고서</Button></div>
    </section>
  </aside>;
}
