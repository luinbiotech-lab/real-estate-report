import type { BriefingItem } from '../../types';
import type { DataSourceType, DocumentType, MediaCategory, VerificationStatus } from '../propertyDataRoom/types';

export type ReportValueState = 'actual' | 'missing' | 'disconnected' | 'estimated' | 'calculated' | 'ai_analysis' | 'unverified';

export interface ReportValue<T> {
  value: T | null;
  display: string;
  state: ReportValueState;
  verificationStatus?: VerificationStatus;
  sourceIds: string[];
}

export interface ProfessionalReportDocument {
  id: string; documentType: DocumentType; title: string; originalFileName: string; sourceName: string;
  issuedAt: string | null; uploadedAt: string; verificationStatus: VerificationStatus; version: number;
}

export interface ProfessionalReportMedia {
  id: string; category: MediaCategory | 'main' | 'map' | 'location_analysis' | 'additional';
  url: string | null; caption: string; isPrimary: boolean; verificationStatus: VerificationStatus;
}

export interface ProfessionalReportSource {
  id: string; fieldKey: string | null; resourceType: string | null; sourceType: DataSourceType;
  sourceName: string; sourceReference: string | null; collectedAt: string; sourceDate: string | null;
  confidence: number | null; verificationStatus: VerificationStatus;
}

export interface ProfessionalReportViewModel {
  identity: {
    id: string; propertyNumber: ReportValue<string>; name: ReportValue<string>; buildingName: ReportValue<string>;
    tradeType: ReportValue<string>; address: ReportValue<string>; detailAddress: ReportValue<string>;
    managerName: ReportValue<string>; managerPhone: ReportValue<string>; managerEmail: ReportValue<string>; companyName: ReportValue<string>;
  };
  pricing: {
    salePrice: ReportValue<number>; deposit: ReportValue<number>; monthlyRent: ReportValue<number>;
    landUnitPrice: ReportValue<number>; negotiable: ReportValue<boolean>; occupancyStatus: ReportValue<string>;
  };
  building: {
    totalFloorAreaSqm: ReportValue<number>; totalFloorAreaPyeong: ReportValue<number>; buildingAreaPyeong: ReportValue<number>;
    mainUse: ReportValue<string>; structure: ReportValue<string>; basementFloors: ReportValue<number>;
    groundFloors: ReportValue<number>; completionDate: ReportValue<string>; buildingCoverageRate: ReportValue<number>;
    floorAreaRatio: ReportValue<number>; elevator: ReportValue<string>; parkingSpaces: ReportValue<number>;
  };
  land: {
    landAreaSqm: ReportValue<number>; landAreaPyeong: ReportValue<number>; zoning: ReportValue<string>; roadCondition: ReportValue<string>;
  };
  location: {
    latitude: ReportValue<number>; longitude: ReportValue<number>; nearbyStation: ReportValue<string>;
    stationDistance: ReportValue<string>; locationAnalysis: ReportValue<string>; briefingItems: ReportValue<BriefingItem[]>;
  };
  media: {
    mainImage: ReportValue<string>; mapImage: ReportValue<string>; locationAnalysisImage: ReportValue<string>;
    additionalImages: ReportValue<string[]>; items: ProfessionalReportMedia[];
  };
  documents: { items: ProfessionalReportDocument[]; count: number; verifiedCount: number };
  digitalTwin: { connected: boolean; count: number; readyCount: number };
  verification: { items: Array<{ fieldKey: string; status: VerificationStatus; note: string; verifiedAt: string | null }>; counts: Record<VerificationStatus, number> };
  dataQuality: {
    counts: Record<ReportValueState, number>; missingFields: string[]; disconnectedFields: string[];
    requiredDocumentsMissing: DocumentType[]; reportReady: boolean;
  };
  investment: {
    features: ReportValue<string>; investmentPoints: ReportValue<string>; developmentPlan: ReportValue<string>;
    recommendedUse: ReportValue<string>; nearbyTransactions: ReportValue<string>; overallOpinion: ReportValue<string>;
  };
  risks: { risks: ReportValue<string> };
  sources: { items: ProfessionalReportSource[]; count: number };
  generated: {
    generatedAt: string; propertyUpdatedAt: string; engineVersion: string; templateVersion: string;
    dataPolicy: 'property-and-data-room-only';
  };
}
