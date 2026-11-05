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

/**
 * Short Korean money for calculated / estimated figures: "30억", "11.25억", "9,437만" (no unit suffix; callers add "원").
 * Rounding rule (루인 review on #43, 2026-11-06): ≥100억 → integer 억, ≥10억 → 1 decimal, ≥1억 → 2 decimals, below 1억
 * → integer 만 (rounded); a value that rounds to 10,000만 is shown as 억. Entered prices never use this — see formatExactWon.
 */
export function formatEok(value: number) {
  if (!positive(value)) return '';
  const man = Math.round(value / 10_000);
  if (value >= 100_000_000 || man >= 10_000) {
    const eok = value / 100_000_000;
    const digits = eok >= 100 ? 0 : eok >= 10 ? 1 : 2;
    return `${Number(eok.toFixed(digits)).toLocaleString('ko-KR')}억`;
  }
  return `${man.toLocaleString('ko-KR')}만`;
}

/**
 * Exact amount for entered figures (asking price, broker price): "41억 5,000만원", "12억 3,456만 7,890원".
 * No rounding at all — a sub-만원 remainder is printed in 원 (루인 review on #43: display must equal the stored amount).
 */
export function formatExactWon(value: number) {
  if (!positive(value)) return '';
  const whole = Math.round(value);
  const eok = Math.floor(whole / 100_000_000);
  const man = Math.floor((whole % 100_000_000) / 10_000);
  const won = whole % 10_000;
  const parts = [eok ? `${eok.toLocaleString('ko-KR')}억` : '', man ? `${man.toLocaleString('ko-KR')}만` : '', won ? won.toLocaleString('ko-KR') : ''].filter(Boolean);
  return `${parts.join(' ')}원`;
}

export interface PriceLayerCell {
  key: 'asking' | 'official' | 'market' | 'achievable';
  label: string; value: string; sub: string; badge: string;
  /** entered = broker figure without a written basis (not confirmed); confirmed = broker figure with a basis. */
  state: 'actual' | 'calculated' | 'candidate' | 'estimated' | 'entered' | 'confirmed';
  /** total = whole-property amount (원); per_pyeong = land unit price (원/평). Never compare the two directly. */
  unit: 'total' | 'per_pyeong';
  /** Raw KRW behind the display value (range → [low, high]); kept so tests can check display vs exact value. */
  amount: number | [number, number];
}

/** Present cells only (blank-value policy: a missing layer is hidden, never printed as a placeholder). */
/** Stored timestamps are UTC ISO; the report shows the Korean calendar date (KST 00:00–08:59 is the previous UTC day). */
export function koreaDate(iso: string | undefined | null) {
  const time = Date.parse(iso ?? '');
  if (!Number.isFinite(time)) return '';
  return new Date(time + 9 * 3_600_000).toISOString().slice(0, 10);
}

export function priceLayerCells(p: Partial<Property>, estimate: AchievablePriceEstimate | null): PriceLayerCell[] {
  const cells: PriceLayerCell[] = [];
  const landPyeong = positive(p.landAreaPyeong) ? p.landAreaPyeong : positive(p.landAreaSqm) ? p.landAreaSqm / SQM_PER_PYEONG : 0;
  if (positive(p.salePrice)) {
    cells.push({ key: 'asking', label: '매도 희망가', value: formatExactWon(p.salePrice), sub: landPyeong ? `토지 평당 약 ${formatEok(Math.round(p.salePrice / landPyeong))}원` : '매도인 제시가', badge: '입력값', state: 'actual', unit: 'total', amount: p.salePrice });
  }
  if (positive(p.estimatedOfficialLandValue)) {
    cells.push({ key: 'official', label: '공시지가 기준 토지가액', value: `약 ${formatEok(p.estimatedOfficialLandValue)}원`, sub: `${p.officialLandPriceYear ? `${p.officialLandPriceYear} ` : ''}개별공시지가 × 토지면적`, badge: `계산값 · ${NOT_APPRAISAL}`, state: 'calculated', unit: 'total', amount: p.estimatedOfficialLandValue });
  }
  if (estimate?.state === 'estimated' && positive(estimate.unitMid)) {
    cells.push({ key: 'market', label: '주변 실거래 토지 단가', value: `평당 ${formatEok(estimate.unitMid)}원`, sub: `비교거래 ${estimate.comparableCount}건 중앙값 · 총액 아님`, badge: '공개 실거래 후보', state: 'candidate', unit: 'per_pyeong', amount: estimate.unitMid });
  }
  if (positive(p.brokerAchievablePrice)) {
    const rationale = (p.brokerAchievablePriceRationale ?? '').trim();
    const confirmedAt = koreaDate(p.brokerAchievablePriceConfirmedAt);
    // A broker figure without a written basis is shown as an entered value, not as "확정" (루인 review on #43).
    const badge = rationale ? `중개사 확정${confirmedAt ? ` ${confirmedAt}` : ''} · ${NOT_APPRAISAL}` : `중개사 입력 · 근거 미입력 · ${NOT_APPRAISAL}`;
    cells.push({ key: 'achievable', label: '거래가능가격', value: formatExactWon(p.brokerAchievablePrice), sub: estimate?.state === 'estimated' ? `DA:ON 추정 ${formatEok(estimate.low!)}~${formatEok(estimate.high!)}원` : '중개사 입력값', badge, state: rationale ? 'confirmed' : 'entered', unit: 'total', amount: p.brokerAchievablePrice });
  } else if (estimate?.state === 'estimated' && positive(estimate.low) && positive(estimate.high)) {
    cells.push({ key: 'achievable', label: '거래가능가격 추정', value: `${formatEok(estimate.low)}~${formatEok(estimate.high)}원`, sub: `중앙 약 ${formatEok(estimate.mid!)}원`, badge: `DA:ON 추정 · ${NOT_APPRAISAL}`, state: 'estimated', unit: 'total', amount: [estimate.low, estimate.high] });
  }
  return cells;
}

/** One-line reading of where the asking price sits against the estimate (only when both exist). */
export function askingPosition(askingPrice: number | undefined, estimate: AchievablePriceEstimate | null) {
  if (!positive(askingPrice) || estimate?.state !== 'estimated' || !positive(estimate.low) || !positive(estimate.high)) return '';
  const range = `${formatEok(estimate.low)}~${formatEok(estimate.high)}원`;
  const ask = formatExactWon(askingPrice);
  if (askingPrice < estimate.low) return `매도 희망가 ${ask}은 DA:ON 추정 범위(${range})보다 낮습니다.`;
  if (askingPrice > estimate.high) return `매도 희망가 ${ask}은 DA:ON 추정 범위(${range})보다 높습니다.`;
  return `매도 희망가 ${ask}은 DA:ON 추정 범위(${range}) 안에 있습니다.`;
}

export const PRICE_ESTIMATE_METHOD_NOTE = '거래가능가격 추정은 같은 동·최근 6개월 공개 실거래(해제·지분·일괄 거래 정리) 중 대지 규모가 본건의 0.5~2배인 거래가 5건 이상일 때만, 토지 평당가 하위 25%·중앙값·상위 25%에 본건 토지면적을 곱해 계산한 DA:ON 자동 추정 범위입니다. 감정평가가 아니며, 중개사가 근거와 함께 입력한 가격이 있으면 그 값을 우선 표시합니다.';
