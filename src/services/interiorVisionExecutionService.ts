import type { AgentJob, MediaCategory, PropertyMedia } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { agentOrchestratorService } from './agentOrchestratorService';
import { visionProviderService } from './visionProviderService';

type MediaCandidate = {
  mediaId: string;
  currentCategory: MediaCategory;
  suggestedCategory: MediaCategory;
  suggestedFloor?: string;
  suggestedRoom?: string;
  tags: string[];
  confidence: number;
  visualSignals: Awaited<ReturnType<typeof visionProviderService.analyzeMedia>>;
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
  { category: 'interior', patterns: [/실내/i, /인테리어/i, /interior/i, /room/i], tags: ['실내'] },
];

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

async function classify(media: PropertyMedia): Promise<MediaCandidate> {
  const text = combinedText(media);
  const matched = CATEGORY_RULES.find((rule) => rule.patterns.some((pattern) => pattern.test(text)));
  const suggestedCategory = matched?.category ?? (media.category === 'other' ? 'interior' : media.category);
  const visualSignals = await visionProviderService.analyzeMedia(media);
  const hasPixels = typeof visualSignals.width === 'number' && typeof visualSignals.height === 'number';
  const metadataConfidence = matched ? 0.82 : media.category !== 'other' ? 0.7 : 0.5;
  const confidence = Math.min(0.92, metadataConfidence + (hasPixels ? 0.05 : 0));
  return {
    mediaId: media.id,
    currentCategory: media.category,
    suggestedCategory,
    suggestedFloor: media.floor || inferFloor(text),
    suggestedRoom: media.room || inferRoom(text, suggestedCategory),
    tags: Array.from(new Set([...media.aiTags, ...(matched?.tags ?? []), suggestedCategory, ...visualSignals.qualityTags, ...visualSignals.conditionHints])),
    confidence,
    visualSignals,
  };
}

export const interiorVisionExecutionService = {
  async execute(sourceJob: AgentJob) {
    let job = sourceJob;
    try {
      if (job.status !== 'running') job = await agentOrchestratorService.start(job);
      const media = job.resourceType === 'media' && job.resourceId
        ? [await propertyDataRoomRepository.getMediaItem(job.resourceId)].filter(Boolean) as PropertyMedia[]
        : (await propertyDataRoomRepository.getMedia(job.propertyId)).filter((item) => item.mediaType === 'image' && item.category !== 'floor_plan');
      const candidates = await Promise.all(media.map(classify));
      const confidence = candidates.length ? candidates.reduce((sum, item) => sum + item.confidence, 0) / candidates.length : 0;
      return agentOrchestratorService.complete(job, {
        resultType: 'media_classification_candidate',
        payload: {
          candidates,
          method: 'browser_pixel_plus_metadata',
          visionProvider: visionProviderService.providerId,
          adapterVersion: 'interior-vision-v2',
          safetyNote: '픽셀 특징은 사진 품질과 시각 신호를 보조 분석하며 공간·하자·설비를 확정 판정하지 않습니다.',
        },
        confidence,
        requiresReview: candidates.length > 0,
      });
    } catch (error) {
      await agentOrchestratorService.fail(job, error);
      throw error;
    }
  },
};
