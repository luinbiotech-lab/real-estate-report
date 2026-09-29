import type { AgentJob, AgentResult, MediaCategory, PropertyMedia, PropertySpace, SpaceMediaLink, SpaceType } from '../domain/propertyDataRoom/types';
import { spaceAgentPort } from '../agents/agentDataPorts';
import { agentOrchestratorService } from './agentOrchestratorService';

type SpaceCandidate = {
  name: string;
  spaceType: SpaceType;
  floor?: string;
  roomCode?: string;
  mediaIds: string[];
  confidence: number;
};

const SPACE_TYPE_BY_CATEGORY: Partial<Record<MediaCategory, SpaceType>> = {
  lobby: 'lobby', office: 'office', corridor: 'corridor', restroom: 'restroom', basement: 'basement',
  rooftop: 'rooftop', parking: 'parking', mechanical_room: 'mechanical', mechanical: 'mechanical',
};

function combinedText(media: PropertyMedia) {
  return [media.fileName, media.caption, media.floor, media.room, ...media.aiTags].filter(Boolean).join(' ');
}

function inferFloor(text: string): string | undefined {
  const basement = text.match(/(?:지하\s*|\bB)(\d+)\s*(?:층|F)?/i);
  if (basement) return `B${basement[1]}`;
  const ground = text.match(/(?:지상\s*)?(\d+)\s*(?:층|F\b)/i);
  if (ground) return `${ground[1]}F`;
  return undefined;
}

function inferRoom(text: string, category: MediaCategory): string | undefined {
  const named = text.match(/(?:실|room|호)\s*[-_ ]?([A-Za-z0-9가-힣]+)/i);
  if (named) return named[1];
  const labels: Partial<Record<MediaCategory, string>> = {
    lobby: '로비', office: '사무공간', corridor: '복도', restroom: '화장실', basement: '지하공간', rooftop: '옥상', parking: '주차공간', mechanical_room: '기계·설비실', entrance: '출입구', interior: '실내공간',
  };
  return labels[category];
}

function spaceTypeFromMedia(media: PropertyMedia): SpaceType {
  if (SPACE_TYPE_BY_CATEGORY[media.category]) return SPACE_TYPE_BY_CATEGORY[media.category]!;
  const text = combinedText(media);
  if (/상가|매장|retail|shop/i.test(text)) return 'retail';
  if (/주거|주택|residential|bedroom/i.test(text)) return 'residential';
  if (/창고|storage/i.test(text)) return 'storage';
  return 'other';
}

export const spaceAgentExecutionService = {
  async execute(sourceJob: AgentJob) {
    let job = sourceJob;
    try {
      if (job.status !== 'running') job = await agentOrchestratorService.start(job);
      const media = await spaceAgentPort.getMedia(job.propertyId);
      const groups = new Map<string, SpaceCandidate>();
      for (const item of media.filter((entry) => entry.mediaType === 'image' && entry.category !== 'floor_plan')) {
        const floor = item.floor || inferFloor(combinedText(item));
        const room = item.room || inferRoom(combinedText(item), item.category);
        const spaceType = spaceTypeFromMedia(item);
        const name = [floor, room || item.category].filter(Boolean).join(' ') || '공간 미지정';
        const key = `${floor || ''}|${room || ''}|${spaceType}`;
        const current = groups.get(key);
        if (current) current.mediaIds.push(item.id);
        else groups.set(key, { name, spaceType, floor, roomCode: room, mediaIds: [item.id], confidence: item.verificationStatus === 'confirmed' ? 0.9 : 0.65 });
      }
      const spaces = [...groups.values()];
      const confidence = spaces.length ? spaces.reduce((sum, item) => sum + item.confidence, 0) / spaces.length : 0;
      return agentOrchestratorService.complete(job, {
        resultType: 'space_model_candidate',
        payload: { spaces, method: 'media_grouping', adapterVersion: 'space-model-v2-isolated-port' },
        confidence,
        requiresReview: spaces.length > 0,
      });
    } catch (error) {
      await agentOrchestratorService.fail(job, error);
      throw error;
    }
  },

  async applyApproved(result: AgentResult) {
    if (result.resultType !== 'space_model_candidate') return;
    const candidates = Array.isArray(result.payload.spaces) ? result.payload.spaces as SpaceCandidate[] : [];
    const existingSpaces = await spaceAgentPort.getSpaces(result.propertyId);
    const existingLinks = await spaceAgentPort.getSpaceMediaLinks(result.propertyId);
    for (const candidate of candidates) {
      const existing = existingSpaces.find((space) => space.floor === candidate.floor && space.name === candidate.name && space.spaceType === candidate.spaceType);
      const now = new Date().toISOString();
      const space: PropertySpace = existing ?? {
        id: crypto.randomUUID(), propertyId: result.propertyId, name: candidate.name, spaceType: candidate.spaceType, floor: candidate.floor, roomCode: candidate.roomCode,
        sourceType: 'agent', sourceAgentResultId: result.id, verificationStatus: 'confirmed', createdAt: now, updatedAt: now,
      };
      if (!existing) await spaceAgentPort.saveSpace(space);
      for (const mediaId of candidate.mediaIds) {
        if (existingLinks.some((link) => link.spaceId === space.id && link.mediaId === mediaId)) continue;
        const link: SpaceMediaLink = { id: crypto.randomUUID(), propertyId: result.propertyId, spaceId: space.id, mediaId, confidence: candidate.confidence, sourceAgentResultId: result.id, createdAt: now };
        await spaceAgentPort.saveSpaceMediaLink(link);
      }
    }
  },
};
