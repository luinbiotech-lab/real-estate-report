import type { BriefingCategory, Property } from '../../types';

export type ImportRowStatus = 'pending' | 'validating' | 'invalid' | 'ready' | 'geocoding' | 'address_review_required' | 'geocoded' | 'static_map_loading' | 'static_map_ready' | 'poi_loading' | 'poi_ready' | 'completed' | 'failed' | 'skipped';
export interface ImportRowIssue { field?: string; code: string; message: string }
export interface ImportAddressCandidate { roadAddress?: string; jibunAddress?: string; latitude: number; longitude: number; provider: 'naver' | 'kakao' }
export interface ImportPoiCandidate { id: string; name: string; category?: string; briefingCategory: BriefingCategory; latitude: number; longitude: number; distanceMeters?: number; source: 'kakao'; selected: boolean }
export interface ImportRow {
  rowId: string; excelRowNumber: number; raw: Record<string, unknown>; normalizedProperty: Partial<Property>;
  status: ImportRowStatus; issues: ImportRowIssue[]; addressCandidates?: ImportAddressCandidate[];
  selectedAddressCandidateIndex?: number; generatedMapImage?: string; poiCandidates?: ImportPoiCandidate[];
  retryCount: number; selected: boolean; duplicateKind?: 'existing' | 'workbook'; duplicatePropertyId?: string;
  saveMode: 'new' | 'merge' | 'skip';
}
export interface ImportJobLog { at: string; row?: number; message: string }
export interface ImportJob {
  id: string; fileName: string; createdAt: string; updatedAt: string; totalRows: number; processedRows: number;
  running: boolean; paused: boolean; concurrency: 1 | 2 | 3; poiRadiusMeters: number; rows: ImportRow[];
  logs: ImportJobLog[]; providerPause?: { naver?: string; kakao?: string };
}
