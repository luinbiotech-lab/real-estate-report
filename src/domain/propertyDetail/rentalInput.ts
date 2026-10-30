/*
 * Rental/income scenario inputs (2026-10-30). Inputs were `Number(value) || 0`, so negative rents, vacancy above 100%
 * or negative operating expense ratios flowed straight into NOI / Cap Rate.
 */
export const RENTAL_PERCENT_FIELDS = ['vacancyRatePct', 'operatingExpenseRatePct'] as const;

/** Returns the sanitized value, or undefined when the input must be rejected (keep the previous value). */
export function sanitizeRentalInput(key: string, raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return 0;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return undefined;
  if ((RENTAL_PERCENT_FIELDS as readonly string[]).includes(key) && value > 100) return undefined;
  return value;
}

/** An explicit ?propertyId must match exactly; otherwise nothing is preselected (never another property's analysis). */
export function pickRentalTarget<T extends { id: string }>(rows: T[], requestedId: string | null): { target?: T; missingRequested: boolean } {
  if (requestedId) {
    const target = rows.find((row) => row.id === requestedId);
    return { target, missingRequested: !target };
  }
  return { target: rows[0], missingRequested: false };
}
