/*
 * Residential (공동주택·오피스텔·단독) sale / jeonse / monthly-rent public transactions (Issue #37 phase 2).
 *
 * Rules carried from the locked policy:
 * - Every row stays a CANDIDATE. Same lot + same complex name is the strongest match ('lot_and_name'), but it is still not
 *   a confirmed same-unit deal; a unit (호실) is never inferred from a lot.
 * - MOLIT amounts (dealAmount, deposit, monthlyRent) arrive in 만원. Normalised values are KRW (× 10,000); the source value
 *   and unit are kept beside them.
 * - Each API needs its own data.go.kr approval. An unapproved / failing API is reported per API ('not_authorized' / 'error'),
 *   never as "0 transactions".
 *
 * Field names verified against real response samples (2025-01, LAWD_CD 11110): AptRent (aptNm, excluUseAr, deposit,
 * monthlyRent, contractType, contractTerm, preDeposit, preMonthlyRent, useRRRight) and RHTrade (mhouseNm, houseType,
 * excluUseAr, landAr, dealAmount, cdealType). AptTrade, RHRent, OffiTrade/OffiRent and SHTrade/SHRent names are ASSUMPTION until a live response is seen;
 * the normaliser therefore accepts the known alternatives and always keeps the raw row.
 */

const RTMS = 'https://apis.data.go.kr/1613000';
const SQM_PER_PYEONG = 3.3058;

export const RESIDENTIAL_APIS = {
  apartment: [
    { id: 'aptTrade', dealKind: 'sale', service: 'RTMSDataSvcAptTrade', operation: 'getRTMSDataSvcAptTrade', label: '국토교통부 아파트 매매 실거래가' },
    { id: 'aptRent', dealKind: 'rent', service: 'RTMSDataSvcAptRent', operation: 'getRTMSDataSvcAptRent', label: '국토교통부 아파트 전월세 실거래가' },
  ],
  row_house: [
    { id: 'rhTrade', dealKind: 'sale', service: 'RTMSDataSvcRHTrade', operation: 'getRTMSDataSvcRHTrade', label: '국토교통부 연립다세대 매매 실거래가' },
    { id: 'rhRent', dealKind: 'rent', service: 'RTMSDataSvcRHRent', operation: 'getRTMSDataSvcRHRent', label: '국토교통부 연립다세대 전월세 실거래가' },
  ],
  officetel: [
    { id: 'offiTrade', dealKind: 'sale', service: 'RTMSDataSvcOffiTrade', operation: 'getRTMSDataSvcOffiTrade', label: '국토교통부 오피스텔 매매 실거래가' },
    { id: 'offiRent', dealKind: 'rent', service: 'RTMSDataSvcOffiRent', operation: 'getRTMSDataSvcOffiRent', label: '국토교통부 오피스텔 전월세 실거래가' },
  ],
  detached: [
    { id: 'shTrade', dealKind: 'sale', service: 'RTMSDataSvcSHTrade', operation: 'getRTMSDataSvcSHTrade', label: '국토교통부 단독/다가구 매매 실거래가' },
    { id: 'shRent', dealKind: 'rent', service: 'RTMSDataSvcSHRent', operation: 'getRTMSDataSvcSHRent', label: '국토교통부 단독/다가구 전월세 실거래가' },
  ],
};

export const RESIDENTIAL_TYPES = Object.keys(RESIDENTIAL_APIS);

const num = (value) => {
  const text = String(value ?? '').replaceAll(',', '').trim();
  if (text === '') return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
};
const text = (value) => String(value ?? '').trim();
const won = (tenThousand) => (tenThousand == null ? undefined : tenThousand * 10000);
export const normalizeComplexName = (value) => text(value).replace(/\s+/g, '').replace(/[()（）·.\-_]/g, '').replace(/아파트$/, '').toLowerCase();

/**
 * Classifies one data.go.kr response. HTTP 401/403, SERVICE_KEY / unregistered messages and non-success result codes are
 * reported as such; only a success code (or plain items) counts as a real (possibly empty) result.
 */
export function classifyRtmsResponse(status, body) {
  const raw = String(body ?? '');
  if (status === 401 || status === 403) return { state: 'not_authorized', detail: `HTTP ${status}` };
  if (/SERVICE_KEY_IS_NOT_REGISTERED|SERVICE ACCESS DENIED|UNREGISTERED|Unauthorized|등록되지 않은 서비스키|활용신청/i.test(raw)) {
    return { state: 'not_authorized', detail: '서비스키 미등록 또는 활용신청 미승인' };
  }
  if (status < 200 || status >= 300) return { state: 'error', detail: `HTTP ${status}` };
  const code = raw.match(/<resultCode>\s*([^<]*?)\s*<\/resultCode>/)?.[1];
  if (code != null && !/^0+$/.test(code)) {
    const message = raw.match(/<resultMsg>\s*([^<]*?)\s*<\/resultMsg>/)?.[1] || '';
    return { state: /key|인증|auth/i.test(message) || code === '30' ? 'not_authorized' : 'error', detail: `resultCode ${code}${message ? ` ${message}` : ''}` };
  }
  return { state: 'ok', detail: '' };
}

function matchLevelFor(row, resolved) {
  const jibun = text(row.jibun);
  const legalDong = text(row.umdNm);
  const targetJibun = `${Number(resolved.bun)}${Number(resolved.ji) > 0 ? '-' + Number(resolved.ji) : ''}`;
  const masked = /\*|X|x/.test(jibun);
  if (!masked && jibun && jibun === targetJibun) return 'exact_lot';
  if (masked) return 'masked_address_candidate';
  if (legalDong && resolved.region3 && legalDong.includes(resolved.region3)) return 'same_dong_candidate';
  return 'regional_candidate';
}

/** Normalises one residential row. dealKind 'rent' rows become 'jeonse' (monthly rent 0) or 'monthly'. */
export function normalizeResidentialDeal(row, { propertyType, dealKind, apiId }, resolved, target = {}) {
  const complexName = text(row.aptNm || row.mhouseNm || row.offiNm || row.complexName);
  const exclusiveAreaSqm = num(row.excluUseAr ?? row.exclUseAr ?? row.totalFloorAr);
  const landAreaSqm = num(row.landAr ?? row.plottageAr);
  const cancelled = text(row.cdealType) !== '';
  const year = text(row.dealYear), month = text(row.dealMonth).padStart(2, '0'), day = text(row.dealDay).padStart(2, '0');
  const base = {
    propertyType,
    apiId,
    complexName,
    complexDong: text(row.aptDong),
    houseType: text(row.houseType),
    legalDong: text(row.umdNm),
    jibun: text(row.jibun),
    floor: text(row.floor),
    buildYear: num(row.buildYear),
    exclusiveAreaSqm,
    exclusiveAreaPyeong: exclusiveAreaSqm ? Math.round((exclusiveAreaSqm / SQM_PER_PYEONG) * 100) / 100 : undefined,
    areaBasis: row.excluUseAr != null || row.exclUseAr != null ? 'exclusive' : row.totalFloorAr != null ? 'total_floor' : 'unknown',
    landAreaSqm,
    dealDate: year ? `${year}-${month}-${day}` : '',
    matchLevel: matchLevelFor(row, resolved),
    comparableExclusion: cancelled ? 'cancelled' : undefined,
    raw: row,
  };
  const targetName = normalizeComplexName(target.complexName);
  const sameName = Boolean(targetName && complexName && normalizeComplexName(complexName) === targetName);
  base.complexMatch = base.matchLevel === 'exact_lot' ? (sameName ? 'lot_and_name' : 'lot') : sameName ? 'name' : 'none';

  if (dealKind === 'sale') {
    const source = num(row.dealAmount);
    const amount = won(source);
    return {
      ...base,
      dealKind: 'sale',
      dealAmount: amount,
      sourceDealAmountTenThousandWon: source,
      dealAmountSourceUnit: '만원',
      currency: 'KRW',
      pricePerSqm: amount && exclusiveAreaSqm ? Math.round(amount / exclusiveAreaSqm) : undefined,
      pricePerPyeong: amount && exclusiveAreaSqm ? Math.round(amount / (exclusiveAreaSqm / SQM_PER_PYEONG)) : undefined,
      dealingType: text(row.dealingGbn),
    };
  }
  const sourceDeposit = num(row.deposit);
  const sourceMonthlyRent = num(row.monthlyRent);
  const deposit = won(sourceDeposit);
  const monthlyRent = won(sourceMonthlyRent);
  const kind = (sourceMonthlyRent ?? 0) > 0 ? 'monthly' : 'jeonse';
  return {
    ...base,
    dealKind: kind,
    deposit,
    sourceDepositTenThousandWon: sourceDeposit,
    monthlyRent: monthlyRent ?? 0,
    sourceMonthlyRentTenThousandWon: sourceMonthlyRent,
    amountSourceUnit: '만원',
    currency: 'KRW',
    contractType: text(row.contractType),
    contractTerm: text(row.contractTerm),
    previousDeposit: won(num(row.preDeposit)),
    previousMonthlyRent: won(num(row.preMonthlyRent)),
    depositPerPyeong: kind === 'jeonse' && deposit && exclusiveAreaSqm ? Math.round(deposit / (exclusiveAreaSqm / SQM_PER_PYEONG)) : undefined,
  };
}

const median = (values) => {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return undefined;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

/** Exclusive areas within 1㎡ are one size type (59.97 / 59.99 → same 59㎡ band); labelled by the floor of the band minimum. */
export function areaBandKey(areaSqm) {
  return Number.isFinite(areaSqm) && areaSqm > 0 ? String(Math.floor(areaSqm)) : 'unknown';
}

function kindStats(rows) {
  const usable = rows.filter((row) => !row.comparableExclusion);
  const latest = usable.map((row) => row.dealDate).filter(Boolean).sort().at(-1);
  return {
    count: rows.length,
    comparableCount: usable.length,
    cancelledCount: rows.length - usable.length,
    latestDealDate: latest,
    medianDealAmount: median(usable.map((row) => row.dealAmount)),
    medianPricePerPyeong: median(usable.map((row) => row.pricePerPyeong)),
    medianDeposit: median(usable.map((row) => row.deposit)),
    medianMonthlyRent: median(usable.filter((row) => row.dealKind === 'monthly').map((row) => row.monthlyRent)),
  };
}

/**
 * Complex comparison: rows of the target complex (lot or name match), grouped by exclusive-area band, with sale / jeonse /
 * monthly kept apart. jeonseRatio is a calculated value (median jeonse ÷ median sale of the same band), never a provider field.
 */
export function residentialSummary(rows) {
  const scope = (list) => ({
    sale: kindStats(list.filter((row) => row.dealKind === 'sale')),
    jeonse: kindStats(list.filter((row) => row.dealKind === 'jeonse')),
    monthly: kindStats(list.filter((row) => row.dealKind === 'monthly')),
  });
  const complexRows = rows.filter((row) => row.complexMatch !== 'none');
  const bands = new Map();
  for (const row of complexRows) {
    const key = areaBandKey(row.exclusiveAreaSqm);
    if (!bands.has(key)) bands.set(key, []);
    bands.get(key).push(row);
  }
  const areaBands = [...bands.entries()]
    .map(([key, list]) => {
      const stats = scope(list);
      const ratio = stats.jeonse.medianDeposit && stats.sale.medianDealAmount
        ? Math.round((stats.jeonse.medianDeposit / stats.sale.medianDealAmount) * 1000) / 10
        : undefined;
      const areas = list.map((row) => row.exclusiveAreaSqm).filter(Number.isFinite);
      return {
        key,
        minAreaSqm: areas.length ? Math.min(...areas) : undefined,
        maxAreaSqm: areas.length ? Math.max(...areas) : undefined,
        ...stats,
        jeonseRatioPercent: ratio,
        jeonseRatioBasis: ratio != null ? 'calculated_median_jeonse_over_median_sale' : undefined,
      };
    })
    .sort((a, b) => (a.minAreaSqm ?? 1e9) - (b.minAreaSqm ?? 1e9));
  const complexNames = [...new Set(complexRows.map((row) => row.complexName).filter(Boolean))];
  return {
    totalCandidates: rows.length,
    complexCandidateCount: complexRows.length,
    complexNames,
    neighbourhood: scope(rows),
    complex: scope(complexRows),
    areaBands,
  };
}

async function fetchApiMonths(api, lawdCd, key, months, fetcher) {
  const results = await Promise.all(months.map(async (ym) => {
    try {
      const params = new URLSearchParams({ serviceKey: key, LAWD_CD: lawdCd, DEAL_YMD: ym, numOfRows: '1000', pageNo: '1' });
      const response = await fetcher(`${RTMS}/${api.service}/${api.operation}?${params}`);
      const body = await response.text();
      return { ...classifyRtmsResponse(response.status, body), body };
    } catch (error) {
      return { state: 'error', detail: error instanceof Error ? error.message : String(error), body: '' };
    }
  }));
  const ok = results.filter((result) => result.state === 'ok');
  const status = ok.length ? (ok.length === results.length ? 'ok' : 'partial')
    : results.some((result) => result.state === 'not_authorized') ? 'not_authorized' : 'error';
  const detail = results.find((result) => result.state !== 'ok')?.detail || '';
  return { status, detail, okMonths: ok.length, bodies: ok.map((result) => result.body) };
}

/**
 * Fetches and normalises the residential APIs for one property type. xmlItems is injected so this module stays independent
 * of the handler's XML parser; fetcher is injected for tests.
 */
export async function residentialMarket({ propertyType, resolved, key, months, target, xmlItems, fetcher }) {
  const apis = RESIDENTIAL_APIS[propertyType];
  if (!apis) return null;
  const apiStatus = {};
  const rows = [];
  await Promise.all(apis.map(async (api) => {
    const result = await fetchApiMonths(api, resolved.sigunguCd, key, months, fetcher);
    apiStatus[api.id] = { status: result.status, label: api.label, detail: result.detail, okMonths: result.okMonths, totalMonths: months.length };
    for (const body of result.bodies) {
      for (const item of xmlItems(body)) {
        const row = normalizeResidentialDeal(item, { propertyType, dealKind: api.dealKind, apiId: api.id }, resolved, target);
        if (!row.legalDong || !resolved.region3 || row.legalDong.includes(resolved.region3)) rows.push(row);
      }
    }
  }));
  rows.sort((a, b) => b.dealDate.localeCompare(a.dealDate));
  const complexRows = rows.filter((row) => row.complexMatch !== 'none');
  return {
    propertyType,
    target: { complexName: target?.complexName || '', lot: `${Number(resolved.bun)}${Number(resolved.ji) > 0 ? '-' + Number(resolved.ji) : ''}` },
    apiStatus,
    summary: residentialSummary(rows),
    complexDeals: complexRows.slice(0, 120),
    neighbourhoodDeals: rows.filter((row) => row.complexMatch === 'none').slice(0, 40),
    months,
    interpretation: '모든 거래는 후보입니다. 동일 지번·단지명 일치도 호실 거래로 확정하지 않습니다. 전세가율은 같은 면적대 중앙값으로 계산한 값입니다.',
  };
}
