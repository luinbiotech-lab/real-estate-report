import type { AgentJob, AgentResult, AgentReview, DataRoomBundle, DigitalTwinAsset, PropertyDocument, PropertyMedia, PropertyRiskAssessment, PropertySpace, PropertyVerificationCandidate, RenovationAssessment, SpaceMediaLink } from '../domain/propertyDataRoom/types';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';
import { propertyRepository } from '../repositories/propertyRepository';
import type { Property } from '../types';

export interface IntegratorReadPort {
  getProperties(): Promise<Property[]>;
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

export interface InteriorVisionAgentPort {
  getMedia(propertyId: string): Promise<PropertyMedia[]>;
  getMediaItem(id: string): Promise<PropertyMedia | undefined>;
  updateMedia(value: PropertyMedia): Promise<PropertyMedia>;
}

export interface SpaceAgentPort {
  getMedia(propertyId: string): Promise<PropertyMedia[]>;
  getSpaces(propertyId: string): Promise<PropertySpace[]>;
  getSpaceMediaLinks(propertyId: string): Promise<SpaceMediaLink[]>;
  saveSpace(value: PropertySpace): Promise<PropertySpace>;
  saveSpaceMediaLink(value: SpaceMediaLink): Promise<SpaceMediaLink>;
}

export interface FloorPlanGeometryAgentPort {
  getDigitalTwinAssets(propertyId: string): Promise<DigitalTwinAsset[]>;
  saveDigitalTwinAsset(value: DigitalTwinAsset): Promise<DigitalTwinAsset>;
}

export interface DigitalTwinAgentPort {
  getDigitalTwinAssets(propertyId: string): Promise<DigitalTwinAsset[]>;
  saveDigitalTwinAsset(value: DigitalTwinAsset): Promise<DigitalTwinAsset>;
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
  getProperties: () => propertyRepository.getAll(),
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

export const interiorVisionAgentPort: InteriorVisionAgentPort = {
  getMedia: (propertyId) => propertyDataRoomRepository.getMedia(propertyId),
  getMediaItem: (id) => propertyDataRoomRepository.getMediaItem(id),
  updateMedia: (value) => propertyDataRoomRepository.updateMedia(value),
};

export const spaceAgentPort: SpaceAgentPort = {
  getMedia: (propertyId) => propertyDataRoomRepository.getMedia(propertyId),
  getSpaces: (propertyId) => propertyDataRoomRepository.getSpaces(propertyId),
  getSpaceMediaLinks: (propertyId) => propertyDataRoomRepository.getSpaceMediaLinks(propertyId),
  saveSpace: (value) => propertyDataRoomRepository.saveSpace(value),
  saveSpaceMediaLink: (value) => propertyDataRoomRepository.saveSpaceMediaLink(value),
};

export const floorPlanGeometryAgentPort: FloorPlanGeometryAgentPort = {
  getDigitalTwinAssets: (propertyId) => propertyDataRoomRepository.getDigitalTwinAssets(propertyId),
  saveDigitalTwinAsset: (value) => propertyDataRoomRepository.saveDigitalTwinAsset(value),
};

export const digitalTwinAgentPort: DigitalTwinAgentPort = {
  getDigitalTwinAssets: (propertyId) => propertyDataRoomRepository.getDigitalTwinAssets(propertyId),
  saveDigitalTwinAsset: (value) => propertyDataRoomRepository.saveDigitalTwinAsset(value),
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
