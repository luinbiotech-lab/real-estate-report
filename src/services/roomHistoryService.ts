import type { RoomConditionHistoryEntry, RoomConditionRating, RoomRenovationAssessment, RoomRenovationHistoryEntry } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';

export async function addRoomConditionHistory(input: {
  propertyId: string; spaceId: string; digitalTwinAssetId: string; roomCandidateId: string;
  rating: RoomConditionRating; summary: string; evidenceRefs: string[]; recordedBy?: string;
}) {
  const now = new Date().toISOString();
  const row: RoomConditionHistoryEntry = {
    id: crypto.randomUUID(), propertyId: input.propertyId, spaceId: input.spaceId, digitalTwinAssetId: input.digitalTwinAssetId, roomCandidateId: input.roomCandidateId,
    rating: input.rating, summary: input.summary.trim() || '상태 메모 없음', evidenceRefs: [...new Set(input.evidenceRefs)], recordedBy: input.recordedBy,
    recordedAt: now, createdAt: now,
  };
  await propertyDataRoomRepository.saveRoomConditionHistory(row);
  await propertyDataRoomRepository.saveDataSource({
    id: crypto.randomUUID(), propertyId: input.propertyId, resourceType: 'room_condition_history', sourceType: 'manual', sourceName: 'Room Condition Human Review', sourceReference: input.roomCandidateId,
    collectedAt: now, verificationStatus: 'confirmed', metadata: { conditionHistoryId: row.id, rating: row.rating, evidenceRefs: row.evidenceRefs }, createdAt: now,
  });
  return row;
}

export async function appendRoomRenovationHistory(assessment: RoomRenovationAssessment, action: RoomRenovationHistoryEntry['action'], actor?: string) {
  const now = new Date().toISOString();
  const row: RoomRenovationHistoryEntry = {
    id: crypto.randomUUID(), propertyId: assessment.propertyId, spaceId: assessment.spaceId, digitalTwinAssetId: assessment.digitalTwinAssetId, roomCandidateId: assessment.roomCandidateId,
    assessmentId: assessment.id, action, scope: assessment.scope, summary: assessment.summary, evidenceRefs: [...assessment.evidenceRefs], actor, recordedAt: now, createdAt: now,
  };
  await propertyDataRoomRepository.saveRoomRenovationHistory(row);
  return row;
}

export const roomHistoryService = { addCondition: addRoomConditionHistory, appendRenovation: appendRoomRenovationHistory };
