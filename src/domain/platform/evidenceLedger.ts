/*
 * Evidence ledger + buyer due-diligence checklist (2026-11-15, 루치오: "직방, 다방, 네이버부동산 등과의 차별성이 필요해").
 * General listing portals check that a listing exists (네이버 확인매물 / KISO 부동산매물검증센터, 직방 현장 조사,
 * 다방 알고리즘); none of them ties each building value to an official document. DA:ON shows, per value, which document
 * backs it and when a person confirmed it, and gives the buyer a checklist of what is still open before a purchase.
 * Pure functions over Data Room rows: the validator and the page share them. Nothing here marks anything verified.
 */
import type { DataSourceType, PropertyDataSource, PropertyVerification, RiskCheckItem } from '../propertyDataRoom/types';
import { publicSourceLabel } from './publicListingSnapshot';

const SOURCE_LABEL: Record<DataSourceType, string> = {
  manual: '사용자 입력', excel_import: '엑셀 등록', public_api: '공공 API', official_document: '공식 문서',
  map_provider: '지도 공급자', market_data: '시장 자료', calculated: '시스템 계산', ai: 'AI', external: '외부 자료',
};

const day = (value?: string) => (value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : '');

export interface FactEvidence {
  fieldKey: string;
  /** Date a person confirmed the value (verification row), YYYY-MM-DD. */
  verifiedAt: string;
  /** Where the value came from, newest first: "건축물대장(공식 문서, 2026-11-10 자료)". */
  sources: string[];
  /** The same sources as a buyer may see them: allowlisted document names only, never a file name or note (루인 #65). */
  publicSources: string[];
}

/** Evidence for one field: only a 'verified' verification row counts as confirmation; sources are listed as found. */
export function factEvidence(fieldKey: string, propertyId: string, verifications: PropertyVerification[], sources: PropertyDataSource[]): FactEvidence | undefined {
  const verification = verifications
    .filter((row) => row.propertyId === propertyId && row.fieldKey === fieldKey && row.status === 'verified')
    .sort((a, b) => String(b.verifiedAt ?? b.updatedAt).localeCompare(String(a.verifiedAt ?? a.updatedAt)))[0];
  if (!verification) return undefined;
  const rows = sources
    .filter((row) => row.propertyId === propertyId && row.fieldKey === fieldKey)
    .sort((a, b) => String(b.sourceDate ?? b.collectedAt).localeCompare(String(a.sourceDate ?? a.collectedAt)));
  const labels = [...new Set(rows.map((row) => { const date = day(row.sourceDate ?? row.collectedAt); return `${row.sourceName || '출처 이름 없음'}(${[SOURCE_LABEL[row.sourceType] ?? row.sourceType, date && `${date} 자료`].filter(Boolean).join(', ')})`; }))];
  const publicLabels = [...new Set(rows.map((row) => publicSourceLabel(row.sourceName, SOURCE_LABEL[row.sourceType] ?? '출처', day(row.sourceDate ?? row.collectedAt))))];
  return { fieldKey, verifiedAt: day(verification.verifiedAt ?? verification.updatedAt), sources: labels.slice(0, 3), publicSources: publicLabels.slice(0, 3) };
}

export type CheckState = 'done' | 'partial' | 'open';

export interface DueDiligenceRow {
  key: string;
  label: string;
  state: CheckState;
  detail: string;
}

export interface DueDiligenceInput {
  /** Required official documents in display order. */
  documents: Array<{ type: string; label: string }>;
  present: readonly string[];
  verified: readonly string[];
  pendingCandidates: number;
  /** Labels of public facts not yet entered (publicFacts().pending). */
  pendingFacts: readonly string[];
  /** Latest risk review, if any. Shown as a review result, never as a legal opinion. */
  risk?: { checks: RiskCheckItem[]; personConfirmed: boolean };
}

/** What a buyer should know is settled or still open before buying. Every row says why. */
export function dueDiligenceRows(input: DueDiligenceInput): DueDiligenceRow[] {
  const rows: DueDiligenceRow[] = input.documents.map(({ type, label }) => {
    if (input.verified.includes(type)) return { key: `doc:${type}`, label, state: 'done', detail: '원본 확보 · 공식확인 완료' };
    if (input.present.includes(type)) return { key: `doc:${type}`, label, state: 'partial', detail: '원본은 있지만 공식확인 전' };
    return { key: `doc:${type}`, label, state: 'open', detail: '원본 미확보' };
  });
  rows.push(input.pendingCandidates > 0
    ? { key: 'candidates', label: '자동 수집 후보값 검토', state: 'open', detail: `사람이 아직 확인하지 않은 값 ${input.pendingCandidates}건` }
    : { key: 'candidates', label: '자동 수집 후보값 검토', state: 'done', detail: '검토 대기 없음' });
  rows.push(input.pendingFacts.length
    ? { key: 'facts', label: '공개 화면 정보', state: 'open', detail: `확인 중: ${input.pendingFacts.join(', ')}` }
    : { key: 'facts', label: '공개 화면 정보', state: 'done', detail: '공개 화면 항목 모두 입력 (서류 대조 여부는 값마다 표시)' });
  if (input.risk) {
    const open = input.risk.checks.filter((check) => check.status === 'review' || check.status === 'missing');
    const basis = input.risk.personConfirmed ? '검토 결과' : '자동 검토 결과 · 사람 확인 전';
    rows.push(open.length
      ? { key: 'risk', label: '규제·리스크 점검', state: input.risk.personConfirmed ? 'partial' : 'open', detail: `${basis}: 확인 필요 ${open.length}건 (${open.slice(0, 3).map((check) => check.label).join(', ')}${open.length > 3 ? ' 외' : ''})` }
      : { key: 'risk', label: '규제·리스크 점검', state: input.risk.personConfirmed ? 'done' : 'partial', detail: `${basis}: 확인 필요 항목 없음` });
  } else rows.push({ key: 'risk', label: '규제·리스크 점검', state: 'open', detail: '아직 점검하지 않음' });
  return rows;
}

export function dueDiligenceProgress(rows: DueDiligenceRow[]) {
  return { done: rows.filter((row) => row.state === 'done').length, total: rows.length };
}
