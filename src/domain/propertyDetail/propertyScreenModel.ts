import type { Property } from '../../types';
import { formatUnitPricePerPyeong, hubFactRows } from './propertyDetailModel';

/*
 * Pure view-model rules for the property screen masthead and the '근거 · 신뢰도' panel (2026-11-12 benchmark redesign).
 * Values come only from the Property record and the Data Room summary; nothing is inferred or promoted here.
 */

export type StatTag = '입력값' | '계산값' | '미입력';
export interface MastheadStat { label: string; value: string; tag: StatTag }

const positive = (value?: number) => typeof value === 'number' && Number.isFinite(value) && value > 0;

/** Five numbers under the title, like the key-stat strip on professional property pages. Each says where it came from. */
export function mastheadStats(property: Partial<Property>): MastheadStat[] {
  const facts = new Map(hubFactRows(property).map((row) => [row.label, row]));
  const fact = (label: string): MastheadStat => {
    const row = facts.get(label);
    return row && !row.missing ? { label, value: row.value, tag: '입력값' } : { label, value: '미입력', tag: '미입력' };
  };
  const unit: MastheadStat = positive(property.salePrice) && positive(property.landAreaPyeong)
    ? { label: '대지 평당가', value: formatUnitPricePerPyeong(property.salePrice! / property.landAreaPyeong!), tag: '계산값' }
    : { label: '대지 평당가', value: '계산 불가', tag: '미입력' };
  return [fact('매매가'), unit, fact('대지면적'), fact('연면적'), fact('용도지역')];
}

export interface TrustSummaryInput {
  officiallyVerified: number;
  unverified: number;
  verificationPending: number;
  requiredSourcePresent: number;
  requiredOfficiallyVerified: number;
  requiredDocumentTotal: number;
  reports: number;
  reportReady: boolean;
}

export type TrustTone = 'ok' | 'warn' | 'todo';
export interface TrustRow { key: string; label: string; value: string; ratio?: number; tone: TrustTone }

const ratioRow = (key: string, label: string, done: number, total: number): TrustRow => ({
  key, label, value: `${done}/${total}`, ratio: total > 0 ? Math.min(1, Math.max(0, done / total)) : 0, tone: total > 0 && done >= total ? 'ok' : done > 0 ? 'warn' : 'todo',
});

/** Rows of the 근거 · 신뢰도 panel. When the Data Room failed to load, its rows say so instead of showing zeros. */
export function trustRows(property: Partial<Property>, summary?: TrustSummaryInput): TrustRow[] {
  const facts = hubFactRows(property);
  const rows: TrustRow[] = [ratioRow('facts', '기본정보 입력', facts.filter((row) => !row.missing).length, facts.length)];
  if (!summary) return [...rows, { key: 'dataroom', label: 'Data Room 자료', value: '확인 불가', tone: 'todo' }];
  rows.push(ratioRow('required-source', '필수 문서 원본', summary.requiredSourcePresent, summary.requiredDocumentTotal));
  rows.push(ratioRow('required-verified', '필수 문서 공식확인', summary.requiredOfficiallyVerified, summary.requiredDocumentTotal));
  rows.push({ key: 'pending', label: '검증 대기', value: summary.verificationPending > 0 ? `${summary.verificationPending}건` : '없음', tone: summary.verificationPending > 0 ? 'warn' : 'ok' });
  rows.push({ key: 'status', label: '자료 상태', value: `공식확인 ${summary.officiallyVerified} · 미확인·추정 ${summary.unverified}`, tone: summary.unverified > 0 ? 'warn' : summary.officiallyVerified > 0 ? 'ok' : 'todo' });
  return rows;
}
