import type { BriefingItem, Property } from '../../types';
import { emptyProperty } from '../../types';
import { mapService } from '../maps/mapService';
import { MapServiceError, type AddressCandidate, type PoiCandidate } from '../maps/types';
import type { ImportAddressCandidate, ImportJob, ImportPoiCandidate, ImportRow, ImportRowIssue } from './types';

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
class ProviderLimiter { private nextAt = 0; private chain = Promise.resolve(); constructor(private gapMs: number) {} schedule<T>(work: () => Promise<T>) { const task = this.chain.then(async () => { const wait = Math.max(0, this.nextAt - Date.now()); if (wait) await sleep(wait); this.nextAt = Date.now() + this.gapMs; return work(); }); this.chain = task.then(() => undefined, () => undefined); return task; } pause(ms: number) { this.nextAt = Math.max(this.nextAt, Date.now() + ms); } }
const naverLimiter = new ProviderLimiter(150); const kakaoLimiter = new ProviderLimiter(180);
const transient = (error: unknown) => error instanceof MapServiceError && ['request-failed', 'proxy-unavailable'].includes(error.code);
const issueFor = (error: unknown, phase: 'geocode' | 'map' | 'poi'): ImportRowIssue => {
  const message = error instanceof Error ? error.message : '알 수 없는 오류'; const code = error instanceof MapServiceError ? error.code : 'NETWORK_ERROR';
  if (/429|rate|quota/i.test(message)) return { code: phase === 'poi' ? 'KAKAO_RATE_LIMIT' : 'NAVER_RATE_LIMIT', message: '요청 한도에 도달했습니다. 잠시 후 재시도하세요.' };
  if (/auth|401|403|인증/i.test(message)) return { code: phase === 'poi' ? 'KAKAO_AUTH' : 'NAVER_AUTH', message: `${phase === 'poi' ? 'Kakao' : 'NAVER'} 인증을 확인해 주세요.` };
  return { code: phase === 'geocode' ? `GEOCODE_${code.toUpperCase()}` : phase === 'map' ? 'STATIC_MAP_FAILED' : `POI_${code.toUpperCase()}`, message };
};
const addressCandidate = (candidate: AddressCandidate): ImportAddressCandidate => ({ roadAddress: candidate.roadAddress, jibunAddress: candidate.lotAddress, latitude: candidate.latitude, longitude: candidate.longitude, provider: candidate.provider?.toLowerCase() === 'kakao' ? 'kakao' : 'naver' });
const poiCandidate = (candidate: PoiCandidate): ImportPoiCandidate => ({ id: candidate.id, name: candidate.name, category: candidate.kakaoCategory, briefingCategory: candidate.briefingCategory, latitude: candidate.latitude, longitude: candidate.longitude, distanceMeters: candidate.distanceMeters, source: 'kakao', selected: false });
const log = (job: ImportJob, row: ImportRow | undefined, message: string) => { job.logs = [...job.logs.slice(-199), { at: new Date().toISOString(), row: row?.excelRowNumber, message }]; };
const runWithRetry = async <T>(work: () => Promise<T>, row: ImportRow) => { let last: unknown; for (let attempt = 0; attempt <= 2; attempt++) { try { return await work(); } catch (error) { last = error; if (!transient(error) || attempt === 2) throw error; row.retryCount += 1; await sleep(400 * (attempt + 1)); } } throw last; };

async function processRow(job: ImportJob, row: ImportRow) {
  try {
    let selected = row.selectedAddressCandidateIndex == null ? undefined : row.addressCandidates?.[row.selectedAddressCandidateIndex];
    if (!selected) {
      row.status = 'geocoding'; log(job, row, 'geocode start');
      const candidates = await runWithRetry(() => naverLimiter.schedule(() => mapService.geocode(String(row.normalizedProperty.address || ''))), row);
      row.addressCandidates = candidates.map(addressCandidate);
      if (!candidates.length) { row.status = 'failed'; row.issues.push({ field: 'address', code: 'NAVER_NO_RESULT', message: '주소 검색 결과가 없습니다.' }); return; }
      if (candidates.length > 1) { row.status = 'address_review_required'; row.issues.push({ field: 'address', code: 'NAVER_MULTIPLE_RESULTS', message: '주소 후보를 직접 선택해 주세요.' }); return; }
      row.selectedAddressCandidateIndex = 0; selected = row.addressCandidates[0]; row.status = 'geocoded'; log(job, row, 'geocode success');
    }
    if (!row.generatedMapImage) { row.status = 'static_map_loading'; log(job, row, 'static map start'); row.generatedMapImage = await runWithRetry(() => naverLimiter.schedule(() => mapService.createStaticMap(selected!)), row); row.status = 'static_map_ready'; log(job, row, 'static map success'); }
    if (!row.poiCandidates) { row.status = 'poi_loading'; log(job, row, 'poi start'); const pois = await runWithRetry(() => kakaoLimiter.schedule(() => mapService.searchNearby(selected!, job.poiRadiusMeters)), row); row.poiCandidates = pois.slice(0, 20).map(poiCandidate); row.status = 'poi_ready'; log(job, row, `poi success (${row.poiCandidates.length})`); }
    row.status = 'completed'; row.issues = row.issues.filter((item) => !item.code.startsWith('GEOCODE_') && !item.code.includes('FAILED'));
  } catch (error) { const phase = row.status === 'geocoding' ? 'geocode' : row.status === 'poi_loading' ? 'poi' : 'map'; const baseIssue = issueFor(error, phase); const issue = { ...baseIssue, code: `${baseIssue.code}:${row.rowId}` }; row.status = 'failed'; row.issues.push(issue); if (baseIssue.code.endsWith('RATE_LIMIT')) { const until = new Date(Date.now() + 5000).toISOString(); if (phase === 'poi') { kakaoLimiter.pause(5000); job.providerPause = { ...job.providerPause, kakao: until }; } else { naverLimiter.pause(5000); job.providerPause = { ...job.providerPause, naver: until }; } } log(job, row, `${phase} failed`); }
}

export async function runImportQueue(job: ImportJob, onChange: (job: ImportJob) => Promise<void> | void, shouldPause: () => boolean, selectedOnly = false) {
  job.running = true; job.paused = false; await onChange({ ...job });
  const queue = job.rows.filter((row) => (!selectedOnly || row.selected) && ['ready', 'pending', 'failed', 'geocoded', 'static_map_ready', 'poi_ready'].includes(row.status)); let cursor = 0;
  const worker = async () => { while (cursor < queue.length) { if (shouldPause()) break; const row = queue[cursor++]; await processRow(job, row); job.processedRows = job.rows.filter((item) => ['completed', 'failed', 'invalid', 'address_review_required', 'skipped'].includes(item.status)).length; await onChange({ ...job, rows: [...job.rows] }); } };
  await Promise.all(Array.from({ length: Math.min(job.concurrency, queue.length) }, worker)); job.running = false; job.paused = shouldPause(); await onChange({ ...job, rows: [...job.rows] });
}

export const selectAddressCandidate = (row: ImportRow, index: number) => ({ ...row, selectedAddressCandidateIndex: index, status: 'geocoded' as const, issues: row.issues.filter((issue) => issue.code !== 'NAVER_MULTIPLE_RESULTS') });
export const selectedPoiItems = (row: ImportRow): BriefingItem[] => (row.poiCandidates ?? []).filter((poi) => poi.selected).map((poi) => ({ category: poi.briefingCategory, name: poi.name, description: `${poi.distanceMeters?.toLocaleString('ko-KR') ?? '-'}m · ${poi.category || 'Kakao POI'}`, source: 'kakao', distanceMeters: poi.distanceMeters, latitude: poi.latitude, longitude: poi.longitude }));
export function propertyFromImportRow(row: ImportRow): Property {
  const now = new Date().toISOString(); const address = row.selectedAddressCandidateIndex == null ? undefined : row.addressCandidates?.[row.selectedAddressCandidateIndex];
  return { ...emptyProperty, ...row.normalizedProperty, id: String(row.normalizedProperty.id || crypto.randomUUID()), latitude: address?.latitude, longitude: address?.longitude, address: address?.roadAddress || address?.jibunAddress || String(row.normalizedProperty.address || ''), mapImage: row.generatedMapImage || '', briefingItems: selectedPoiItems(row), briefingUpdatedAt: selectedPoiItems(row).length ? now : '', createdAt: now, updatedAt: now } as Property;
}
