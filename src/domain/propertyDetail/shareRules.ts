/*
 * External share center rules (2026-10-30).
 */

/**
 * CSV cell for audit exports opened in Excel/Sheets. Quoting alone does not stop formula execution: a recipient note
 * such as `=HYPERLINK(…)` or `@SUM(…)` would run when the audit file is opened (CSV/formula injection). Cells starting
 * with = + - @ or a tab/CR are prefixed with an apostrophe so they are shown as text.
 */
export function safeCsvCell(value: unknown) {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export interface ShareLike { status: 'active' | 'revoked' | 'expired'; expiresAt?: string }

/**
 * A revoked or expired share must not be re-issued as a fresh standalone HTML/manifest package — that would hand out
 * a new copy after the share was withdrawn. Only active, unexpired shares can be (re)generated.
 */
export function canReissueShare(share: ShareLike, nowIso: string) {
  if (share.status !== 'active') return false;
  if (share.expiresAt && share.expiresAt <= nowIso) return false;
  return true;
}
