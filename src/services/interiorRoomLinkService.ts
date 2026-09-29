import type { DigitalTwinAsset, PropertySpace, SpaceRoomLink } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { roomTopologyService, type RoomBoundaryCandidate } from './roomTopologyService';

export interface ApprovedTwinRoom {
  assetId: string;
  assetLabel: string;
  floor?: string;
  roomCandidate: RoomBoundaryCandidate;
  roomName: string;
}

export interface SpaceRoomMatchCandidate {
  space: PropertySpace;
  room: ApprovedTwinRoom;
  confidence: number;
  basis: string[];
  status: 'candidate';
}

function normalize(value?: string) {
  return (value || '').trim().toLowerCase().replace(/\s+/g, '');
}

function similarity(a?: string, b?: string) {
  const left = normalize(a); const right = normalize(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.75;
  const common = [...new Set(left)].filter((char) => right.includes(char)).length;
  return common / Math.max(new Set(left).size, new Set(right).size, 1);
}

function floorMatches(spaceFloor?: string, roomFloor?: string) {
  if (!spaceFloor || !roomFloor) return undefined;
  return normalize(spaceFloor) === normalize(roomFloor);
}

function typeNameHint(space: PropertySpace) {
  const map: Record<PropertySpace['spaceType'], string[]> = {
    retail: ['판매', '매장', 'retail'], office: ['사무', 'office'], residential: ['주거', 'residential'], lobby: ['로비', 'lobby'], corridor: ['복도', 'corridor'], restroom: ['화장실', 'restroom', 'toilet'], parking: ['주차', 'parking'], basement: ['지하', 'basement'], rooftop: ['옥상', 'rooftop'], mechanical: ['기계', 'mechanical'], storage: ['창고', 'storage'], other: [],
  };
  return map[space.spaceType];
}

function areaScore(spaceArea?: number, roomArea?: number) {
  if (!(spaceArea && roomArea && spaceArea > 0 && roomArea > 0)) return undefined;
  const ratio = Math.min(spaceArea, roomArea) / Math.max(spaceArea, roomArea);
  return ratio;
}

export function listApprovedTwinRooms(assets: DigitalTwinAsset[]): ApprovedTwinRoom[] {
  return assets.flatMap((asset) => {
    const reviews = roomTopologyService.buildCandidates(asset);
    const reviewById = new Map((Array.isArray(asset.metadata.roomTopologyReviews) ? asset.metadata.roomTopologyReviews : []).filter((item): item is { candidateId: string; decision: string; name?: string } => Boolean(item && typeof item === 'object' && typeof (item as { candidateId?: string }).candidateId === 'string')).map((item) => [item.candidateId, item]));
    return reviews.flatMap((room): ApprovedTwinRoom[] => {
      const review = reviewById.get(room.id);
      if (!review || review.decision !== 'approved') return [];
      return [{ assetId: asset.id, assetLabel: asset.fileName || asset.floor || asset.id, floor: asset.floor, roomCandidate: room, roomName: review.name || room.layer || '공간명 미지정' }];
    });
  });
}

export function buildSpaceRoomMatchCandidates(spaces: PropertySpace[], assets: DigitalTwinAsset[]): SpaceRoomMatchCandidate[] {
  const rooms = listApprovedTwinRooms(assets);
  const result: SpaceRoomMatchCandidate[] = [];
  for (const space of spaces) for (const room of rooms) {
    let score = 0; const basis: string[] = [];
    const floorMatch = floorMatches(space.floor, room.floor);
    if (floorMatch === true) { score += 0.35; basis.push('층 일치'); }
    else if (floorMatch === false) score -= 0.45;
    const nameSim = similarity(space.name, room.roomName);
    if (nameSim >= 0.7) { score += 0.35 * nameSim; basis.push('공간명 유사'); }
    const hints = typeNameHint(space);
    if (hints.some((hint) => normalize(room.roomName).includes(normalize(hint)))) { score += 0.18; basis.push('공간 유형 일치'); }
    const aScore = areaScore(space.areaSqm, room.roomCandidate.areaSqmCandidate);
    if (aScore !== undefined && aScore >= 0.7) { score += 0.12 * aScore; basis.push('면적 후보 유사'); }
    if (score <= 0) continue;
    result.push({ space, room, confidence: Math.max(0, Math.min(0.98, score)), basis, status: 'candidate' });
  }
  return result.sort((a, b) => b.confidence - a.confidence);
}

export async function reviewSpaceRoomLink(input: { propertyId: string; spaceId: string; digitalTwinAssetId: string; roomCandidateId: string; decision: SpaceRoomLink['decision']; confidence?: number; basis: string[]; reviewedBy?: string; }) {
  const now = new Date().toISOString();
  const existing = await propertyDataRoomRepository.getSpaceRoomLinks(input.propertyId);
  const previous = existing.find((item) => item.spaceId === input.spaceId && item.digitalTwinAssetId === input.digitalTwinAssetId && item.roomCandidateId === input.roomCandidateId);
  const row: SpaceRoomLink = {
    id: previous?.id || crypto.randomUUID(), propertyId: input.propertyId, spaceId: input.spaceId, digitalTwinAssetId: input.digitalTwinAssetId, roomCandidateId: input.roomCandidateId,
    decision: input.decision, confidence: input.confidence, basis: input.basis, reviewedBy: input.reviewedBy, reviewedAt: now,
    createdAt: previous?.createdAt || now, updatedAt: now,
  };
  await propertyDataRoomRepository.saveSpaceRoomLink(row);
  await propertyDataRoomRepository.saveDataSource({
    id: crypto.randomUUID(), propertyId: input.propertyId, resourceType: 'interior_space_room_link', sourceType: 'manual', sourceName: 'Interior ↔ Digital Twin Room Human Review', sourceReference: input.digitalTwinAssetId,
    collectedAt: now, verificationStatus: input.decision === 'approved' ? 'confirmed' : 'unverified', confidence: input.confidence,
    metadata: { spaceId: input.spaceId, roomCandidateId: input.roomCandidateId, decision: input.decision, basis: input.basis }, createdAt: now,
  });
  return row;
}

export const interiorRoomLinkService = { listApprovedRooms: listApprovedTwinRooms, buildCandidates: buildSpaceRoomMatchCandidates, review: reviewSpaceRoomLink };
