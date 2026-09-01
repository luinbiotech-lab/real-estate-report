import type { BriefingCategory, BriefingItem, Property } from '../types';

export const BRIEFING_CATEGORIES: { key: BriefingCategory; label: string }[] = [
  { key: 'fashion', label: 'FASHION & LIFESTYLE' },
  { key: 'beauty', label: 'BEAUTY & COSMETICS' },
  { key: 'food', label: 'F&B / CAFE' },
  { key: 'officeCulture', label: 'OFFICE / CULTURE' },
  { key: 'transport', label: 'TRANSPORT' },
  { key: 'development', label: 'DEVELOPMENT' },
  { key: 'other', label: 'OTHER' },
];

export function getBriefingGroups(property: Property) {
  const items = property.briefingItems ?? [];
  return BRIEFING_CATEGORIES.map((category) => ({ ...category, items: items.filter((item) => item.category === category.key && item.name.trim()) }));
}

export interface BriefingDataProvider { getItems(property: Property): Promise<BriefingItem[]> }
export const manualBriefingProvider: BriefingDataProvider = { async getItems(property) { return property.briefingItems ?? []; } };
