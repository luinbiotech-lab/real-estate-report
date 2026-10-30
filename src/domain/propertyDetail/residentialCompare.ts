import type { ResidentialApiStatus, ResidentialAreaBand, ResidentialDeal, ResidentialDealKind, ResidentialMarket } from '../../services/publicPropertyDiscoveryService';
import { formatWonShort } from './discoverySummary';

/*
 * Complex comparison view helpers (Issue #37 phase 2). Pure so scripts/validate-property-detail-pages.mjs can run them.
 * Every deal is a candidate; the jeonse ratio is a calculated value; an unapproved API is shown as such, not as 0 deals.
 */

export const DEAL_KIND_LABELS: Record<ResidentialDealKind, string> = { sale: '매매', jeonse: '전세', monthly: '월세' };

export function apiStatusLabel(status: ResidentialApiStatus) {
  switch (status.status) {
    case 'ok': return '조회됨';
    case 'partial': return `일부 조회(${status.okMonths}/${status.totalMonths}개월)`;
    case 'not_authorized': return '미승인 · 활용신청 필요';
    default: return '조회 실패';
  }
}

/** APIs the owner still has to approve on data.go.kr, by Korean label. */
export function unapprovedApis(market: ResidentialMarket | null | undefined) {
  return Object.values(market?.apiStatus ?? {}).filter((status) => status.status === 'not_authorized').map((status) => status.label);
}

export function areaBandLabel(band: ResidentialAreaBand) {
  if (band.key === 'unknown') return '면적 미기재';
  const min = band.minAreaSqm, max = band.maxAreaSqm;
  const pyeong = min ? Math.round(min / 3.3058) : undefined;
  const range = min != null && max != null && Math.abs(max - min) >= 0.01 ? `${min}~${max}㎡` : `${min ?? band.key}㎡`;
  return pyeong ? `${range} (약 ${pyeong}평)` : range;
}

/** Band shown first: the one with most comparable complex deals (ties → smaller area). */
export function defaultAreaBand(bands: ResidentialAreaBand[]) {
  const total = (band: ResidentialAreaBand) => band.sale.comparableCount + band.jeonse.comparableCount + band.monthly.comparableCount;
  return [...bands].sort((a, b) => total(b) - total(a) || (a.minAreaSqm ?? 1e9) - (b.minAreaSqm ?? 1e9))[0];
}

export function dealsInBand(deals: ResidentialDeal[], band: ResidentialAreaBand | undefined, kind: ResidentialDealKind | 'all') {
  return deals.filter((deal) => {
    if (kind !== 'all' && deal.dealKind !== kind) return false;
    if (!band) return true;
    if (band.key === 'unknown') return !(deal.exclusiveAreaSqm && deal.exclusiveAreaSqm > 0);
    return deal.exclusiveAreaSqm != null && String(Math.floor(deal.exclusiveAreaSqm)) === band.key;
  });
}

export function dealPriceText(deal: ResidentialDeal) {
  if (deal.dealKind === 'sale') return deal.dealAmount ? formatWonShort(deal.dealAmount) : '금액 미기재';
  const deposit = deal.deposit ? formatWonShort(deal.deposit) : '보증금 미기재';
  return deal.dealKind === 'monthly' ? `${deposit} / 월 ${formatWonShort(deal.monthlyRent ?? 0)}` : deposit;
}

export function complexMatchLabel(deal: ResidentialDeal) {
  switch (deal.complexMatch) {
    case 'lot_and_name': return '동일 지번·단지명 후보';
    case 'lot': return '동일 지번 후보';
    case 'name': return '단지명 일치 후보';
    default: return deal.matchLevel === 'masked_address_candidate' ? '지번 비공개 후보' : '같은 동 후보';
  }
}

export function residentialTabLabel(market: ResidentialMarket | null | undefined) {
  if (!market) return '';
  return market.propertyType === 'detached' ? '주택 거래' : '단지 비교';
}
