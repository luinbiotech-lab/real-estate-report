import type { AgentJob, AgentResult, AgentReview, AgentReviewDecision, AgentType, DigitalTwinAsset, DocumentType, PropertyDocument, PropertyMedia } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';

const nowIso = () => new Date().toISOString();

const DOCUMENT_AGENT_ROUTING: Partial<Record<DocumentType, AgentType>> = {
  floor_plan: 'floor_plan',
  building_register: 'document',
  land_register: 'document',
  land_use_plan: 'document',
  registry: 'document',
  cadastral_map: 'document',
  lease_status: 'document',
  appraisal: 'document',
  contract: 'document',
  financial: 'document',
  development: 'risk_compliance',
  due_diligence: 'risk_compliance',
  other: 'document',
};

function createJob(input: {
  propertyId: string;
  agentType: AgentType;
  trigger: AgentJob['trigger'];
  resourceType?: AgentJob['resourceType'];
  resourceId?: string;
  priority?: number;
  payload?: Record<string, unknown>;
}): AgentJob {
  const now = nowIso();
  return {
    id: crypto.randomUUID(),
    propertyId: input.propertyId,
    agentType: input.agentType,
    trigger: input.trigger,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    status: 'queued',
    priority: input.priority ?? 50,
    attempt: 0,
    maxAttempts: 3,
    input: input.payload ?? {},
    createdAt: now,
    updatedAt: now,
  };
}

export const agentOrchestratorService = {
  async queueDocument(document: PropertyDocument, trigger: AgentJob['trigger'] = 'upload'): Promise<AgentJob> {
    const agentType = DOCUMENT_AGENT_ROUTING[document.documentType] ?? 'document';
    const existing = await propertyDataRoomRepository.getAgentJobs(document.propertyId);
    const duplicate = existing.find((job) =>
      job.resourceType === 'document' && job.resourceId === document.id && job.agentType === agentType &&
      ['queued', 'running', 'review_required'].includes(job.status));
    if (duplicate) return duplicate;
    return propertyDataRoomRepository.saveAgentJob(createJob({
      propertyId: document.propertyId,
      agentType,
      trigger,
      resourceType: 'document',
      resourceId: document.id,
      payload: {
        documentType: document.documentType,
        title: document.title,
        mimeType: document.mimeType,
        extractionStatus: document.extractionStatus ?? 'not_started',
      },
    }));
  },

  async queueMedia(media: PropertyMedia, trigger: AgentJob['trigger'] = 'upload'): Promise<AgentJob> {
    const agentType: AgentType = media.category === 'floor_plan' ? 'floor_plan' : 'interior_vision';
    const existing = await propertyDataRoomRepository.getAgentJobs(media.propertyId);
    const duplicate = existing.find((job) =>
      job.resourceType === 'media' && job.resourceId === media.id && job.agentType === agentType &&
      ['queued', 'running', 'review_required'].includes(job.status));
    if (duplicate) return duplicate;
    return propertyDataRoomRepository.saveAgentJob(createJob({
      propertyId: media.propertyId,
      agentType,
      trigger,
      resourceType: 'media',
      resourceId: media.id,
      payload: { category: media.category, fileName: media.fileName, floor: media.floor, room: media.room },
    }));
  },

  async queueDigitalTwin(asset: DigitalTwinAsset, trigger: AgentJob['trigger'] = 'upload'): Promise<AgentJob> {
    const existing = await propertyDataRoomRepository.getAgentJobs(asset.propertyId);
    const duplicate = existing.find((job) =>
      job.resourceType === 'digital_twin' && job.resourceId === asset.id && job.agentType === 'floor_plan' &&
      ['queued', 'running', 'review_required'].includes(job.status));
    if (duplicate) return duplicate;
    return propertyDataRoomRepository.saveAgentJob(createJob({
      propertyId: asset.propertyId,
      agentType: 'floor_plan',
      trigger,
      resourceType: 'digital_twin',
      resourceId: asset.id,
      priority: 70,
      payload: { assetType: asset.assetType, fileName: asset.fileName, fileFormat: asset.fileFormat, floor: asset.floor },
    }));
  },

  async queuePropertyAgent(propertyId: string, agentType: AgentType, trigger: AgentJob['trigger'] = 'manual', payload: Record<string, unknown> = {}) {
    return propertyDataRoomRepository.saveAgentJob(createJob({ propertyId, agentType, trigger, resourceType: 'property', resourceId: propertyId, payload }));
  },

  async start(job: AgentJob): Promise<AgentJob> {
    if (job.status !== 'queued' && job.status !== 'failed') throw new Error('대기 또는 실패 상태의 Agent Job만 실행할 수 있습니다.');
    const now = nowIso();
    return propertyDataRoomRepository.saveAgentJob({ ...job, status: 'running', attempt: job.attempt + 1, startedAt: now, error: undefined, updatedAt: now });
  },

  async complete(job: AgentJob, input: { resultType: string; payload: Record<string, unknown>; confidence?: number; requiresReview?: boolean }): Promise<{ job: AgentJob; result: AgentResult; review?: AgentReview }> {
    if (job.status !== 'running') throw new Error('실행 중인 Agent Job만 완료할 수 있습니다.');
    const now = nowIso();
    const requiresReview = input.requiresReview ?? true;
    const result: AgentResult = {
      id: crypto.randomUUID(), jobId: job.id, propertyId: job.propertyId, agentType: job.agentType,
      resultType: input.resultType, payload: input.payload, confidence: input.confidence, requiresReview, createdAt: now,
    };
    await propertyDataRoomRepository.saveAgentResult(result);
    let review: AgentReview | undefined;
    if (requiresReview) {
      review = {
        id: crypto.randomUUID(), jobId: job.id, resultId: result.id, propertyId: job.propertyId,
        decision: 'pending', note: '', createdAt: now, updatedAt: now,
      };
      await propertyDataRoomRepository.saveAgentReview(review);
    }
    const updatedJob = await propertyDataRoomRepository.saveAgentJob({
      ...job,
      status: requiresReview ? 'review_required' : 'completed',
      completedAt: requiresReview ? undefined : now,
      updatedAt: now,
    });
    return { job: updatedJob, result, review };
  },

  async fail(job: AgentJob, error: unknown): Promise<AgentJob> {
    const now = nowIso();
    return propertyDataRoomRepository.saveAgentJob({ ...job, status: 'failed', error: error instanceof Error ? error.message : String(error), updatedAt: now });
  },

  async review(job: AgentJob, review: AgentReview, decision: Exclude<AgentReviewDecision, 'pending'>, note = '', reviewedBy?: string): Promise<{ job: AgentJob; review: AgentReview }> {
    if (job.status !== 'review_required') throw new Error('검토 대기 중인 Agent Job만 검토할 수 있습니다.');
    if (review.decision !== 'pending' && review.decision !== 'held') throw new Error('이미 처리된 Agent 검토입니다.');
    const now = nowIso();
    const updatedReview = { ...review, decision, note: note.trim(), reviewedBy, reviewedAt: now, updatedAt: now };
    await propertyDataRoomRepository.saveAgentReview(updatedReview);
    const updatedJob = await propertyDataRoomRepository.saveAgentJob({ ...job, status: decision === 'approved' ? 'completed' : decision === 'rejected' ? 'cancelled' : 'review_required', completedAt: decision === 'approved' || decision === 'rejected' ? now : undefined, updatedAt: now });
    return { job: updatedJob, review: updatedReview };
  },

  async list(propertyId: string) {
    const [jobs, results, reviews] = await Promise.all([
      propertyDataRoomRepository.getAgentJobs(propertyId),
      propertyDataRoomRepository.getAgentResults(propertyId),
      propertyDataRoomRepository.getAgentReviews(propertyId),
    ]);
    return {
      jobs: jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      results,
      reviews,
    };
  },
};
