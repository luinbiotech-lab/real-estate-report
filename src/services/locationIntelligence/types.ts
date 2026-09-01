import type { BriefingCategory } from '../../types';

export type BrandMapCategory = BriefingCategory;
export interface BrandMapMarker {
  id: string; number: number; category: BrandMapCategory; name: string; description?: string;
  latitude: number; longitude: number; distanceMeters: number; source: 'manual' | 'kakao';
  selected: boolean; originalBriefingItemId: string;
}
export interface BrandMapModel {
  property: { name: string; address: string; latitude: number; longitude: number };
  markers: BrandMapMarker[]; radiusMeters: number; maxMarkers: number; selectedCount: number;
  overflowCount: number; generatedAt: string;
  summary: { within500m: number; within1km: number; nearest?: BrandMapMarker; transportCount: number; foodCount: number };
}
