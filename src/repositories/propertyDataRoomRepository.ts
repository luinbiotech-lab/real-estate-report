import type { DataRoomBundle, DigitalTwinAsset, PropertyDataSource, PropertyDocument, PropertyMedia, PropertyVerification, ReportSnapshot } from '../domain/propertyDataRoom/types';
import { database } from './database';

type StoreName = 'propertyDocuments' | 'propertyMedia' | 'propertyVerifications' | 'propertyDataSources' | 'reportSnapshots' | 'digitalTwinAssets';

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
  createDocument: (value: PropertyDocument) => put('propertyDocuments', value),
  updateDocument: (value: PropertyDocument) => put('propertyDocuments', value),
  async deleteDocument(id: string) {
    const db = await database; const value = await db.get('propertyDocuments', id) as PropertyDocument | undefined;
    if (value) await db.put('propertyDocuments', { ...value, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), fileData: undefined });
  },
  getMedia: (propertyId: string) => byProperty<PropertyMedia>('propertyMedia', propertyId),
  createMedia: (value: PropertyMedia) => put('propertyMedia', value),
  updateMedia: (value: PropertyMedia) => put('propertyMedia', value),
  async deleteMedia(id: string) {
    const db = await database; const value = await db.get('propertyMedia', id) as PropertyMedia | undefined;
    if (value) await db.put('propertyMedia', { ...value, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), fileData: undefined });
  },
  getVerifications: (propertyId: string) => byProperty<PropertyVerification>('propertyVerifications', propertyId),
  saveVerification: (value: PropertyVerification) => put('propertyVerifications', value),
  getDataSources: (propertyId: string) => byProperty<PropertyDataSource>('propertyDataSources', propertyId),
  saveDataSource: (value: PropertyDataSource) => put('propertyDataSources', value),
  getReportSnapshots: (propertyId: string) => byProperty<ReportSnapshot>('reportSnapshots', propertyId),
  async getReportSnapshot(id: string) { return (await database).get('reportSnapshots', id) as Promise<ReportSnapshot | undefined>; },
  async saveReportSnapshot(value: ReportSnapshot) { await (await database).add('reportSnapshots', value); return value; },
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
  async archiveProperty(propertyId: string) {
    const db = await database; const now = new Date().toISOString();
    const stores: StoreName[] = ['propertyDocuments', 'propertyMedia', 'propertyVerifications', 'propertyDataSources', 'reportSnapshots', 'digitalTwinAssets'];
    for (const storeName of stores) {
      const values = await db.getAllFromIndex(storeName, 'propertyId', propertyId) as Array<Record<string, unknown> & { id: string }>;
      const tx = db.transaction(storeName, 'readwrite');
      for (const value of values) await tx.store.put({ ...value, deletedAt: now, updatedAt: now, fileData: undefined });
      await tx.done;
    }
  },
  async getBundle(propertyId: string): Promise<DataRoomBundle> {
    const [documents, media, verifications, dataSources, reportSnapshots, digitalTwinAssets] = await Promise.all([
      this.getDocuments(propertyId), this.getMedia(propertyId), this.getVerifications(propertyId),
      this.getDataSources(propertyId), this.getReportSnapshots(propertyId), this.getDigitalTwinAssets(propertyId),
    ]);
    return { documents, media, verifications, dataSources, reportSnapshots, digitalTwinAssets };
  },
};
