import type { AgentJob, AgentResult, AgentReview, DataRoomBundle, DigitalTwinAsset, PropertyDataSource, PropertyDocument, PropertyFacility, PropertyMedia, PropertySpace, PropertyVerification, PropertyVerificationCandidate, RenovationAssessment, ReportSnapshot, SpaceMediaLink } from '../domain/propertyDataRoom/types';
import type { Property } from '../types';
import { database } from './database';

type StoreName = 'propertyDocuments' | 'propertyMedia' | 'propertyVerifications' | 'propertyVerificationCandidates' | 'propertyDataSources' | 'reportSnapshots' | 'digitalTwinAssets' | 'agentJobs' | 'agentResults' | 'agentReviews' | 'propertySpaces' | 'spaceMediaLinks' | 'propertyFacilities' | 'renovationAssessments';

async function byProperty<T>(storeName: StoreName, propertyId: string): Promise<T[]> {
  const values = await (await database).getAllFromIndex(storeName, 'propertyId', propertyId) as T[];
  return values.filter((value) => !(value as { deletedAt?: string }).deletedAt);
}

async function put<T extends { id: string }>(storeName: StoreName, value: T): Promise<T> {
  await (await database).put(storeName, value);
  return value;
}

export const propertyDataRoomRepository = {
  getDocuments: (propertyId: string) => byProperty<PropertyDocument>('propertyDocuments', propertyId),
  async getDocument(id: string) { return (await database).get('propertyDocuments', id) as Promise<PropertyDocument | undefined>; },
  createDocument: (value: PropertyDocument) => put('propertyDocuments', value),
  updateDocument: (value: PropertyDocument) => put('propertyDocuments', value),
  async deleteDocument(id: string) {
    const db = await database; const value = await db.get('propertyDocuments', id) as PropertyDocument | undefined;
    if (value) await db.put('propertyDocuments', { ...value, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), fileData: undefined });
  },
  getMedia: (propertyId: string) => byProperty<PropertyMedia>('propertyMedia', propertyId),
  async getMediaItem(id: string) { return (await database).get('propertyMedia', id) as Promise<PropertyMedia | undefined>; },
  createMedia: (value: PropertyMedia) => put('propertyMedia', value),
  updateMedia: (value: PropertyMedia) => put('propertyMedia', value),
  async deleteMedia(id: string) {
    const db = await database; const value = await db.get('propertyMedia', id) as PropertyMedia | undefined;
    if (value) await db.put('propertyMedia', { ...value, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), fileData: undefined });
  },
  getSpaces: (propertyId: string) => byProperty<PropertySpace>('propertySpaces', propertyId),
  saveSpace: (value: PropertySpace) => put('propertySpaces', value),
  getSpaceMediaLinks: (propertyId: string) => byProperty<SpaceMediaLink>('spaceMediaLinks', propertyId),
  saveSpaceMediaLink: (value: SpaceMediaLink) => put('spaceMediaLinks', value),
  getFacilities: (propertyId: string) => byProperty<PropertyFacility>('propertyFacilities', propertyId),
  saveFacility: (value: PropertyFacility) => put('propertyFacilities', value),
  getRenovationAssessments: (propertyId: string) => byProperty<RenovationAssessment>('renovationAssessments', propertyId),
  saveRenovationAssessment: (value: RenovationAssessment) => put('renovationAssessments', value),
  getVerifications: (propertyId: string) => byProperty<PropertyVerification>('propertyVerifications', propertyId),
  saveVerification: (value: PropertyVerification) => put('propertyVerifications', value),
  getVerificationCandidates: (propertyId: string) => byProperty<PropertyVerificationCandidate>('propertyVerificationCandidates', propertyId),
  saveVerificationCandidate: (value: PropertyVerificationCandidate) => put('propertyVerificationCandidates', value),
  getDataSources: (propertyId: string) => byProperty<PropertyDataSource>('propertyDataSources', propertyId),
  saveDataSource: (value: PropertyDataSource) => put('propertyDataSources', value),
  async approveVerificationCandidate(input: {
    property: Property;
    candidate: PropertyVerificationCandidate;
    verification: PropertyVerification;
    dataSource: PropertyDataSource;
  }): Promise<PropertyVerificationCandidate> {
    const db = await database;
    const tx = db.transaction(['properties', 'propertyVerificationCandidates', 'propertyVerifications', 'propertyDataSources'], 'readwrite');
    await Promise.all([
      tx.objectStore('properties').put(input.property),
      tx.objectStore('propertyVerificationCandidates').put(input.candidate),
      tx.objectStore('propertyVerifications').put(input.verification),
      tx.objectStore('propertyDataSources').put(input.dataSource),
    ]);
    await tx.done;
    return input.candidate;
  },
  getReportSnapshots: (propertyId: string) => byProperty<ReportSnapshot>('reportSnapshots', propertyId),
  async getReportSnapshot(id: string) { return (await database).get('reportSnapshots', id) as Promise<ReportSnapshot | undefined>; },
  async saveReportSnapshot(value: ReportSnapshot) { await (await database).add('reportSnapshots', value); return value; },
  async updateReportSnapshotStatus(id: string, status: ReportSnapshot['status']): Promise<ReportSnapshot> {
    const db = await database;
    const tx = db.transaction('reportSnapshots', 'readwrite');
    const current = await tx.store.get(id) as ReportSnapshot | undefined;
    if (!current) { await tx.done; throw new Error('보고서 Snapshot을 찾을 수 없습니다.'); }
    const updated = { ...current, status };
    await tx.store.put(updated);
    await tx.done;
    return updated;
  },
  async createNextReportSnapshot(input: Omit<ReportSnapshot, 'reportVersion'>): Promise<ReportSnapshot> {
    const db = await database;
    const tx = db.transaction('reportSnapshots', 'readwrite');
    const existing = await tx.store.index('propertyId').getAll(input.propertyId) as ReportSnapshot[];
    const reportVersion = Math.max(0, ...existing.filter((item) => item.reportType === input.reportType).map((item) => item.reportVersion)) + 1;
    const snapshot = { ...input, reportVersion };
    await tx.store.add(snapshot);
    await tx.done;
    return snapshot;
  },
  getDigitalTwinAssets: (propertyId: string) => byProperty<DigitalTwinAsset>('digitalTwinAssets', propertyId),
  saveDigitalTwinAsset: (value: DigitalTwinAsset) => put('digitalTwinAssets', value),
  getAgentJobs: (propertyId: string) => byProperty<AgentJob>('agentJobs', propertyId),
  saveAgentJob: (value: AgentJob) => put('agentJobs', value),
  getAgentResults: (propertyId: string) => byProperty<AgentResult>('agentResults', propertyId),
  saveAgentResult: (value: AgentResult) => put('agentResults', value),
  getAgentReviews: (propertyId: string) => byProperty<AgentReview>('agentReviews', propertyId),
  saveAgentReview: (value: AgentReview) => put('agentReviews', value),
  async getAgentResultsByJob(jobId: string): Promise<AgentResult[]> {
    return (await database).getAllFromIndex('agentResults', 'jobId', jobId) as Promise<AgentResult[]>;
  },
  async archiveProperty(propertyId: string) {
    const db = await database; const now = new Date().toISOString();
    const stores: StoreName[] = ['propertyDocuments', 'propertyMedia', 'propertyVerifications', 'propertyVerificationCandidates', 'propertyDataSources', 'reportSnapshots', 'digitalTwinAssets', 'agentJobs', 'agentResults', 'agentReviews', 'propertySpaces', 'spaceMediaLinks', 'propertyFacilities', 'renovationAssessments'];
    for (const storeName of stores) {
      const values = await db.getAllFromIndex(storeName, 'propertyId', propertyId) as Array<Record<string, unknown> & { id: string }>;
      const tx = db.transaction(storeName, 'readwrite');
      for (const value of values) await tx.store.put({ ...value, deletedAt: now, updatedAt: now, fileData: undefined });
      await tx.done;
    }
  },
  async getBundle(propertyId: string): Promise<DataRoomBundle> {
    const [documents, media, verifications, verificationCandidates, dataSources, reportSnapshots, digitalTwinAssets, agentJobs, agentResults, agentReviews, spaces, spaceMediaLinks, facilities, renovationAssessments] = await Promise.all([
      this.getDocuments(propertyId), this.getMedia(propertyId), this.getVerifications(propertyId), this.getVerificationCandidates(propertyId),
      this.getDataSources(propertyId), this.getReportSnapshots(propertyId), this.getDigitalTwinAssets(propertyId), this.getAgentJobs(propertyId), this.getAgentResults(propertyId), this.getAgentReviews(propertyId), this.getSpaces(propertyId), this.getSpaceMediaLinks(propertyId), this.getFacilities(propertyId), this.getRenovationAssessments(propertyId),
    ]);
    return { documents, media, verifications, verificationCandidates, dataSources, reportSnapshots, digitalTwinAssets, agentJobs, agentResults, agentReviews, spaces, spaceMediaLinks, facilities, renovationAssessments };
  },
};
