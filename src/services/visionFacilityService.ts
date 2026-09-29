import type { AgentResult, FacilityCategory, MediaCategory, PropertyFacility } from '../domain/propertyDataRoom/types';
import { interiorVisionAgentPort } from '../agents/agentDataPorts';

type VisionCandidate = {
  mediaId?: string;
  suggestedCategory?: MediaCategory;
  suggestedFloor?: string;
  suggestedRoom?: string;
  tags?: string[];
  visualSignals?: { qualityTags?: string[]; conditionHints?: string[] };
};

const FACILITY_BY_CATEGORY: Partial<Record<MediaCategory, Array<{ category: FacilityCategory; name: string }>>> = {
  restroom: [
    { category: 'restroom', name: '화장실' },
    { category: 'plumbing', name: '급배수 설비' },
  ],
  mechanical_room: [
    { category: 'hvac', name: '냉난방·기계설비' },
    { category: 'electrical', name: '전기설비' },
  ],
};

export const visionFacilityService = {
  async applyApprovedVisionResult(result: AgentResult) {
    if (result.resultType !== 'media_classification_candidate') return [] as PropertyFacility[];
    const candidates = Array.isArray(result.payload.candidates) ? result.payload.candidates as VisionCandidate[] : [];
    const existing = await interiorVisionAgentPort.getFacilities(result.propertyId);
    const created: PropertyFacility[] = [];
    for (const candidate of candidates) {
      const mappings = candidate.suggestedCategory ? FACILITY_BY_CATEGORY[candidate.suggestedCategory] ?? [] : [];
      for (const mapping of mappings) {
        const duplicate = existing.some((item) => item.category === mapping.category && item.floor === candidate.suggestedFloor && item.name === mapping.name);
        if (duplicate) continue;
        const qualityTags = candidate.visualSignals?.qualityTags ?? [];
        const conditionHints = candidate.visualSignals?.conditionHints ?? [];
        const noteParts = [candidate.suggestedRoom, ...qualityTags, ...conditionHints].filter(Boolean);
        const now = new Date().toISOString();
        const facility: PropertyFacility = {
          id: crypto.randomUUID(), propertyId: result.propertyId, category: mapping.category, name: mapping.name,
          floor: candidate.suggestedFloor, condition: 'unknown',
          notes: noteParts.length ? `승인된 Vision 결과 기반 인벤토리 · ${noteParts.join(' · ')}` : '승인된 Vision 결과 기반 인벤토리. 실제 상태는 현장 확인 필요.',
          sourceType: 'agent', sourceAgentResultId: result.id, verificationStatus: 'confirmed', createdAt: now, updatedAt: now,
        };
        await interiorVisionAgentPort.saveFacility(facility);
        existing.push(facility); created.push(facility);
      }
    }
    return created;
  },
};
