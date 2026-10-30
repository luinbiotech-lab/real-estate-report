import type { Property } from '../types';

/*
 * Read-side guard for property records (Issue #12 browser QA, 2026-10-20).
 * The remote `properties.payload` column is free-form jsonb. Production currently holds QA rows whose payload is not a
 * Property at all (e.g. { name: 'QA Remote E2E', source: … } with no id/updatedAt). Every screen that sorted or searched
 * the list crashed on them, and the home page silently showed an empty portfolio.
 * Records without a usable string id cannot be routed, edited or reported, so they are excluded from property lists and
 * reported instead of being dropped silently. Nothing is written back or deleted — cleanup of the stored rows needs owner approval.
 */
export interface RejectedPropertyRecord {
  /** Human-readable label only (name or position); never the raw payload. */
  label: string;
  reason: 'not-an-object' | 'missing-id';
}

export function isUsablePropertyRecord(value: unknown): value is Property {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const id = (value as { id?: unknown }).id;
  return typeof id === 'string' && id.trim().length > 0;
}

export function partitionPropertyRecords(values: unknown[]): { items: Property[]; rejected: RejectedPropertyRecord[] } {
  const items: Property[] = [];
  const rejected: RejectedPropertyRecord[] = [];
  values.forEach((value, index) => {
    if (isUsablePropertyRecord(value)) { items.push(value); return; }
    const isObject = !!value && typeof value === 'object' && !Array.isArray(value);
    const name = isObject ? (value as { name?: unknown }).name : undefined;
    rejected.push({ label: typeof name === 'string' && name.trim() ? name.trim().slice(0, 80) : `레코드 #${index + 1}`, reason: isObject ? 'missing-id' : 'not-an-object' });
  });
  return { items, rejected };
}

/** Newest first; records with a missing/invalid updatedAt sort last instead of throwing. */
export function compareByUpdatedAtDesc(a: Pick<Property, 'updatedAt'>, b: Pick<Property, 'updatedAt'>) {
  return String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? ''));
}
