/*
 * Fact-preserving phrase checks for the 1P/7P MASTER (Luin review on PR #46, 2026-11-04).
 * Stored free text is never rewritten into a positive fact. A keyword may only switch a *title* (never a printed fact)
 * and only when the text states it without negation, condition or uncertainty.
 */
const NEGATION_OR_UNCERTAIN = /아님|아닌|아니|없음|없는|없다|불가|미확인|확인 ?필요|확인 ?중|예정|검토|여부|협의|추정|가능성|미정|\?/;

/** True only when `text` plainly states `keyword` (e.g. '양면 도로 접면 코너'); '코너 아님', '코너 여부 미확인' → false. */
export function statesPlainly(text: string | null | undefined, keyword: string) {
  const value = String(text || '');
  if (!value.includes(keyword)) return false;
  const clause = value.split(/\r?\n|[;]|·|,\s/).find((part) => part.includes(keyword)) || value;
  return !NEGATION_OR_UNCERTAIN.test(clause);
}
