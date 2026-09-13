import { DOCUMENT_TYPE_LABELS, REQUIRED_DOCUMENT_TYPES } from '../domain/propertyDataRoom/labels';
import type { AgentJob, AgentResult, AgentReview, AgentReviewDecision, AgentType, PropertyRiskAssessment, RenovationAssessment, RiskCheckItem, SpaceType } from '../domain/propertyDataRoom/types';
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
      payload: { assessment: { scope, title: scope === 'partial' ? '부분 리노베이션 검토 후보' : '현 상태 유지 + 선택 개선 검토 후보', summary: spaces.length ? `확정 공간 ${spaces.length}개를 기준으로 리노베이션 검토 항목을 구성했습니다.` : '확정 공간 데이터가 부족하여 기본 점검 항목 중심으로 구성했습니다.', recommendedItems, riskItems, costStatus: 'not_estimated' }, basis: { spaces: spaces.map((space) => ({ id: space.id, name: space.name, type: space.spaceType, floor: space.floor })) }, adapterVersion: 'renovation-rules-v1' },
      confidence: spaces.length ? 0.72 : 0.4, requiresReview: true,
    });
  } catch (error) { await agentOrchestratorService.fail(job, error); throw error; }
}

async function executeRiskCompliance(sourceJob: AgentJob) {
  let job = sourceJob;
  try {
    if (job.status !== 'running') job = await agentOrchestratorService.start(job);
    const [documents, candidates, renovations, digitalTwinAssets, spaces] = await Promise.all([
      propertyDataRoomRepository.getDocuments(job.propertyId), propertyDataRoomRepository.getVerificationCandidates(job.propertyId), propertyDataRoomRepository.getRenovationAssessments(job.propertyId), propertyDataRoomRepository.getDigitalTwinAssets(job.propertyId), propertyDataRoomRepository.getSpaces(job.propertyId),
    ]);
    const checks: RiskCheckItem[] = REQUIRED_DOCUMENT_TYPES.map((type) => {
      const document = documents.find((item) => item.documentType === type);
      const verified = document && ['verified', 'confirmed'].includes(document.verificationStatus);
      return { key: `document:${type}`, label: DOCUMENT_TYPE_LABELS[type], status: !document ? 'missing' : verified ? 'clear' : 'review', detail: !document ? '필수 공적자료가 등록되지 않았습니다.' : verified ? '등록 및 확인 상태입니다.' : `등록됨 · ${document.verificationStatus} 상태로 재확인 필요`, sourceReference: document?.id };
    });
    const activeCandidates = candidates.filter((item) => item.decisionStatus === 'pending' || item.decisionStatus === 'held');
    checks.push({ key: 'verification_candidates', label: '미처리 검증 후보', status: activeCandidates.length ? 'review' : 'clear', detail: activeCandidates.length ? `${activeCandidates.length}건의 후보가 승인/거절되지 않았습니다.` : '미처리 검증 후보가 없습니다.' });
    checks.push({ key: 'floor_plan', label: '도면 / 공간 데이터', status: digitalTwinAssets.length || spaces.length ? 'review' : 'missing', detail: digitalTwinAssets.length || spaces.length ? `도면·Digital Twin 자산 ${digitalTwinAssets.length}건, 확정 공간 ${spaces.length}건. 실제 치수·구조벽·피난동선은 전문가 확인이 필요합니다.` : '도면 및 공간 데이터가 없어 구조·동선 검토 근거가 부족합니다.' });
    checks.push({ key: 'renovation', label: '리노베이션 검토', status: renovations.length ? 'review' : 'missing', detail: renovations.length ? `${renovations.length}건의 리노베이션 검토가 있습니다. 인허가·구조·공사비는 별도 전문가 검토 대상입니다.` : '승인된 리노베이션 검토가 없습니다.' });
    const missingCount = checks.filter((item) => item.status === 'missing').length; const reviewCount = checks.filter((item) => item.status === 'review').length;
    const summary = missingCount ? `필수 자료/근거 ${missingCount}개 영역이 부족하고 ${reviewCount}개 영역은 추가 검토가 필요합니다.` : reviewCount ? `핵심 자료는 연결됐으며 ${reviewCount}개 영역은 전문가·현장 재확인이 필요합니다.` : '현재 연결된 자료 기준으로 미해결 체크 항목이 없습니다.';
    return agentOrchestratorService.complete(job, { resultType: 'risk_compliance_assessment_candidate', payload: { assessment: { title: '거래·공간·인허가 사전 검토 후보', summary, checks, disclaimer: '본 결과는 자동화된 사전 체크리스트이며 법률·건축·구조·소방·인허가 적합성에 대한 확정 판단이 아닙니다. 최신 공적자료와 관련 전문가의 별도 검토가 필요합니다.' }, adapterVersion: 'risk-compliance-rules-v1' }, confidence: missingCount ? 0.55 : 0.72, requiresReview: true });
  } catch (error) { await agentOrchestratorService.fail(job, error); throw error; }
}

async function applyRenovation(result: AgentResult) {
  const raw = result.payload.assessment; if (!raw || typeof raw !== 'object') throw new Error('Renovation Agent 결과 형식이 올바르지 않습니다.');
  const value = raw as Record<string, unknown>; const now = new Date().toISOString();
  const assessment: RenovationAssessment = { id: crypto.randomUUID(), propertyId: result.propertyId, scope: ['retain', 'partial', 'full', 'change_of_use', 'rebuild_review'].includes(String(value.scope)) ? value.scope as RenovationAssessment['scope'] : 'retain', title: String(value.title || '리노베이션 검토'), summary: String(value.summary || ''), recommendedItems: Array.isArray(value.recommendedItems) ? value.recommendedItems.map(String) : [], riskItems: Array.isArray(value.riskItems) ? value.riskItems.map(String) : [], costStatus: value.costStatus === 'range_candidate' ? 'range_candidate' : 'not_estimated', sourceAgentResultId: result.id, verificationStatus: 'confirmed', createdAt: now, updatedAt: now };
  await propertyDataRoomRepository.saveRenovationAssessment(assessment);
  return agentOrchestratorService.queuePropertyAgent(result.propertyId, 'risk_compliance', 'dependency', { sourceAgentResultId: result.id, renovationAssessmentId: assessment.id });
}

async function applyRiskCompliance(result: AgentResult) {
  const raw = result.payload.assessment; if (!raw || typeof raw !== 'object') throw new Error('Risk / Compliance Agent 결과 형식이 올바르지 않습니다.');
  const value = raw as Record<string, unknown>; const checks = Array.isArray(value.checks) ? value.checks.filter((item): item is RiskCheckItem => Boolean(item && typeof item === 'object' && 'key' in item && 'label' in item && 'status' in item && 'detail' in item)) : []; const now = new Date().toISOString();
  const assessment: PropertyRiskAssessment = { id: crypto.randomUUID(), propertyId: result.propertyId, title: String(value.title || '사전 리스크 검토'), summary: String(value.summary || ''), checks, disclaimer: String(value.disclaimer || '자동 사전검토 결과이며 전문가의 확정 판단이 아닙니다.'), sourceAgentResultId: result.id, verificationStatus: 'confirmed', createdAt: now, updatedAt: now };
  await propertyDataRoomRepository.saveRiskAssessment(assessment);
}

async function runQueuedDependency(propertyId: string, agentType: AgentType) {
  const jobs = await propertyDataRoomRepository.getAgentJobs(propertyId);
  const job = jobs.filter((item) => item.agentType === agentType && item.status === 'queued').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!job) return;
  if (agentType === 'renovation') await executeRenovation(job);
  else if (agentType === 'risk_compliance') await executeRiskCompliance(job);
  else await agentExecutionService.execute(job);
}

export const agentRuntimeService = {
  execute(job: AgentJob) {
    if (job.agentType === 'renovation') return executeRenovation(job);
    if (job.agentType === 'risk_compliance') return executeRiskCompliance(job);
    return agentExecutionService.execute(job);
  },

  async reviewAndApply(job: AgentJob, review: AgentReview, result: AgentResult, decision: Exclude<AgentReviewDecision, 'pending'>, note = '', reviewedBy?: string) {
    if (result.resultType !== 'renovation_assessment_candidate' && result.resultType !== 'risk_compliance_assessment_candidate') {
      const reviewed = await agentExecutionService.reviewAndApply(job, review, result, decision, note, reviewedBy);
      if (decision === 'approved') {
        if (result.resultType === 'media_classification_candidate') await runQueuedDependency(result.propertyId, 'space');
        if (result.resultType === 'space_model_candidate') {
          await agentOrchestratorService.queuePropertyAgent(result.propertyId, 'renovation', 'dependency', { sourceAgentResultId: result.id });
          await runQueuedDependency(result.propertyId, 'renovation');
        }
      }
      return reviewed;
    }
    const reviewed = await agentOrchestratorService.review(job, review, decision, note, reviewedBy);
    if (decision === 'approved') {
      try {
        if (result.resultType === 'renovation_assessment_candidate') {
          const riskJob = await applyRenovation(result);
          if (riskJob.status === 'queued') await executeRiskCompliance(riskJob);
        } else await applyRiskCompliance(result);
      } catch (error) { await agentOrchestratorService.fail(reviewed.job, error); throw error; }
    }
    return reviewed;
  },
};
