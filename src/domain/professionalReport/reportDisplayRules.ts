import { lines } from '../../utils/format';

/*
 * Pure display rules shared by the DA:ON 1P / 7P masters (unit-tested in scripts/validate-report-display-rules.mjs).
 *
 * 1. Short display labels (owner decision 2026-11-04, 루인 recommendation): a broker-written short label wins; otherwise
 *    the stored text's first line is printed exactly as written. No keyword substitution, no truncation, no rewriting.
 * 2. Calculated coverage (owner test 2026-11-05): a register coverage of 0 means "unrecorded", not 0%. When building and
 *    land areas exist, a simple building-area ÷ land-area value may be shown, always labelled as calculated, never as
 *    the register value.
 */
export function shortOrFirstLine(shortLabel: string | undefined | null, original: string | undefined | null, fallback = ''): string {
  const short = (shortLabel ?? '').trim();
  if (short) return short;
  return lines(original ?? '')[0] || fallback;
}

export interface CoverageDisplay {
  label: '건폐율' | '단순 건폐율' | '용적률' | '단순 용적률';
  value: string;
  calculated: boolean;
}

const positiveNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

/**
 * registerDisplay: the already formatted register value (e.g. "57%"), used only when registerRate > 0.
 * Returns null when neither a register value nor a calculable value exists (the row is then omitted).
 */
export function coverageDisplay(registerRate: unknown, registerDisplay: string, buildingAreaPyeong: unknown, landAreaPyeong: unknown): CoverageDisplay | null {
  if (positiveNumber(registerRate)) return { label: '건폐율', value: registerDisplay, calculated: false };
  if (positiveNumber(buildingAreaPyeong) && positiveNumber(landAreaPyeong)) {
    const pct = Math.round((buildingAreaPyeong / landAreaPyeong) * 1000) / 10;
    return { label: '단순 건폐율', value: `약 ${pct.toLocaleString('ko-KR')}%`, calculated: true };
  }
  return null;
}

/**
 * Floor-area ratio when the register does not record one (owner sample review 2026-11-11). Only when the floor rows add up
 * to the register total floor area (within 1%), so a partial floor list never produces a number. Above-ground floors are
 * the rows not marked B/지하/지층. Always labelled as calculated, never as the register value.
 */
export function floorAreaRatioDisplay(registerRate: unknown, registerDisplay: string, floors: Array<{ floor: string; areaSqm: number | null }>, totalFloorAreaSqm: unknown, landAreaSqm: unknown): CoverageDisplay | null {
  if (positiveNumber(registerRate)) return { label: '용적률', value: registerDisplay, calculated: false };
  if (!positiveNumber(totalFloorAreaSqm) || !positiveNumber(landAreaSqm) || !floors.length) return null;
  const areas = floors.map((row) => row.areaSqm);
  if (areas.some((area) => !positiveNumber(area))) return null;
  const total = (areas as number[]).reduce((sum, area) => sum + area, 0);
  if (Math.abs(total - totalFloorAreaSqm) > totalFloorAreaSqm * 0.01) return null;
  const above = floors.filter((row) => !/^(B|b|지하|지층)/.test(row.floor.trim())).reduce((sum, row) => sum + (row.areaSqm as number), 0);
  if (!(above > 0)) return null;
  const pct = Math.round((above / landAreaSqm) * 1000) / 10;
  return { label: '단순 용적률', value: `약 ${pct.toLocaleString('ko-KR')}%`, calculated: true };
}

/**
 * Building age from the approval date, as of the snapshot date (calculated). The reference date is the snapshot's
 * Korean calendar date (KST, UTC+9) whatever the viewer's time zone, so one snapshot always prints the same age
 * (루인 review on #56, 2026-11-11). A date-only asOf (YYYY-MM-DD) is used as written.
 */
export function buildingAgeDisplay(completionDate: unknown, asOf: string): string {
  const match = typeof completionDate === 'string' ? completionDate.match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  if (!match) return '';
  let refYear: number; let refMonth: number; let refDay: number;
  const dateOnly = typeof asOf === 'string' ? asOf.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  if (dateOnly) { refYear = Number(dateOnly[1]); refMonth = Number(dateOnly[2]); refDay = Number(dateOnly[3]); }
  else {
    const time = Date.parse(asOf);
    if (!Number.isFinite(time)) return '';
    const kst = new Date(time + 9 * 3_600_000);
    refYear = kst.getUTCFullYear(); refMonth = kst.getUTCMonth() + 1; refDay = kst.getUTCDate();
  }
  let years = refYear - Number(match[1]);
  if (refMonth < Number(match[2]) || (refMonth === Number(match[2]) && refDay < Number(match[3]))) years -= 1;
  return years >= 0 ? `약 ${years}년 (${match[1]}년 사용승인)` : '';
}

/**
 * Snapshot issue date as the Korean calendar date (KST), independent of the viewer's time zone (루인 review on #56,
 * 2026-11-12). Returns "YYYY. MM. DD" (callers add a trailing dot where the layout uses one); '' for an invalid value.
 */
export function koreaDateLabel(iso: unknown): string {
  const time = typeof iso === 'string' ? Date.parse(iso) : NaN;
  if (!Number.isFinite(time)) return '';
  const kst = new Date(time + 9 * 3_600_000);
  return `${kst.getUTCFullYear()}. ${String(kst.getUTCMonth() + 1).padStart(2, '0')}. ${String(kst.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Comparable land unit price for the report bars (2026-11-12 multi-review): when the stored source unit price differs from
 * sale price ÷ land area by more than 0.5% (the same tolerance as comparableTransactionService / report readiness), the
 * bar uses the reproducible calculated value and keeps the source value for a "원문 확인 필요" note. Nothing is rewritten.
 */
export function comparableUnitDisplay(row: { salePrice: number; landAreaPyeong: number; landUnitPrice: number }) {
  const derived = positiveNumber(row.salePrice) && positiveNumber(row.landAreaPyeong) ? row.salePrice / row.landAreaPyeong : NaN;
  if (!Number.isFinite(derived)) return { value: row.landUnitPrice, mismatch: false, sourceValue: row.landUnitPrice };
  const variancePct = Math.abs((row.landUnitPrice - derived) / derived) * 100;
  return variancePct > 0.5 ? { value: Math.round(derived), mismatch: true, sourceValue: row.landUnitPrice } : { value: row.landUnitPrice, mismatch: false, sourceValue: row.landUnitPrice };
}

export interface ScenarioFacts {
  floors: Array<{ floor: string; name: string; areaSqm: number | null }>;
  totalFloorAreaSqm?: number | null; zoning?: string; road?: string; occupancy?: string;
}

const sqm = (value: number) => `${value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}㎡`;
const floorGroup = (floors: ScenarioFacts['floors'], pattern: RegExp) => {
  const rows = floors.filter((row) => pattern.test(row.name || ''));
  const area = rows.reduce((sum, row) => sum + (positiveNumber(row.areaSqm) ? Number(row.areaSqm) : 0), 0);
  const labels = [...new Set(rows.map((row) => String(row.floor || '').trim()).filter(Boolean))].join('·');
  return { rows, area, labels };
};
const RESIDENTIAL = /주택|주거|다가구|다세대/;
const COMMERCIAL = /점포|근린|사무|업무|상가|판매|음식/;

/**
 * Evidence lines for a use scenario card, built only from register/Data Room facts already in the report (owner review
 * 2026-11-12: the cards showed only a name). Nothing is inferred beyond the stored values; sums are labelled as floor
 * totals and every use that differs from the register ends with a check line. Lines without data are omitted.
 */
export function scenarioEvidence(title: string, facts: ScenarioFacts): string[] {
  const lines: string[] = [];
  const push = (line: string | false | undefined) => { if (line && !lines.includes(line)) lines.push(line); };
  const residential = floorGroup(facts.floors, RESIDENTIAL);
  const commercial = floorGroup(facts.floors, COMMERCIAL);
  const firstFloor = facts.floors.filter((row) => /^(1F|1층|지상\s*1층?)$/i.test(String(row.floor || '').trim()) && COMMERCIAL.test(row.name || ''));
  const zoning = (facts.zoning || '').trim(); const road = (facts.road || '').trim(); const occupancy = (facts.occupancy || '').trim();
  // Mixed-use names ('주거·업무 복합공간') are matched as residential/mixed first.
  if (/주거|주택|복합|거주/.test(title)) {
    push(residential.area > 0 && `공부상 주택 ${residential.labels} ${sqm(residential.area)}(층별 합계)`);
    push(commercial.area > 0 && `근생·점포 ${commercial.labels} ${sqm(commercial.area)}(층별 합계)`);
    push(zoning && `용도지역 ${zoning}`);
  } else if (/사옥|업무|사무|오피스|본사/.test(title)) {
    push(positiveNumber(facts.totalFloorAreaSqm) && `연면적 ${sqm(Number(facts.totalFloorAreaSqm))}${facts.floors.length ? ` · ${[...new Set(facts.floors.map((row) => row.floor).filter(Boolean))].join('·')} 일괄 사용` : ''}`);
    push(occupancy && `명도: ${occupancy}`);
    push(residential.area > 0 && `공부상 주택 ${sqm(residential.area)}(${residential.labels}) 업무 사용 시 용도변경 확인 필요`);
  } else if (/F&B|카페|식음|음식|레스토랑|리테일|상가|매장|플래그십|쇼룸/i.test(title)) {
    push(road && `도로: ${road}`);
    push(firstFloor.length > 0 && `1층 공부상 ${firstFloor.map((row) => `${row.name}${positiveNumber(row.areaSqm) ? ` ${sqm(Number(row.areaSqm))}` : ''}`).join(' · ')}`);
    push(zoning && `용도지역 ${zoning} · 업종별 허용 여부 확인 필요`);
  } else {
    push(zoning && `용도지역 ${zoning}`);
    push(positiveNumber(facts.totalFloorAreaSqm) && `연면적 ${sqm(Number(facts.totalFloorAreaSqm))}`);
  }
  return lines.slice(0, 3);
}
