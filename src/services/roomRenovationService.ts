import type { RenovationScope, RoomRenovationAssessment } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import type { RoomIntelligenceView } from './roomIntelligenceService';

function includesAny(value: string, words: string[]) {
  const normalized = value.toLowerCase();
  return words.some((word) => normalized.includes(word.toLowerCase()));
}

function chooseScope(view: RoomIntelligenceView): RenovationScope {
  const condition = view.space.currentCondition || '';
  const poorFacility = view.facilities.some((item) => item.condition === 'poor');
  const fairFacility = view.facilities.some((item) => item.condition === 'fair');
  if (includesAny(condition, ['철거', '전면', '노후 심각', '전면 교체'])) return 'full';
  if (poorFacility || fairFacility || (condition && !includesAny(condition, ['양호', 'good', '우수']))) return 'partial';
  return 'retain';
}

export function buildRoomRenovationDraft(view: RoomIntelligenceView): Omit<RoomRenovationAssessment, 'id' | 'createdAt' | 'updatedAt'> {
  const scope = chooseScope(view);
  const recommendedItems: string[] = [];
  const riskItems: string[] = [];

  if (view.space.currentCondition) recommendedItems.push(`현재 상태 재확인: ${view.space.currentCondition}`);
  else riskItems.push('공간 현재 상태가 확인되지 않았습니다.');
  if (view.space.recommendedUse) recommendedItems.push(`사용 방향 검토: ${view.space.recommendedUse}`);
  for (const facility of view.facilities) {
    if (facility.condition === 'poor') recommendedItems.push(`${facility.name} 교체/보수 범위 현장 확인`);
    else if (facility.condition === 'fair') recommendedItems.push(`${facility.name} 성능 및 잔존수명 확인`);
    else if (facility.condition === 'unknown') riskItems.push(`${facility.name} 상태 미확인`);
  }
  if (!view.media.length) riskItems.push('공간 직접 연결 사진이 없어 시각 근거가 부족합니다.');
  if (!view.visionResults.length) riskItems.push('Interior Vision 근거가 연결되지 않았습니다.');
  riskItems.push('벽체 구조·방수·전기용량·설비성능·소방·인허가·정확 비용은 별도 현장/전문가 검토가 필요합니다.');

  const evidenceRefs = [view.link.id, view.space.id, view.room.assetId, view.room.roomCandidate.id, ...view.media.map((item) => item.id), ...view.facilities.map((item) => item.id), ...view.visionResults.map((item) => item.id)];
  return {
    propertyId: view.space.propertyId,
    spaceId: view.space.id,
    digitalTwinAssetId: view.room.assetId,
    roomCandidateId: view.room.roomCandidate.id,
    title: `${view.space.name} 공간 리노베이션 검토`,
    scope,
    summary: `승인된 Interior ↔ 3D Room 연결과 현재 Data Room 근거를 바탕으로 만든 방 단위 검토 초안입니다. 자동 생성값은 확정 공사 범위가 아닙니다.`,
    recommendedItems: [...new Set(recommendedItems)],
    riskItems: [...new Set(riskItems)],
    costStatus: 'not_estimated',
    decision: 'draft',
    sourceType: 'agent_candidate',
    evidenceRefs: [...new Set(evidenceRefs)],
  };
}

export async function saveRoomRenovationDraft(view: RoomIntelligenceView) {
  const now = new Date().toISOString();
  const existing = await propertyDataRoomRepository.getRoomRenovationAssessments(view.space.propertyId);
  const previous = existing.find((item) => item.spaceId === view.space.id && item.digitalTwinAssetId === view.room.assetId && item.roomCandidateId === view.room.roomCandidate.id && item.decision === 'draft');
  const draft = buildRoomRenovationDraft(view);
  const row: RoomRenovationAssessment = { ...draft, id: previous?.id || crypto.randomUUID(), createdAt: previous?.createdAt || now, updatedAt: now };
  await propertyDataRoomRepository.saveRoomRenovationAssessment(row);
  await propertyDataRoomRepository.saveDataSource({
    id: crypto.randomUUID(), propertyId: row.propertyId, resourceType: 'room_renovation_assessment', sourceType: 'ai', sourceName: 'Room Renovation Candidate', sourceReference: row.roomCandidateId,
    collectedAt: now, verificationStatus: 'unverified', metadata: { assessmentId: row.id, decision: row.decision, scope: row.scope, evidenceRefs: row.evidenceRefs }, createdAt: now,
  });
  return row;
}

export async function reviewRoomRenovationAssessment(assessment: RoomRenovationAssessment, decision: 'approved' | 'held' | 'rejected', reviewedBy?: string) {
  const now = new Date().toISOString();
  const updated: RoomRenovationAssessment = { ...assessment, decision, reviewedBy, reviewedAt: now, updatedAt: now };
  await propertyDataRoomRepository.saveRoomRenovationAssessment(updated);
  await propertyDataRoomRepository.saveDataSource({
    id: crypto.randomUUID(), propertyId: assessment.propertyId, resourceType: 'room_renovation_assessment', sourceType: 'manual', sourceName: 'Room Renovation Human Review', sourceReference: assessment.roomCandidateId,
    collectedAt: now, verificationStatus: decision === 'approved' ? 'confirmed' : 'unverified', metadata: { assessmentId: assessment.id, decision, scope: assessment.scope }, createdAt: now,
  });
  return updated;
}

export const roomRenovationService = { buildDraft: buildRoomRenovationDraft, saveDraft: saveRoomRenovationDraft, review: reviewRoomRenovationAssessment };
