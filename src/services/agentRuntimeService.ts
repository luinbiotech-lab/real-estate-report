import type { AgentJob, AgentResult, AgentReview, AgentReviewDecision, RenovationAssessment, SpaceType } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { agentExecutionService } from './agentExecutionService';
import { agentOrchestratorService } from './agentOrchestratorService';

const SPACE_RECOMMENDATIONS: Partial<Record<SpaceType, string[]>> = {
  retail: ['파사드·사인 계획 검토', '전기용량·조명 계획 검토', '냉난방 및 급배수 용량 확인'],
  office: ['업무 조명·전기·통신 재배치 검토', '냉난방 존 구성 확인', '회의·집중공간 방음 검토'],
  residential: ['주방·욕실 설비 상태 확인', '창호·단열·결로 점검', '수납 및 동선 재구성 검토'],
  restroom: ['급배수·방수 상태 확인', '환기·위생설비 개선 검토'],
  basement: ['누수·방수·결로 점검', '환기·제습 계획 검토', '피난·소방·방음 조건 확인'],
  rooftop: ['옥상 방수 상태 확인', '난간·안전·배수 조건 검토'],
  mechanical: ['기계·전기 설비 용량과 잔존수명 확인', '유지보수 동선 확보 여부 확인'],
  parking: ['주차 동선·폭·진출입 조건 확인', '조명·CCTV·환기 조건 확인'],
};

function buildRecommendations(spaceTypes: SpaceType[]) {
  const common = ['전기용량 및 분전반 상태 확인', '냉난방·환기 설비 상태 확인', '소방·피난 조건 확인', '누수·균열·마감 노후도 현장실사'];
  return Array.from(new Set([...common, ...spaceTypes.flatMap((type) => SPACE_RECOMMENDATIONS[type] ?? [])]));
}

async function executeRenovation(sourceJob: AgentJob) {
  let job = sourceJob;
  try {
    if (job.status !== 'running') job = await agentOrchestratorService.start(job);
    const spaces = await propertyDataRoomRepository.getSpaces(job.propertyId);
    const spaceTypes = spaces.map((space) => space.spaceType);
    const recommendedItems = buildRecommendations(spaceTypes);
    const scope = spaces.length >= 3 ? 'partial' : 'retain';
    const riskItems = ['구조·내력벽 판단은 도면 및 전문가 검토 필요', '용도변경·대수선·소방 관련 인허가 여부 별도 확인', '공사비는 실측·사양·견적 전까지 확정하지 않음'];
    return agentOrchestratorService.complete(job, {
      resultType: 'renovation_assessment_candidate',
      payload: {
        assessment: {
          scope,
          title: scope === 'partial' ? '부분 리노베이션 검토 후보' : '현 상태 유지 + 선택 개선 검토 후보',
          summary: spaces.length ? `확정 공간 ${spaces.length}개를 기준으로 리노베이션 검토 항목을 구성했습니다.` : '확정 공간 데이터가 부족하여 기본 점검 항목 중심으로 구성했습니다.',
          recommendedItems,
          riskItems,
          costStatus: 'not_estimated',
        },
        basis: { spaces: spaces.map((space) => ({ id: space.id, name: space.name, type: space.spaceType, floor: space.floor })) },
        adapterVersion: 'renovation-rules-v1',
      },
      confidence: spaces.length ? 0.72 : 0.4,
      requiresReview: true,
    });
  } catch (error) {
    await agentOrchestratorService.fail(job, error);
    throw error;
  }
}

async function applyRenovation(result: AgentResult) {
  const raw = result.payload.assessment;
  if (!raw || typeof raw !== 'object') throw new Error('Renovation Agent 결과 형식이 올바르지 않습니다.');
  const value = raw as Record<string, unknown>;
  const recommendedItems = Array.isArray(value.recommendedItems) ? value.recommendedItems.map(String) : [];
  const riskItems = Array.isArray(value.riskItems) ? value.riskItems.map(String) : [];
  const now = new Date().toISOString();
  const assessment: RenovationAssessment = {
    id: crypto.randomUUID(), propertyId: result.propertyId,
    scope: ['retain', 'partial', 'full', 'change_of_use', 'rebuild_review'].includes(String(value.scope)) ? value.scope as RenovationAssessment['scope'] : 'retain',
    title: String(value.title || '리노베이션 검토'), summary: String(value.summary || ''), recommendedItems, riskItems,
    costStatus: value.costStatus === 'range_candidate' ? 'range_candidate' : 'not_estimated', sourceAgentResultId: result.id,
    verificationStatus: 'confirmed', createdAt: now, updatedAt: now,
  };
  await propertyDataRoomRepository.saveRenovationAssessment(assessment);
  await agentOrchestratorService.queuePropertyAgent(result.propertyId, 'risk_compliance', 'dependency', { sourceAgentResultId: result.id, renovationAssessmentId: assessment.id });
}

export const agentRuntimeService = {
  execute(job: AgentJob) {
    if (job.agentType === 'renovation') return executeRenovation(job);
    return agentExecutionService.execute(job);
  },

  async reviewAndApply(job: AgentJob, review: AgentReview, result: AgentResult, decision: Exclude<AgentReviewDecision, 'pending'>, note = '', reviewedBy?: string) {
    if (result.resultType !== 'renovation_assessment_candidate') return agentExecutionService.reviewAndApply(job, review, result, decision, note, reviewedBy);
    const reviewed = await agentOrchestratorService.review(job, review, decision, note, reviewedBy);
    if (decision === 'approved') {
      try { await applyRenovation(result); }
      catch (error) {
        await agentOrchestratorService.fail(reviewed.job, error);
        throw error;
      }
    }
    return reviewed;
  },
};
