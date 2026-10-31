import type { ProfessionalReportViewModel, ReportValue } from './types';

/*
 * Blank-slot handling for the DA:ON 1P/7P MASTER (owner decision 2026-10-31, mixed policy).
 * The MASTER design (colours, type, section order, page size) is unchanged; only how missing items are laid out:
 *  - inside a row/strip the present items move forward and the row is re-divided among them, so no empty slot remains;
 *  - a 7P detail page whose content would be mostly blank is omitted as a whole, and the remaining pages are renumbered.
 * Pure so scripts/validate-report-blank-fields.mjs can execute it.
 */

const present = (item: ReportValue<unknown> | undefined) => {
  if (!item) return false;
  const value = item.value;
  if (value === null || value === undefined || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  return String(value).trim() !== '';
};

/** Grid column template for `count` present items (same proportions as the full row). */
export function equalColumns(count: number, unit = '1fr') {
  return count > 0 ? `repeat(${count}, ${unit})` : 'none';
}

export type DetailPageId = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export interface DetailPageEntry { id: DetailPageId; number: number; reason: string }
export interface DetailPagePlan { pages: DetailPageEntry[]; omitted: Array<{ id: DetailPageId; title: string; reason: string }> }

const PAGE_TITLES: Record<DetailPageId, string> = {
  1: '핵심 제안', 2: '물건 개요', 3: '입지 분석', 4: '주변 시세·비교거래', 5: '가치 확장 시나리오', 6: '건물 및 개발 검토', 7: '결론 및 제안',
};

/**
 * Which of the 7 detail pages are printed. Pages 1, 2 and 7 always print (they carry the core fields, which are now
 * mandatory, and the closing checklist). Optional pages need at least two real inputs of their own — a page held up only
 * by fixed copy would read as filler.
 */
export function detailPagePlan(model: ProfessionalReportViewModel, hasMap: boolean, comparableCount: number): DetailPagePlan {
  const count = (...flags: boolean[]) => flags.filter(Boolean).length;
  const checks: Array<[DetailPageId, number, number, string]> = [
    [3, count(hasMap, present(model.location.locationAnalysis), present(model.land.roadCondition)), 2, '입지 지도·입지 분석·도로 조건 중 2개 이상 필요'],
    [4, count(present(model.pricing.landUnitPrice), comparableCount > 0 || present(model.investment.nearbyTransactions), present(model.investment.overallOpinion)), 2, '토지 평당가·비교거래·종합 의견 중 2개 이상 필요'],
    [5, count(present(model.pricing.occupancyStatus), present(model.investment.features), present(model.investment.developmentPlan), present(model.investment.recommendedUse)), 2, '현재 이용·특징·개발 계획·활용 시나리오 중 2개 이상 필요'],
    [6, count(present(model.building.buildingCoverageRate), present(model.building.floorAreaRatio), present(model.building.completionDate), present(model.investment.developmentPlan)), 2, '건폐율·용적률·사용승인일·개발 계획 중 2개 이상 필요'],
  ];
  const omittedIds = new Map<DetailPageId, string>();
  for (const [id, have, need, reason] of checks) if (have < need) omittedIds.set(id, reason);
  const pages: DetailPageEntry[] = [];
  for (const id of [1, 2, 3, 4, 5, 6, 7] as DetailPageId[]) {
    if (omittedIds.has(id)) continue;
    pages.push({ id, number: pages.length + 1, reason: '' });
  }
  return { pages, omitted: [...omittedIds.entries()].map(([id, reason]) => ({ id, title: PAGE_TITLES[id], reason })) };
}
