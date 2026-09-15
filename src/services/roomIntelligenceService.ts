import type { AgentResult, DigitalTwinAsset, PropertyFacility, PropertyMedia, PropertySpace, RenovationAssessment, SpaceMediaLink, SpaceRoomLink } from '../domain/propertyDataRoom/types';
import { interiorRoomLinkService, type ApprovedTwinRoom } from './interiorRoomLinkService';

export interface RoomIntelligenceView {
  link: SpaceRoomLink;
  space: PropertySpace;
  room: ApprovedTwinRoom;
  media: PropertyMedia[];
  facilities: PropertyFacility[];
  floorFacilities: PropertyFacility[];
  visionResults: AgentResult[];
  renovationContext: RenovationAssessment[];
  evidence: {
    directMediaCount: number;
    directFacilityCount: number;
    visionResultCount: number;
    hasCondition: boolean;
    hasRecommendedUse: boolean;
  };
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

export function buildRoomIntelligenceViews(input: {
  spaces: PropertySpace[];
  assets: DigitalTwinAsset[];
  links: SpaceRoomLink[];
  media: PropertyMedia[];
  spaceMediaLinks: SpaceMediaLink[];
  facilities: PropertyFacility[];
  agentResults: AgentResult[];
  renovationAssessments: RenovationAssessment[];
}): RoomIntelligenceView[] {
  const rooms = interiorRoomLinkService.listApprovedRooms(input.assets);
  const mediaById = new Map(input.media.map((item) => [item.id, item]));
  const resultById = new Map(input.agentResults.map((item) => [item.id, item]));

  return input.links
    .filter((link) => link.decision === 'approved')
    .flatMap((link): RoomIntelligenceView[] => {
      const space = input.spaces.find((item) => item.id === link.spaceId);
      const room = rooms.find((item) => item.assetId === link.digitalTwinAssetId && item.roomCandidate.id === link.roomCandidateId);
      if (!space || !room) return [];

      const relatedMediaLinks = input.spaceMediaLinks.filter((item) => item.spaceId === space.id);
      const directMedia = relatedMediaLinks.map((item) => mediaById.get(item.mediaId)).filter((item): item is PropertyMedia => Boolean(item));
      const directFacilities = input.facilities.filter((item) => item.spaceId === space.id);
      const floorFacilities = input.facilities.filter((item) => !item.spaceId && item.floor && space.floor && item.floor.trim().toLowerCase() === space.floor.trim().toLowerCase());
      const visionIds = new Set<string>([
        ...(space.sourceAgentResultId ? [space.sourceAgentResultId] : []),
        ...relatedMediaLinks.flatMap((item) => item.sourceAgentResultId ? [item.sourceAgentResultId] : []),
        ...directFacilities.flatMap((item) => item.sourceAgentResultId ? [item.sourceAgentResultId] : []),
      ]);
      const visionResults = uniqueById([...visionIds].map((id) => resultById.get(id)).filter((item): item is AgentResult => Boolean(item && item.agentType === 'interior_vision')));

      return [{
        link,
        space,
        room,
        media: directMedia.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder),
        facilities: directFacilities,
        floorFacilities,
        visionResults,
        renovationContext: input.renovationAssessments.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        evidence: {
          directMediaCount: directMedia.length,
          directFacilityCount: directFacilities.length,
          visionResultCount: visionResults.length,
          hasCondition: Boolean(space.currentCondition?.trim()),
          hasRecommendedUse: Boolean(space.recommendedUse?.trim()),
        },
      }];
    })
    .sort((a, b) => (a.space.floor || '').localeCompare(b.space.floor || '') || a.space.name.localeCompare(b.space.name));
}

export const roomIntelligenceService = { buildViews: buildRoomIntelligenceViews };
