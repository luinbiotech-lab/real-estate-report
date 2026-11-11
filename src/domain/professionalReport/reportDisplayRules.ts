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

/** Building age from the approval date, as of the snapshot date (calculated). */
export function buildingAgeDisplay(completionDate: unknown, asOf: string): string {
  const match = typeof completionDate === 'string' ? completionDate.match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  const ref = new Date(asOf);
  if (!match || Number.isNaN(ref.getTime())) return '';
  let years = ref.getFullYear() - Number(match[1]);
  if (ref.getMonth() + 1 < Number(match[2]) || (ref.getMonth() + 1 === Number(match[2]) && ref.getDate() < Number(match[3]))) years -= 1;
  return years >= 0 ? `약 ${years}년 (${match[1]}년 사용승인)` : '';
}
