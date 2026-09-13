import type { AgentJob, AgentResult, AgentReview, AgentReviewDecision, DigitalTwinAsset, MediaCategory, PropertyMedia, PropertySpace, SpaceMediaLink, SpaceType } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { agentOrchestratorService } from './agentOrchestratorService';

type MediaCandidate = {
  mediaId: string;
  currentCategory: MediaCategory;
  suggestedCategory: MediaCategory;
  suggestedFloor?: string;
  suggestedRoom?: string;
  tags: string[];
  confidence: number;
};

type SpaceCandidate = {
  name: string;
  spaceType: SpaceType;
  floor?: string;
  roomCode?: string;
  mediaIds: string[];
  confidence: number;
};

const CATEGORY_RULES: Array<{ category: MediaCategory; patterns: RegExp[]; tags: string[] }> = [
  { category: 'lobby', patterns: [/로비/i, /lobby/i, /reception/i], tags: ['공용공간', '로비'] },
  { category: 'office', patterns: [/사무/i, /office/i, /업무/i], tags: ['업무공간'] },
  { category: 'corridor', patterns: [/복도/i, /corridor/i, /hallway/i], tags: ['공용동선'] },
  { category: 'restroom', patterns: [/화장실/i, /toilet/i, /restroom/i, /wc/i], tags: ['위생시설'] },
  { category: 'basement', patterns: [/지하/i, /basement/i, /\bb\d+\b/i], tags: ['지하공간'] },
  { category: 'rooftop', patterns: [/옥상/i, /rooftop/i, /terrace/i], tags: ['옥상'] },
  { category: 'parking', patterns: [/주차/i, /parking/i, /garage/i], tags: ['주차'] },
  { category: 'mechanical_room', patterns: [/기계실/i, /전기실/i, /보일러/i, /mechanical/i, /utility/i], tags: ['설비공간'] },
  { category: 'entrance', patterns: [/출입구/i, /입구/i, /entrance/i, /entry/i], tags: ['출입동선'] },
  { category: 'facade_detail', patterns: [/파사드/i, /외벽/i, /facade/i], tags: ['파사드'] },
  { category: 'floor_plan', patterns: [/평면도/i, /도면/i, /floor.?plan/i], tags: ['도면'] },
  { category: 'interior', patterns: [/실내/i, /인테리어/i, /interior/i, /room/i], tags: ['실내'] },
];

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

function classifyMedia(media: PropertyMedia): MediaCandidate {
  const text = combinedText(media);
  const matched = CATEGORY_RULES.find((rule) => rule.patterns.some((pattern) => pattern.test(text)));
  const suggestedCategory = matched?.category ?? (media.category === 'other' ? 'interior' : media.category);
  const inferredFloor = media.floor || inferFloor(text);
  const inferredRoom = media.room || inferRoom(text, suggestedCategory);
  const confidence = matched ? 0.82 : media.category !== 'other' ? 0.7 : 0.5;
  return {
    mediaId: media.id,
    currentCategory: media.category,
    suggestedCategory,
    suggestedFloor: inferredFloor,
    suggestedRoom: inferredRoom,
    tags: Array.from(new Set([...media.aiTags, ...(matched?.tags ?? []), suggestedCategory])),
    confidence,
  };
}

function spaceTypeFromMedia(media: PropertyMedia): SpaceType {
  if (SPACE_TYPE_BY_CATEGORY[media.category]) return SPACE_TYPE_BY_CATEGORY[media.category]!;
  const text = combinedText(media);
  if (/상가|매장|retail|shop/i.test(text)) return 'retail';
  if (/주거|주택|residential|bedroom/i.test(text)) return 'residential';
  if (/창고|storage/i.test(text)) return 'storage';
  return 'other';
}

function floorPlanAssetType(fileName: string, mimeType: string): DigitalTwinAsset['assetType'] {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.dwg')) return 'dwg';
  if (lower.endsWith('.dxf')) return 'dxf';
  if (mimeType.startsWith('image/')) return 'scanned_plan';
  return 'floor_plan';
}

async function executeInterior(job: AgentJob) {
  const media = job.resourceType === 'media' && job.resourceId
    ? [await propertyDataRoomRepository.getMediaItem(job.resourceId)].filter(Boolean) as PropertyMedia[]
    : (await propertyDataRoomRepository.getMedia(job.propertyId)).filter((item) => item.mediaType === 'image' && item.category !== 'floor_plan');
  const candidates = media.map(classifyMedia);
  const confidence = candidates.length ? candidates.reduce((sum, item) => sum + item.confidence, 0) / candidates.length : 0;
  return agentOrchestratorService.complete(job, {
    resultType: 'media_classification_candidate',
    payload: { candidates, method: 'local_metadata_rules', adapterVersion: 'interior-metadata-v1' },
    confidence,
    requiresReview: candidates.length > 0,
  });
}

async function executeFloorPlan(job: AgentJob) {
  if (!job.resourceId) {
    return agentOrchestratorService.complete(job, {
      resultType: 'floor_plan_intake_candidate', payload: { message: '도면 문서·미디어·원본 CAD 자산을 연결해야 합니다.' }, confidence: 0, requiresReview: true,
    });
  }
  if (job.resourceType === 'digital_twin') {
    const asset = (await propertyDataRoomRepository.getDigitalTwinAssets(job.propertyId)).find((item) => item.id === job.resourceId);
    if (!asset) throw new Error('Floor Plan Agent가 참조할 Digital Twin 원본을 찾을 수 없습니다.');
    const floor = asset.floor || inferFloor(asset.fileName || '');
    return agentOrchestratorService.complete(job, {
      resultType: 'floor_plan_intake_candidate',
      payload: {
        sourceDigitalTwinAssetId: asset.id,
        fileName: asset.fileName || '',
        mimeType: asset.mimeType || '',
        storagePath: asset.storagePath,
        assetType: asset.assetType,
        floor,
        nextAgent: 'digital_twin',
      },
      confidence: floor ? 0.88 : 0.75,
      requiresReview: true,
    });
  }
  if (job.resourceType === 'document') {
    const document = await propertyDataRoomRepository.getDocument(job.resourceId);
    if (!document) throw new Error('Floor Plan Agent가 참조할 문서를 찾을 수 없습니다.');
    const floor = inferFloor(`${document.title} ${document.originalFileName}`);
    return agentOrchestratorService.complete(job, {
      resultType: 'floor_plan_intake_candidate',
      payload: {
        sourceDocumentId: document.id,
        fileName: document.originalFileName,
        mimeType: document.mimeType,
        storagePath: document.storagePath,
        assetType: floorPlanAssetType(document.originalFileName, document.mimeType),
        floor,
        nextAgent: 'digital_twin',
      },
      confidence: floor ? 0.82 : 0.7,
      requiresReview: true,
    });
  }
  const media = await propertyDataRoomRepository.getMediaItem(job.resourceId);
  if (!media) throw new Error('Floor Plan Agent가 참조할 미디어를 찾을 수 없습니다.');
  const floor = media.floor || inferFloor(combinedText(media));
  return agentOrchestratorService.complete(job, {
    resultType: 'floor_plan_intake_candidate',
    payload: { sourceMediaId: media.id, fileName: media.fileName, mimeType: media.mimeType, storagePath: media.storagePath, assetType: 'scanned_plan', floor, nextAgent: 'digital_twin' },
    confidence: floor ? 0.8 : 0.65,
    requiresReview: true,
  });
}

async function executeSpace(job: AgentJob) {
  const media = await propertyDataRoomRepository.getMedia(job.propertyId);
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
    payload: { spaces, method: 'media_grouping', adapterVersion: 'space-model-v1' },
    confidence,
    requiresReview: spaces.length > 0,
  });
}

async function applyMediaClassification(result: AgentResult) {
  const candidates = Array.isArray(result.payload.candidates) ? result.payload.candidates as MediaCandidate[] : [];
  for (const candidate of candidates) {
    const media = await propertyDataRoomRepository.getMediaItem(candidate.mediaId);
    if (!media || media.propertyId !== result.propertyId) continue;
    await propertyDataRoomRepository.updateMedia({
      ...media,
      category: candidate.suggestedCategory,
      floor: candidate.suggestedFloor || media.floor,
      room: candidate.suggestedRoom || media.room,
      aiTags: Array.from(new Set([...media.aiTags, ...candidate.tags])),
      verificationStatus: 'confirmed',
      updatedAt: new Date().toISOString(),
    });
  }
  if (candidates.length) await agentOrchestratorService.queuePropertyAgent(result.propertyId, 'space', 'dependency', { sourceAgentResultId: result.id });
}

async function applyFloorPlan(result: AgentResult) {
  const payload = result.payload;
  const sourceDocumentId = typeof payload.sourceDocumentId === 'string' ? payload.sourceDocumentId : undefined;
  const sourceMediaId = typeof payload.sourceMediaId === 'string' ? payload.sourceMediaId : undefined;
  const sourceDigitalTwinAssetId = typeof payload.sourceDigitalTwinAssetId === 'string' ? payload.sourceDigitalTwinAssetId : undefined;
  const storagePath = typeof payload.storagePath === 'string' ? payload.storagePath : '';
  const fileName = typeof payload.fileName === 'string' ? payload.fileName : '';
  const floor = typeof payload.floor === 'string' ? payload.floor : undefined;
  const assetType = typeof payload.assetType === 'string' ? payload.assetType as DigitalTwinAsset['assetType'] : 'floor_plan';
  const existing = await propertyDataRoomRepository.getDigitalTwinAssets(result.propertyId);
  const directAsset = sourceDigitalTwinAssetId ? existing.find((item) => item.id === sourceDigitalTwinAssetId) : undefined;
  if (directAsset) {
    await propertyDataRoomRepository.saveDigitalTwinAsset({ ...directAsset, floor: floor || directAsset.floor, processingStatus: 'pending', metadata: { ...directAsset.metadata, sourceAgentResultId: result.id }, updatedAt: new Date().toISOString() });
  } else {
    const duplicate = existing.find((item) => item.sourceDocumentId === sourceDocumentId && sourceDocumentId);
    if (!duplicate) {
      const now = new Date().toISOString();
      await propertyDataRoomRepository.saveDigitalTwinAsset({
        id: crypto.randomUUID(), propertyId: result.propertyId, assetType, fileFormat: fileName.split('.').pop()?.toLowerCase() || 'unknown', storagePath,
        fileName, sourceDocumentId, floor, version: 1, processingStatus: 'pending', metadata: { sourceMediaId, sourceAgentResultId: result.id }, createdAt: now, updatedAt: now,
      });
    }
  }
  await agentOrchestratorService.queuePropertyAgent(result.propertyId, 'digital_twin', 'dependency', { sourceAgentResultId: result.id, sourceDocumentId, sourceMediaId, sourceDigitalTwinAssetId });
}

async function applySpaceModel(result: AgentResult) {
  const candidates = Array.isArray(result.payload.spaces) ? result.payload.spaces as SpaceCandidate[] : [];
  const existingSpaces = await propertyDataRoomRepository.getSpaces(result.propertyId);
  const existingLinks = await propertyDataRoomRepository.getSpaceMediaLinks(result.propertyId);
  for (const candidate of candidates) {
    const existing = existingSpaces.find((space) => space.floor === candidate.floor && space.name === candidate.name && space.spaceType === candidate.spaceType);
    const now = new Date().toISOString();
    const space: PropertySpace = existing ?? {
      id: crypto.randomUUID(), propertyId: result.propertyId, name: candidate.name, spaceType: candidate.spaceType, floor: candidate.floor, roomCode: candidate.roomCode,
      sourceType: 'agent', sourceAgentResultId: result.id, verificationStatus: 'confirmed', createdAt: now, updatedAt: now,
    };
    if (!existing) await propertyDataRoomRepository.saveSpace(space);
    for (const mediaId of candidate.mediaIds) {
      if (existingLinks.some((link) => link.spaceId === space.id && link.mediaId === mediaId)) continue;
      const link: SpaceMediaLink = { id: crypto.randomUUID(), propertyId: result.propertyId, spaceId: space.id, mediaId, confidence: candidate.confidence, sourceAgentResultId: result.id, createdAt: now };
      await propertyDataRoomRepository.saveSpaceMediaLink(link);
    }
  }
}

async function applyResult(result: AgentResult) {
  if (result.resultType === 'media_classification_candidate') return applyMediaClassification(result);
  if (result.resultType === 'floor_plan_intake_candidate') return applyFloorPlan(result);
  if (result.resultType === 'space_model_candidate') return applySpaceModel(result);
}

export const agentExecutionService = {
  async execute(sourceJob: AgentJob) {
    let job = sourceJob;
    try {
      if (job.status !== 'running') job = await agentOrchestratorService.start(job);
      if (job.agentType === 'interior_vision') return await executeInterior(job);
      if (job.agentType === 'floor_plan') return await executeFloorPlan(job);
      if (job.agentType === 'space') return await executeSpace(job);
      return await agentOrchestratorService.complete(job, {
        resultType: 'adapter_pending',
        payload: { agentType: job.agentType, message: '실행 어댑터 연결 대기', requestedInput: job.input },
        confidence: 0,
        requiresReview: true,
      });
    } catch (error) {
      await agentOrchestratorService.fail(job, error);
      throw error;
    }
  },

  async reviewAndApply(job: AgentJob, review: AgentReview, result: AgentResult, decision: Exclude<AgentReviewDecision, 'pending'>, note = '', reviewedBy?: string) {
    const reviewed = await agentOrchestratorService.review(job, review, decision, note, reviewedBy);
    if (decision === 'approved') {
      try { await applyResult(result); }
      catch (error) {
        await agentOrchestratorService.fail(reviewed.job, error);
        throw error;
      }
    }
    return reviewed;
  },
};
