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
  label: '건폐율' | '단순 건폐율';
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
