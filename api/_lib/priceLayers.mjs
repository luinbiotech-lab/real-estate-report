/*
 * Price layers for a whole-lot / whole-building sale (owner request 2026-11-01):
 *   1. 매도 희망가        — seller's asking price (entered by the broker)
 *   2. 공시지가 기준 토지가액 — official land price × land area (calculated; shown in place of an appraisal, NOT 감정가)
 *   3. 주변 실거래 시세    — comparable public transactions (candidates), land unit price per pyeong
 *   4. 거래가능가격 추정   — DA:ON estimate range from (3); the broker confirms the final figure with a rationale
 *
 * Comparable rules (found on live data 2026-11-01, 동교동):
 *  - rows already excluded upstream (cancelled / share deal / collective unit) are never used;
 *  - one multi-parcel deal is published as several rows with the same date, dong and unit price — they are merged
 *    into one deal (otherwise a single deal is counted six times);
 *  - land area must be comparable in scale (0.5×–2× the subject lot): slivers and block-size sites are a different market;
 *  - at least MIN_COMPARABLES deals, otherwise no estimate is produced ("비교거래 부족").
 * The estimate is a range (25th / 50th / 75th percentile × subject land area), never a single "true" price.
 */

export const SQM_PER_PYEONG = 3.3058;
export const MIN_COMPARABLES = 5;
export const AREA_RATIO_MIN = 0.5;
export const AREA_RATIO_MAX = 2;

const finite = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0;

/** Merge rows of one multi-parcel deal (same date + dong + masked lot prefix + unit price within 0.1%). */
export function mergeBulkDeals(rows) {
  const groups = [];
  for (const row of rows) {
    const ppy = row.landPricePerPyeong;
    const match = groups.find((group) => group.dealDate === row.dealDate && group.legalDong === row.legalDong
      && String(group.jibun || '').slice(0, 1) === String(row.jibun || '').slice(0, 1)
      && Math.abs(group.landPricePerPyeong - ppy) / ppy < 0.001);
    if (match) {
      match.landAreaSqm += row.landAreaSqm;
      match.dealAmount += row.dealAmount;
      match.parcelCount += 1;
    } else {
      groups.push({ ...row, landAreaSqm: row.landAreaSqm, dealAmount: row.dealAmount, parcelCount: 1 });
    }
  }
  return groups.map((group) => ({ ...group, landPricePerPyeong: Math.round(group.dealAmount / (group.landAreaSqm / SQM_PER_PYEONG)) }));
}

const percentile = (sorted, p) => {
  if (!sorted.length) return undefined;
  const index = (sorted.length - 1) * p;
  const lo = Math.floor(index), hi = Math.ceil(index);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo));
};

/** Comparable deals for the subject lot, with the reason each candidate was left out. */
export function selectLandComparables(rows, subjectLandAreaSqm) {
  const usable = rows.filter((row) => !row.comparableExclusion && finite(row.landPricePerPyeong) && finite(row.landAreaSqm) && finite(row.dealAmount));
  const merged = mergeBulkDeals(usable);
  const used = [], dropped = [];
  for (const deal of merged) {
    const ratio = finite(subjectLandAreaSqm) ? deal.landAreaSqm / subjectLandAreaSqm : 1;
    if (deal.parcelCount > 1 && ratio > AREA_RATIO_MAX) dropped.push({ deal, reason: `여러 필지 일괄 거래(${deal.parcelCount}필지)` });
    else if (ratio < AREA_RATIO_MIN) dropped.push({ deal, reason: '대지 규모가 본건의 절반 미만' });
    else if (ratio > AREA_RATIO_MAX) dropped.push({ deal, reason: '대지 규모가 본건의 2배 초과' });
    else used.push(deal);
  }
  return { used, dropped, excludedUpstream: rows.length - usable.length };
}

export function buildPriceLayers({ askingPrice, landAreaSqm, officialLandPricePerSqm, officialYear, comparableRows = [], brokerConfirmed = null }) {
  const landPyeong = finite(landAreaSqm) ? landAreaSqm / SQM_PER_PYEONG : 0;
  const official = finite(officialLandPricePerSqm) && finite(landAreaSqm) ? Math.round(officialLandPricePerSqm * landAreaSqm) : undefined;
  const { used, dropped, excludedUpstream } = selectLandComparables(comparableRows, landAreaSqm);
  const unitPrices = used.map((deal) => deal.landPricePerPyeong).sort((a, b) => a - b);
  const enough = unitPrices.length >= MIN_COMPARABLES && landPyeong > 0;
  const p = (q) => percentile(unitPrices, q);
  const estimate = enough ? {
    low: Math.round(p(0.25) * landPyeong), mid: Math.round(p(0.5) * landPyeong), high: Math.round(p(0.75) * landPyeong),
    unitLow: p(0.25), unitMid: p(0.5), unitHigh: p(0.75),
  } : undefined;
  return {
    asking: finite(askingPrice) ? { value: askingPrice, state: 'actual', label: '매도 희망가', note: '매도인 제시가(중개사 입력)' } : { value: undefined, state: 'missing', label: '매도 희망가', note: '미입력' },
    official: official ? { value: official, state: 'calculated', label: '공시지가 기준 토지가액', note: `${officialYear || ''} 개별공시지가 × 토지면적 · 계산값 · 감정평가액 아님`.trim(), unitPerPyeong: Math.round(officialLandPricePerSqm * SQM_PER_PYEONG) }
      : { value: undefined, state: 'missing', label: '공시지가 기준 토지가액', note: '공시지가 미연결' },
    market: {
      state: used.length ? 'candidate' : 'missing', label: '주변 실거래 시세',
      count: used.length, medianUnitPerPyeong: p(0.5), dropped: dropped.map(({ deal, reason }) => ({ dealDate: deal.dealDate, reason })), excludedUpstream,
      deals: used.map((deal) => ({ dealDate: deal.dealDate, legalDong: deal.legalDong, jibun: deal.jibun, type: deal.type, dealAmount: deal.dealAmount, landAreaSqm: deal.landAreaSqm, landPricePerPyeong: deal.landPricePerPyeong, buildingUse: deal.buildingUse || '' })),
      note: '같은 동 또는 동 미확인·최근 6개월 공개 실거래 후보(동일 건물 거래로 확정하지 않음)',
      legalDongUnconfirmedCount: used.filter((deal) => !String(deal.legalDong || '').trim()).length,
    },
    estimate: estimate ? { ...estimate, state: 'estimated', label: 'DA:ON 거래가능가격 추정', note: `비교거래 ${used.length}건 토지 평당가 하위25%·중앙값·상위25% × 본건 토지 ${Math.round(landPyeong * 100) / 100}평 · 감정평가 아님` }
      : { state: 'missing', label: 'DA:ON 거래가능가격 추정', note: `비교거래 부족(${used.length}건 < ${MIN_COMPARABLES}건) — 산출하지 않음` },
    brokerConfirmed: brokerConfirmed && finite(brokerConfirmed.value)
      ? { value: brokerConfirmed.value, rationale: brokerConfirmed.rationale || '', confirmedBy: brokerConfirmed.confirmedBy || '', confirmedAt: brokerConfirmed.confirmedAt || '', state: 'actual', label: '중개사 확정 거래가능가격' }
      : { state: 'missing', label: '중개사 확정 거래가능가격', note: '중개사 확정 전' },
  };
}

/**
 * Server-side achievable-price estimate over ALL comparable rows of a lookup (the response lists are truncated, so the
 * browser cannot compute this). Returns a compact, storable result; the broker confirms the final figure separately.
 */
/** Rule id stored with each estimate so readers know how "same dong" was decided (Ruin review 2026-11-12). */
export const DONG_SCOPE_RULE = 'legal_dong_exact_v1';

/** Legal dong names are compared whole (spaces removed); '정동' must not match '신정동'. Blank on either side is never a match. */
export function sameLegalDong(a, b) {
  const left = String(a ?? '').replace(/\s+/g, ''); const right = String(b ?? '').replace(/\s+/g, '');
  return Boolean(left && right && left === right);
}

// A deal is confirmed only when the lookup dong is known and the deal names exactly that dong.
const dongUnconfirmed = (deal, subjectDong) => !sameLegalDong(deal.legalDong, subjectDong);

export function estimateAchievablePrice({ landAreaSqm, rows = [], computedAt = new Date().toISOString(), subjectDong = undefined }) {
  const landPyeong = finite(landAreaSqm) ? landAreaSqm / SQM_PER_PYEONG : 0;
  const { used, dropped, excludedUpstream } = selectLandComparables(rows, landAreaSqm);
  const unitPrices = used.map((deal) => deal.landPricePerPyeong).sort((a, b) => a - b);
  const droppedByReason = {};
  for (const { reason } of dropped) { const key = reason.startsWith('여러 필지') ? 'bulk' : reason.includes('절반') ? 'tooSmall' : 'tooLarge'; droppedByReason[key] = (droppedByReason[key] || 0) + 1; }
  const base = {
    method: 'land_unit_price_iqr_v1', landAreaSqm: finite(landAreaSqm) ? landAreaSqm : undefined, comparableCount: used.length,
    // Deals whose dong is not confirmed as the subject's (blank dong, or no subject dong). Outputs never call them "same dong".
    legalDongUnconfirmedCount: used.filter((deal) => dongUnconfirmed(deal, subjectDong)).length,
    subjectLegalDong: String(subjectDong ?? '').trim(), dongScopeRule: DONG_SCOPE_RULE,
    excluded: { upstream: excludedUpstream, ...droppedByReason }, computedAt,
    areaRange: finite(landAreaSqm) ? { minSqm: Math.round(landAreaSqm * AREA_RATIO_MIN * 10) / 10, maxSqm: Math.round(landAreaSqm * AREA_RATIO_MAX * 10) / 10 } : undefined,
    deals: used.sort((a, b) => String(b.dealDate).localeCompare(String(a.dealDate))).slice(0, 8).map((deal) => ({
      dealDate: deal.dealDate, legalDong: deal.legalDong, jibun: deal.jibun, type: deal.type, buildingUse: deal.buildingUse || '',
      dealAmount: deal.dealAmount, landAreaSqm: Math.round(deal.landAreaSqm * 100) / 100, landPricePerPyeong: deal.landPricePerPyeong,
    })),
  };
  if (!landPyeong) return { ...base, state: 'no_land_area', note: '토지면적 미확인 — 추정하지 않음' };
  if (unitPrices.length < MIN_COMPARABLES) return { ...base, state: 'insufficient', note: `비교거래 부족(${unitPrices.length}건 < ${MIN_COMPARABLES}건) — 추정하지 않음` };
  const unitLow = percentile(unitPrices, 0.25), unitMid = percentile(unitPrices, 0.5), unitHigh = percentile(unitPrices, 0.75);
  return {
    ...base, state: 'estimated', unitLow, unitMid, unitHigh,
    low: Math.round(unitLow * landPyeong), mid: Math.round(unitMid * landPyeong), high: Math.round(unitHigh * landPyeong),
    note: `비교거래 ${unitPrices.length}건 토지 평당가 하위25%·중앙값·상위25% × 본건 토지 ${Math.round(landPyeong * 100) / 100}평 · DA:ON 추정, 감정평가 아님`,
  };
}
