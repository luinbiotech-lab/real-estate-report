import type { PropertyDataSource } from '../propertyDataRoom/types';
import type { Property } from '../../types';

/*
 * Price layers shown on the 1P band and 7P page 4 (owner decisions 2026-11-01/02):
 *   ① 매도 희망가 (entered) · ② 공시지가 기준 토지가액 (calculated, NOT an appraisal) · ③ 주변 실거래 토지 평당 (candidates)
 *   ④ 거래가능가격 — the broker's confirmed figure when entered, otherwise the DA:ON estimate range (NOT an appraisal).
 * The estimate is computed on the server over all comparable rows (api/_lib/priceLayers.mjs) and stored as a Data Room
 * source `achievable-price:<propertyId>`; reports only read it. Pure so validators can execute it.
 */

export const SQM_PER_PYEONG = 3.3058;
export const ACHIEVABLE_PRICE_SOURCE_PREFIX = 'achievable-price:';
export const NOT_APPRAISAL = '감정평가 아님';

export interface AchievablePriceDeal {
  dealDate: string; legalDong: string; jibun: string; type: string; buildingUse: string;
  dealAmount: number; landAreaSqm: number; landPricePerPyeong: number;
}
export interface AchievablePriceEstimate {
  state: 'estimated' | 'insufficient' | 'no_land_area';
  method: string; note: string; computedAt: string; comparableCount: number;
  landAreaSqm?: number; low?: number; mid?: number; high?: number; unitLow?: number; unitMid?: number; unitHigh?: number;
  areaRange?: { minSqm: number; maxSqm: number };
  excluded?: { upstream?: number; bulk?: number; tooSmall?: number; tooLarge?: number };
  deals?: AchievablePriceDeal[];
}

export function findPriceEstimate(sources: PropertyDataSource[], propertyId: string): AchievablePriceEstimate | null {
  const source = [...sources].reverse().find((item) => item.id === `${ACHIEVABLE_PRICE_SOURCE_PREFIX}${propertyId}`);
  const estimate = source?.metadata?.estimate as AchievablePriceEstimate | undefined;
  return estimate && typeof estimate === 'object' && typeof estimate.state === 'string' ? estimate : null;
}

const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

/** "30억", "11.25억", "9,437만" — short Korean money for the price cells. */
export function formatEok(value: number) {
  if (!positive(value)) return '';
  if (value >= 100_000_000) {
    const eok = value / 100_000_000;
    const digits = eok >= 100 ? 0 : eok >= 10 ? 1 : 2;
    return `${Number(eok.toFixed(digits)).toLocaleString('ko-KR')}억`;
  }
  return `${Math.round(value / 10_000).toLocaleString('ko-KR')}만`;
}

export interface PriceLayerCell {
  key: 'asking' | 'official' | 'market' | 'achievable';
  label: string; value: string; sub: string; badge: string;
  state: 'actual' | 'calculated' | 'candidate' | 'estimated' | 'confirmed';
}

/** Present cells only (blank-value policy: a missing layer is hidden, never printed as a placeholder). */
export function priceLayerCells(p: Partial<Property>, estimate: AchievablePriceEstimate | null): PriceLayerCell[] {
  const cells: PriceLayerCell[] = [];
  const landPyeong = positive(p.landAreaPyeong) ? p.landAreaPyeong : positive(p.landAreaSqm) ? p.landAreaSqm / SQM_PER_PYEONG : 0;
  if (positive(p.salePrice)) {
    cells.push({ key: 'asking', label: '매도 희망가', value: formatEok(p.salePrice), sub: landPyeong ? `토지 평당 ${formatEok(Math.round(p.salePrice / landPyeong))}` : '매도인 제시가', badge: '입력값', state: 'actual' });
  }
  if (positive(p.estimatedOfficialLandValue)) {
    cells.push({ key: 'official', label: '공시지가 기준 토지가액', value: formatEok(p.estimatedOfficialLandValue), sub: `${p.officialLandPriceYear ? `${p.officialLandPriceYear} ` : ''}개별공시지가 × 토지면적`, badge: `계산값 · ${NOT_APPRAISAL}`, state: 'calculated' });
  }
  if (estimate?.state === 'estimated' && positive(estimate.unitMid)) {
    cells.push({ key: 'market', label: '주변 실거래 토지 평당', value: formatEok(estimate.unitMid), sub: `비교거래 ${estimate.comparableCount}건 중앙값`, badge: '공개 실거래 후보', state: 'candidate' });
  }
  if (positive(p.brokerAchievablePrice)) {
    cells.push({ key: 'achievable', label: '거래가능가격', value: formatEok(p.brokerAchievablePrice), sub: estimate?.state === 'estimated' ? `DA:ON 추정 ${formatEok(estimate.low!)}~${formatEok(estimate.high!)}` : '중개사 확정', badge: `중개사 확정 · ${NOT_APPRAISAL}`, state: 'confirmed' });
  } else if (estimate?.state === 'estimated' && positive(estimate.low) && positive(estimate.high)) {
    cells.push({ key: 'achievable', label: '거래가능가격 추정', value: `${formatEok(estimate.low)}~${formatEok(estimate.high)}`, sub: `중앙 ${formatEok(estimate.mid!)}`, badge: `DA:ON 추정 · ${NOT_APPRAISAL}`, state: 'estimated' });
  }
  return cells;
}

/** One-line reading of where the asking price sits against the estimate (only when both exist). */
export function askingPosition(askingPrice: number | undefined, estimate: AchievablePriceEstimate | null) {
  if (!positive(askingPrice) || estimate?.state !== 'estimated' || !positive(estimate.low) || !positive(estimate.high)) return '';
  if (askingPrice < estimate.low) return `매도 희망가 ${formatEok(askingPrice)}은 추정 범위(${formatEok(estimate.low)}~${formatEok(estimate.high)})보다 낮습니다.`;
  if (askingPrice > estimate.high) return `매도 희망가 ${formatEok(askingPrice)}은 추정 범위(${formatEok(estimate.low)}~${formatEok(estimate.high)})보다 높습니다.`;
  return `매도 희망가 ${formatEok(askingPrice)}은 추정 범위(${formatEok(estimate.low)}~${formatEok(estimate.high)}) 안에 있습니다.`;
}

export const PRICE_ESTIMATE_METHOD_NOTE = '거래가능가격 추정은 같은 동·최근 6개월 공개 실거래 중 대지 규모가 본건의 0.5~2배인 거래의 토지 평당가 하위 25%·중앙값·상위 25%에 본건 토지면적을 곱한 범위입니다. 공인중개사의 가격 의견이며 감정평가가 아닙니다.';
