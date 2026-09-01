import type { BriefingCategory, BriefingItem, BrandMapSettings, Property } from '../../types';
import type { BrandMapMarker, BrandMapModel } from './types';

export const DEFAULT_BRAND_MAP_SETTINGS: BrandMapSettings = { radiusMeters: 1000, maxMarkers: 12 };
const CATEGORY_ORDER: BriefingCategory[] = ['transport', 'fashion', 'beauty', 'food', 'officeCulture', 'development', 'other'];
const radians = (value: number) => value * Math.PI / 180;
export const distanceMeters = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  const dLat = radians(b.latitude - a.latitude); const dLng = radians(b.longitude - a.longitude);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)));
};
const idFor = (item: BriefingItem, index: number) => `${item.source || 'manual'}:${item.name.trim().toLowerCase()}:${index}`;

export function createBrandMapModel(property: Property, settings: BrandMapSettings = property.brandMapSettings ?? DEFAULT_BRAND_MAP_SETTINGS): BrandMapModel | null {
  if (property.latitude == null || property.longitude == null) return null;
  const origin = { latitude: property.latitude, longitude: property.longitude };
  const candidates = (property.briefingItems ?? []).map((item, index) => ({ item, index })).filter(({ item }) => item.name.trim() && item.latitude != null && item.longitude != null && item.brandMapVisible !== false).map(({ item, index }) => {
    const marker: BrandMapMarker = { id: idFor(item, index), number: 0, category: item.category, name: item.name.trim(), description: item.description?.trim(), latitude: item.latitude!, longitude: item.longitude!, distanceMeters: distanceMeters(origin, { latitude: item.latitude!, longitude: item.longitude! }), source: item.source || 'manual', selected: true, originalBriefingItemId: idFor(item, index) };
    return marker;
  }).filter((marker) => marker.distanceMeters <= settings.radiusMeters);
  const unique: BrandMapMarker[] = [];
  for (const marker of candidates.sort((a, b) => a.distanceMeters - b.distanceMeters)) {
    if (!unique.some((saved) => saved.name.toLowerCase() === marker.name.toLowerCase() && distanceMeters(saved, marker) <= 30)) unique.push(marker);
  }
  const queues = CATEGORY_ORDER.map((category) => unique.filter((marker) => marker.category === category).sort((a, b) => a.distanceMeters - b.distanceMeters));
  const ordered: BrandMapMarker[] = [];
  while (queues.some((queue) => queue.length)) queues.forEach((queue) => { const marker = queue.shift(); if (marker) ordered.push(marker); });
  const visible = ordered.slice(0, settings.maxMarkers).map((marker, index) => ({ ...marker, number: index + 1 }));
  const nearest = [...unique].sort((a, b) => a.distanceMeters - b.distanceMeters)[0];
  return { property: { name: property.name, address: property.address, ...origin }, markers: visible, radiusMeters: settings.radiusMeters, maxMarkers: settings.maxMarkers, selectedCount: unique.length, overflowCount: Math.max(0, unique.length - settings.maxMarkers), generatedAt: new Date().toISOString(), summary: { within500m: unique.filter((item) => item.distanceMeters <= 500).length, within1km: unique.filter((item) => item.distanceMeters <= 1000).length, nearest, transportCount: unique.filter((item) => item.category === 'transport').length, foodCount: unique.filter((item) => item.category === 'food').length } };
}
