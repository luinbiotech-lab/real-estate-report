import type { DataRoomBundle, PropertyMedia } from '../propertyDataRoom/types';
import type { Property } from '../../types';
import { internalPhotoAllowed, reportMediaCategoryAllowed } from '../professionalReport/reportAccessPolicy';

/*
 * Pure view-model rules for the property detail pages (hub + edit form), kept out of the components so they can be
 * executed by scripts/validate-property-detail-pages.mjs without a browser.
 */

/**
 * Hero image for the property hub. Same privacy rule as the report: when interior photos are not allowed for the
 * property (Bangbae 815-11 hard deny, or an explicit `internalPhotoAllowed: false`), only explicitly non-interior
 * categories may be shown — an `isPrimary` flag or an unclassified category is not proof that a photo is exterior.
 */
export function selectHubHeroMedia(media: PropertyMedia[], property: Pick<Property, 'id' | 'name' | 'address' | 'detailAddress' | 'internalPhotoAllowed'>): PropertyMedia | undefined {
  const allowInternal = internalPhotoAllowed(property);
  const candidates = media.filter((item) => item.propertyId === property.id
    && item.mediaType === 'image'
    && Boolean(item.url)
    && reportMediaCategoryAllowed(item.category, allowInternal));
  return candidates.find((item) => item.isPrimary)
    || candidates.find((item) => item.category === 'exterior')
    || candidates[0];
}

export interface ComparableSummary {
  count: number;
  /** Rows with a usable positive land unit price; min/max are computed from these only. */
  pricedCount: number;
  min: number;
  max: number;
  status?: string;
}

export function summarizeComparables(bundle: Pick<DataRoomBundle, 'dataSources'>, propertyId: string): ComparableSummary {
  const source = bundle.dataSources.find((item) => item.propertyId === propertyId
    && item.resourceType === 'comparable_transaction_set'
    && item.fieldKey === 'nearbyTransactions');
  const rows = Array.isArray(source?.metadata?.rows) ? (source?.metadata?.rows as Array<Record<string, unknown>>) : [];
  const prices = rows
    .map((row) => (row && typeof row === 'object' ? Number(row.landUnitPrice) : Number.NaN))
    .filter((value) => Number.isFinite(value) && value > 0);
  return {
    count: rows.length,
    pricedCount: prices.length,
    min: prices.length ? Math.min(...prices) : 0,
    max: prices.length ? Math.max(...prices) : 0,
    status: source?.verificationStatus,
  };
}

/** KRW per pyeong → "1,234만/평"; missing or non-positive values are shown as unknown, never as 0. */
export function formatUnitPricePerPyeong(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '-';
  return `${Math.round(value / 10_000).toLocaleString('ko-KR')}만/평`;
}

export type EditFormLoadState = 'new' | 'loading' | 'ready' | 'not_found' | 'error';

/**
 * Builds the record to persist from the form draft.
 * Edit mode must save under the route id: if the draft was never loaded (still loading, not found, failed), saving
 * would otherwise mint a fresh UUID and silently create a duplicate property instead of editing the existing one.
 */
export function buildPropertyToSave(draft: Property, routeId: string | undefined, loadState: EditFormLoadState, now: string, newId: () => string): Property {
  if (routeId) {
    if (loadState !== 'ready') throw new Error('기존 물건 정보를 불러온 뒤에 저장할 수 있습니다.');
    if (draft.id !== routeId) throw new Error('수정 중인 물건 ID가 일치하지 않아 저장을 중단했습니다.');
  } else if (loadState !== 'new') {
    throw new Error('새 물건 등록 상태가 아닙니다.');
  }
  const briefingItems = draft.briefingItems ?? [];
  return {
    ...draft,
    id: routeId ?? (draft.id || newId()),
    briefingItems,
    briefingUpdatedAt: briefingItems.length ? now : draft.briefingUpdatedAt || '',
    createdAt: draft.createdAt || now,
    updatedAt: now,
  };
}

/** Number inputs: empty → 0 (the app's "not entered" value); rejects NaN/Infinity/negatives instead of storing them. */
export function parseNonNegativeNumberInput(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return 0;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return undefined;
  return value;
}
