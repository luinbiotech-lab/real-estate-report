import type { Property } from '../../types';
import type { PropertyDataSource } from '../propertyDataRoom/types';
import { formatUnitPricePerPyeong } from './propertyDetailModel';

/*
 * 시세 위치 (price position) for the property screen, modelled on Redfin/Zillow "price insights":
 * where the subject's asking land unit price sits against the structured comparable rows in the Data Room.
 * Rules (MASTER/locked policy): comparable rows are provided-document candidates, never confirmed same-building sales;
 * the subject value is a calculation from the entered asking price (호가) — a different basis from a closed trade;
 * nothing is shown as 0 when it is missing, and no position is computed without both sides.
 */

export interface MarketPoint { label: string; tradeDate: string; landUnitPrice: number; salePrice: number; landAreaPyeong: number }

export interface MarketPosition {
  points: MarketPoint[];
  count: number;
  min: number;
  max: number;
  median: number;
  latestTradeDate: string;
  /** 매매가(호가) ÷ 대지면적 — 계산값, or null when either input is missing. */
  subjectUnitPrice: number | null;
  /** Subject vs comparable median, percent (rounded to 0.1), or null when not computable. */
  deltaPct: number | null;
  band: 'below' | 'within' | 'above' | 'unknown';
  headline: string;
  basis: string[];
  verificationStatus?: string;
}

/** True only for a real calendar date in YYYY-MM-DD (rejects 2026-13-01, 2026-02-30); shape alone is not enough (루인 #60). */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const positive = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function readMarketPoints(sources: PropertyDataSource[], propertyId: string): { points: MarketPoint[]; source?: PropertyDataSource } {
  const source = sources.find((item) => item.propertyId === propertyId
    && item.resourceType === 'comparable_transaction_set'
    && item.fieldKey === 'nearbyTransactions');
  const rows = Array.isArray(source?.metadata?.rows) ? source!.metadata!.rows as unknown[] : [];
  const points = rows.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const value = row as Record<string, unknown>;
    const label = typeof value.label === 'string' ? value.label.trim() : '';
    const tradeDate = isCalendarDate(value.tradeDate) ? value.tradeDate : '';
    const landUnitPrice = positive(value.landUnitPrice);
    if (!label || !tradeDate || !landUnitPrice) return [];
    return [{ label, tradeDate, landUnitPrice, salePrice: positive(value.salePrice), landAreaPyeong: positive(value.landAreaPyeong) }];
  }).sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
  return { points, source };
}

export function medianOf(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function marketPosition(property: Partial<Property>, sources: PropertyDataSource[]): MarketPosition {
  const { points, source } = readMarketPoints(sources, property.id ?? '');
  const prices = points.map((point) => point.landUnitPrice);
  const min = prices.length ? Math.min(...prices) : 0;
  const max = prices.length ? Math.max(...prices) : 0;
  const median = medianOf(prices);
  const salePrice = positive(property.salePrice);
  const landArea = positive(property.landAreaPyeong);
  const subjectUnitPrice = salePrice && landArea ? salePrice / landArea : null;
  const deltaPct = subjectUnitPrice !== null && median > 0 ? Math.round(((subjectUnitPrice - median) / median) * 1000) / 10 : null;
  const band: MarketPosition['band'] = subjectUnitPrice === null || !points.length ? 'unknown'
    : subjectUnitPrice < min ? 'below' : subjectUnitPrice > max ? 'above' : 'within';

  let headline: string;
  if (!points.length) headline = '비교거래 미연결 — 시세 위치를 계산하지 않습니다.';
  else if (subjectUnitPrice === null) headline = `비교거래 ${points.length}건 · 매매가 또는 대지면적 미입력으로 대상 위치 계산 불가`;
  else {
    const sign = deltaPct! > 0 ? '+' : '';
    const bandText = band === 'within' ? '비교거래 범위 안' : band === 'above' ? '비교거래 최고가보다 높음' : '비교거래 최저가보다 낮음';
    headline = `대상 ${formatUnitPricePerPyeong(subjectUnitPrice)} · 비교 중앙값 대비 ${sign}${deltaPct}% · ${bandText}`;
  }

  const basis = [
    '대상 평당가 = 입력 매매가(호가) ÷ 대지면적 계산값이며 실거래가가 아닙니다.',
    '비교거래는 제공 자료 원문의 후보 사례이며 동일 건물 거래로 확정하지 않습니다.',
  ];
  if (points.length && points.length < 3) basis.push(`비교거래 ${points.length}건 — 표본이 적어 중앙값 해석에 주의가 필요합니다.`);

  return {
    points, count: points.length, min, max, median,
    latestTradeDate: points.length ? points[points.length - 1].tradeDate : '',
    subjectUnitPrice, deltaPct, band, headline, basis,
    verificationStatus: source?.verificationStatus,
  };
}
