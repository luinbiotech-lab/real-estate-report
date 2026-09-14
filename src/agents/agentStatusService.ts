import type { DataRoomBundle } from '../domain/propertyDataRoom/types';
import { PLATFORM_AGENT_REGISTRY, type PlatformAgentId } from './agentRegistry';

export type AgentHealthState = 'idle' | 'ready' | 'attention' | 'blocked' | 'deferred';

export interface AgentHealthSnapshot {
  agentId: PlatformAgentId;
  state: AgentHealthState;
  jobCount: number;
  failedJobCount: number;
  pendingReviewCount: number;
  evidenceCount: number;
  blockers: string[];
  summary: string;
}

function runtimeCounts(bundle: DataRoomBundle, agentId: PlatformAgentId) {
  const agent = PLATFORM_AGENT_REGISTRY.find((item) => item.id === agentId);
  if (!agent?.runtimeAgentType) return { jobs: [], failed: [], pendingReviews: [] };
  const jobs = (bundle.agentJobs ?? []).filter((item) => item.agentType === agent.runtimeAgentType);
  const jobIds = new Set(jobs.map((item) => item.id));
  const pendingReviews = (bundle.agentReviews ?? []).filter((item) => jobIds.has(item.jobId) && (item.decision === 'pending' || item.decision === 'held'));
  return { jobs, failed: jobs.filter((item) => item.status === 'failed'), pendingReviews };
}

function facts(bundle: DataRoomBundle, agentId: PlatformAgentId) {
  switch (agentId) {
    case 'intake': return { count: bundle.documents.length + bundle.media.length + bundle.digitalTwinAssets.length, blockers: [] as string[] };
    case 'document': return { count: bundle.verificationCandidates.length, blockers: bundle.documents.length ? [] : ['문서 원본 없음'] };
    case 'verification': {
      const pending = bundle.verificationCandidates.filter((item) => !['approved', 'rejected'].includes(item.decisionStatus)).length;
      return { count: bundle.verifications.length, blockers: pending ? [`미검토 후보 ${pending}건`] : [] };
    }
    case 'interior_vision': return { count: (bundle.agentResults ?? []).filter((item) => item.agentType === 'interior_vision').length, blockers: bundle.media.some((item) => item.mediaType === 'image') ? [] : ['분석할 이미지 없음'] };
    case 'space': {
      const approved = (bundle.spaceRoomLinks ?? []).filter((item) => item.decision === 'approved').length;
      return { count: (bundle.spaces ?? []).length + approved, blockers: (bundle.spaces ?? []).length ? [] : ['공간 모델 없음'] };
    }
    case 'floor_plan_geometry': return { count: bundle.digitalTwinAssets.length, blockers: bundle.digitalTwinAssets.length ? [] : ['도면/CAD 자산 없음'] };
    case 'digital_twin': {
      const candidates = bundle.digitalTwinAssets.filter((item) => Boolean((item as { productionGeometryCandidate?: unknown }).productionGeometryCandidate)).length;
      return { count: candidates, blockers: candidates ? [] : ['Production Candidate 없음'] };
    }
    case 'renovation': {
      const approved = (bundle.roomRenovationAssessments ?? []).filter((item) => item.decision === 'approved').length;
      return { count: (bundle.renovationAssessments ?? []).length + approved, blockers: [] as string[] };
    }
    case 'risk_compliance': return { count: (bundle.riskAssessments ?? []).length, blockers: [] as string[] };
    case 'collaboration_viewer': return { count: (bundle.roomEvidencePositions ?? []).filter((item) => item.decision === 'approved').length, blockers: [] as string[] };
    case 'report': return { count: bundle.reportSnapshots.length, blockers: ['최종 편집 단계까지 보류'] };
    case 'integrator': return { count: 0, blockers: [] as string[] };
  }
}

export function buildAgentHealthSnapshots(bundle: DataRoomBundle): AgentHealthSnapshot[] {
  return PLATFORM_AGENT_REGISTRY.map((agent) => {
    if (agent.status === 'deferred') return { agentId: agent.id, state: 'deferred', jobCount: 0, failedJobCount: 0, pendingReviewCount: 0, evidenceCount: facts(bundle, agent.id).count, blockers: facts(bundle, agent.id).blockers, summary: 'DEFERRED' };
    if (agent.id === 'integrator') {
      const allFailed = (bundle.agentJobs ?? []).filter((item) => item.status === 'failed').length;
      const allPending = (bundle.agentReviews ?? []).filter((item) => item.decision === 'pending' || item.decision === 'held').length;
      const state: AgentHealthState = allFailed ? 'blocked' : allPending ? 'attention' : 'ready';
      return { agentId: agent.id, state, jobCount: (bundle.agentJobs ?? []).length, failedJobCount: allFailed, pendingReviewCount: allPending, evidenceCount: bundle.dataSources.length, blockers: [...(allFailed ? [`실패 Job ${allFailed}건`] : []), ...(allPending ? [`Human Review ${allPending}건`] : [])], summary: allFailed ? '실패 Job 확인 필요' : allPending ? 'Human Review 대기' : '통합 상태 정상' };
    }
    const runtime = runtimeCounts(bundle, agent.id);
    const fact = facts(bundle, agent.id);
    const blockers = [...fact.blockers, ...(runtime.failed.length ? [`실패 Job ${runtime.failed.length}건`] : []), ...(runtime.pendingReviews.length ? [`Human Review ${runtime.pendingReviews.length}건`] : [])];
    const state: AgentHealthState = runtime.failed.length ? 'blocked' : runtime.pendingReviews.length || fact.blockers.length ? 'attention' : fact.count || runtime.jobs.length ? 'ready' : 'idle';
    return { agentId: agent.id, state, jobCount: runtime.jobs.length, failedJobCount: runtime.failed.length, pendingReviewCount: runtime.pendingReviews.length, evidenceCount: fact.count, blockers, summary: state === 'blocked' ? '조치 필요' : state === 'attention' ? '검토 필요' : state === 'ready' ? '준비됨' : '대기' };
  });
}

export function getAgentHealth(bundle: DataRoomBundle, agentId: PlatformAgentId) {
  return buildAgentHealthSnapshots(bundle).find((item) => item.agentId === agentId);
}
