/*
 * Address lookup → property in one step (2026-11-12 redesign, phase 3).
 * Uses the same save path as the registration form: same record builder, discovery evidence persisted to the
 * Data Room as source records (not verified facts), market presence and street-view provenance records.
 * Only the identification fields from the lookup are filled; everything else stays empty for a person to enter.
 */
import { buildPropertyToSave } from '../domain/propertyDetail/propertyDetailModel';
import { propertyRepository } from '../repositories/propertyRepository';
import { emptyProperty, type Property } from '../types';
import { marketPresenceService } from './marketPresenceService';
import { publicPropertyDiscoveryService, type PropertyDiscoveryResult } from './publicPropertyDiscoveryService';
import { streetViewProvenanceService } from './streetViewProvenanceService';

export { quickCreateBlockReason } from '../domain/propertyDetail/quickCreateRules';

export function buildQuickProperty(result: PropertyDiscoveryResult, now: string, newId: () => string): Property {
  const patch = publicPropertyDiscoveryService.patchFrom(result);
  const address = patch.address || result.address?.roadAddress || result.address?.lotAddress || '';
  const draft: Property = { ...emptyProperty, ...patch, address, name: patch.name || address };
  if (!draft.name || !draft.address) throw new Error('주소 확인 결과에 물건명·주소가 없어 바로 등록할 수 없습니다.');
  return buildPropertyToSave(draft, undefined, 'new', now, newId);
}

export async function createPropertyFromDiscovery(result: PropertyDiscoveryResult): Promise<Property> {
  const data = buildQuickProperty(result, new Date().toISOString(), () => crypto.randomUUID());
  await propertyRepository.create(data);
  await publicPropertyDiscoveryService.persist(data.id, result);
  await marketPresenceService.persist(data);
  await streetViewProvenanceService.ensure(data);
  return data;
}
