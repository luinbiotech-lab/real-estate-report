import type { AgentJob, AgentResult, AgentReview, DataRoomBundle, DigitalTwinAsset, PropertyDocument, PropertyRiskAssessment, PropertySpace, PropertyVerificationCandidate, RenovationAssessment } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';

export interface IntegratorReadPort {
  getBundle(propertyId: string): Promise<DataRoomBundle>;
}

export interface AgentRuntimePort {
  getAgentJobs(propertyId: string): Promise<AgentJob[]>;
  saveAgentJob(value: AgentJob): Promise<AgentJob>;
  saveAgentResult(value: AgentResult): Promise<AgentResult>;
  saveAgentReview(value: AgentReview): Promise<AgentReview>;
  getAgentResults(propertyId: string): Promise<AgentResult[]>;
  getAgentReviews(propertyId: string): Promise<AgentReview[]>;
}

export interface RenovationAgentPort {
  getSpaces(propertyId: string): Promise<PropertySpace[]>;
  saveRenovationAssessment(value: RenovationAssessment): Promise<RenovationAssessment>;
}

export interface RiskComplianceAgentPort {
  getDocuments(propertyId: string): Promise<PropertyDocument[]>;
  getVerificationCandidates(propertyId: string): Promise<PropertyVerificationCandidate[]>;
  getRenovationAssessments(propertyId: string): Promise<RenovationAssessment[]>;
  getDigitalTwinAssets(propertyId: string): Promise<DigitalTwinAsset[]>;
  getSpaces(propertyId: string): Promise<PropertySpace[]>;
  saveRiskAssessment(value: PropertyRiskAssessment): Promise<PropertyRiskAssessment>;
}

export const integratorReadPort: IntegratorReadPort = {
  getBundle: (propertyId) => propertyDataRoomRepository.getBundle(propertyId),
};

export const agentRuntimePort: AgentRuntimePort = {
  getAgentJobs: (propertyId) => propertyDataRoomRepository.getAgentJobs(propertyId),
  saveAgentJob: (value) => propertyDataRoomRepository.saveAgentJob(value),
  saveAgentResult: (value) => propertyDataRoomRepository.saveAgentResult(value),
  saveAgentReview: (value) => propertyDataRoomRepository.saveAgentReview(value),
  getAgentResults: (propertyId) => propertyDataRoomRepository.getAgentResults(propertyId),
  getAgentReviews: (propertyId) => propertyDataRoomRepository.getAgentReviews(propertyId),
};

export const renovationAgentPort: RenovationAgentPort = {
  getSpaces: (propertyId) => propertyDataRoomRepository.getSpaces(propertyId),
  saveRenovationAssessment: (value) => propertyDataRoomRepository.saveRenovationAssessment(value),
};

export const riskComplianceAgentPort: RiskComplianceAgentPort = {
  getDocuments: (propertyId) => propertyDataRoomRepository.getDocuments(propertyId),
  getVerificationCandidates: (propertyId) => propertyDataRoomRepository.getVerificationCandidates(propertyId),
  getRenovationAssessments: (propertyId) => propertyDataRoomRepository.getRenovationAssessments(propertyId),
  getDigitalTwinAssets: (propertyId) => propertyDataRoomRepository.getDigitalTwinAssets(propertyId),
  getSpaces: (propertyId) => propertyDataRoomRepository.getSpaces(propertyId),
  saveRiskAssessment: (value) => propertyDataRoomRepository.saveRiskAssessment(value),
};
