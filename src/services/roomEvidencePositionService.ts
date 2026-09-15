import type { RoomEvidenceAnchor, RoomEvidencePosition, RoomEvidenceResourceType } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';

function pointInPolygon(point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    const intersect = ((a.y > point.y) !== (b.y > point.y)) && (point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || Number.EPSILON) + a.x);
    if (intersect) inside = !inside;
  }
  return inside;
}

function normalizeBounds(points: Array<{ x: number; y: number }>) {
  const xs = points.map((item) => item.x), ys = points.map((item) => item.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  return { minX, minY, width: maxX - minX || 1, height: maxY - minY || 1 };
}

export function normalizedToDrawing(points: Array<{ x: number; y: number }>, normalizedX: number, normalizedY: number) {
  const bounds = normalizeBounds(points);
  return { x: bounds.minX + bounds.width * normalizedX, y: bounds.minY + bounds.height * normalizedY };
}

export function validateRoomEvidencePosition(points: Array<{ x: number; y: number }>, normalizedX: number, normalizedY: number, normalizedZ: number) {
  if (points.length < 3) return { valid: false, reason: '검토된 room boundary가 없습니다.' };
  if (![normalizedX, normalizedY, normalizedZ].every(Number.isFinite)) return { valid: false, reason: '좌표가 숫자가 아닙니다.' };
  if (normalizedX < 0 || normalizedX > 1 || normalizedY < 0 || normalizedY > 1 || normalizedZ < 0 || normalizedZ > 1) return { valid: false, reason: '정규화 좌표는 0~1 범위여야 합니다.' };
  const drawingPoint = normalizedToDrawing(points, normalizedX, normalizedY);
  if (!pointInPolygon(drawingPoint, points)) return { valid: false, reason: '선택 위치가 room boundary 밖입니다.' };
  return { valid: true, reason: '', drawingPoint };
}

export async function saveRoomEvidencePosition(input: {
  propertyId: string; spaceId: string; digitalTwinAssetId: string; roomCandidateId: string;
  resourceType: RoomEvidenceResourceType; resourceId: string; normalizedX: number; normalizedY: number; normalizedZ: number;
  anchor: RoomEvidenceAnchor; decision: 'approved' | 'held' | 'rejected'; note: string; reviewedBy?: string;
  roomPoints: Array<{ x: number; y: number }>;
}) {
  const validation = validateRoomEvidencePosition(input.roomPoints, input.normalizedX, input.normalizedY, input.normalizedZ);
  if (!validation.valid) throw new Error(validation.reason);
  const now = new Date().toISOString();
  const existing = await propertyDataRoomRepository.getRoomEvidencePositions(input.propertyId);
  const previous = existing.find((item) => item.spaceId === input.spaceId && item.digitalTwinAssetId === input.digitalTwinAssetId && item.roomCandidateId === input.roomCandidateId && item.resourceType === input.resourceType && item.resourceId === input.resourceId);
  const row: RoomEvidencePosition = {
    id: previous?.id || crypto.randomUUID(), propertyId: input.propertyId, spaceId: input.spaceId, digitalTwinAssetId: input.digitalTwinAssetId, roomCandidateId: input.roomCandidateId,
    resourceType: input.resourceType, resourceId: input.resourceId, normalizedX: input.normalizedX, normalizedY: input.normalizedY, normalizedZ: input.normalizedZ,
    anchor: input.anchor, decision: input.decision, note: input.note, reviewedBy: input.reviewedBy, reviewedAt: now, createdAt: previous?.createdAt || now, updatedAt: now,
  };
  await propertyDataRoomRepository.saveRoomEvidencePosition(row);
  await propertyDataRoomRepository.saveDataSource({
    id: crypto.randomUUID(), propertyId: input.propertyId, resourceType: 'room_evidence_position', sourceType: 'manual', sourceName: 'Room Evidence Position Human Review', sourceReference: input.resourceId,
    collectedAt: now, verificationStatus: input.decision === 'approved' ? 'confirmed' : 'unverified', metadata: { positionId: row.id, resourceType: input.resourceType, normalizedX: input.normalizedX, normalizedY: input.normalizedY, normalizedZ: input.normalizedZ, anchor: input.anchor, decision: input.decision }, createdAt: now,
  });
  return row;
}

export const roomEvidencePositionService = { save: saveRoomEvidencePosition, validate: validateRoomEvidencePosition, normalizedToDrawing };
