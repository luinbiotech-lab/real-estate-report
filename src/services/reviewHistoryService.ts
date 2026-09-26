import type { AgentReview, PropertyVerificationCandidate, ReportSnapshot } from '../domain/propertyDataRoom/types';
import type { BuildingReleaseReviewNote } from './buildingReleaseCollaborationService';

export type ReviewHistoryKind = 'verification' | 'agent_review' | 'report_snapshot' | 'external_review';
export type ReviewHistoryStatus = 'open' | 'approved' | 'held' | 'rejected' | 'resolved' | 'draft' | 'ready' | 'archived' | 'failed' | 'pending';

export interface ReviewHistoryEvent {
  id: string;
  propertyId: string;
  kind: ReviewHistoryKind;
  status: ReviewHistoryStatus;
  title: string;
  detail: string;
  source: string;
  occurredAt: string;
  actor?: string;
  reference?: string;
}

function verificationEvents(propertyId: string, rows: PropertyVerificationCandidate[]): ReviewHistoryEvent[] {
  return rows.map((row) => ({
    id: `verification:${row.id}`,
    propertyId,
    kind: 'verification',
    status: row.decisionStatus === 'pending' ? 'pending' : row.decisionStatus,
    title: `자료 검증 · ${row.fieldKey}`,
    detail: row.note || `후보값 검토 상태: ${row.decisionStatus}`,
    source: row.sourceName,
    occurredAt: row.reviewedAt || row.createdAt,
    actor: row.reviewedBy,
    reference: row.sourceReference,
  }));
}

function agentReviewEvents(propertyId: string, rows: AgentReview[]): ReviewHistoryEvent[] {
  return rows.map((row) => ({
    id: `agent-review:${row.id}`,
    propertyId,
    kind: 'agent_review',
    status: row.decision === 'pending' ? 'pending' : row.decision,
    title: `Agent Human Review · ${row.jobId}`,
    detail: row.note || `Agent 결과 검토 상태: ${row.decision}`,
    source: `Agent Result ${row.resultId}`,
    occurredAt: row.reviewedAt || row.createdAt,
    actor: row.reviewedBy,
    reference: row.resultId,
  }));
}

function reportEvents(propertyId: string, rows: ReportSnapshot[]): ReviewHistoryEvent[] {
  return rows.map((row) => ({
    id: `report:${row.id}`,
    propertyId,
    kind: 'report_snapshot',
    status: row.status,
    title: `${row.reportType === 'professional_report' ? 'Professional Report' : row.reportType} v${row.reportVersion}`,
    detail: `${row.templateVersion}${row.engineVersion ? ` · ${row.engineVersion}` : ''}`,
    source: 'Report Snapshot',
    occurredAt: row.generatedAt || row.createdAt,
    actor: row.generatedBy,
    reference: row.id,
  }));
}

function externalReviewEvents(propertyId: string, rows: BuildingReleaseReviewNote[]): ReviewHistoryEvent[] {
  return rows.filter((row) => row.propertyId === propertyId).map((row) => ({
    id: `external:${row.id}`,
    propertyId,
    kind: 'external_review',
    status: row.status,
    title: '외부 원격 검토 코멘트',
    detail: row.body,
    source: 'Building Release Share',
    occurredAt: row.createdAt,
    actor: row.author,
    reference: row.snapshotId,
  }));
}

export const reviewHistoryService = {
  build(input: {
    propertyId: string;
    verificationCandidates: PropertyVerificationCandidate[];
    agentReviews: AgentReview[];
    reportSnapshots: ReportSnapshot[];
    externalReviewNotes: BuildingReleaseReviewNote[];
  }): ReviewHistoryEvent[] {
    return [
      ...verificationEvents(input.propertyId, input.verificationCandidates),
      ...agentReviewEvents(input.propertyId, input.agentReviews),
      ...reportEvents(input.propertyId, input.reportSnapshots),
      ...externalReviewEvents(input.propertyId, input.externalReviewNotes),
    ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  },
};
