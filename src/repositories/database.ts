import { openDB } from 'idb';

export const DATABASE_NAME = 'real-estate-report';
export const DATABASE_VERSION = 5;

export const database = openDB(DATABASE_NAME, DATABASE_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('properties')) db.createObjectStore('properties', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
    if (!db.objectStoreNames.contains('importJobs')) db.createObjectStore('importJobs', { keyPath: 'id' });
    for (const name of ['propertyDocuments', 'propertyMedia', 'propertyVerifications', 'propertyVerificationCandidates', 'propertyDataSources', 'reportSnapshots', 'digitalTwinAssets', 'agentJobs', 'agentResults', 'agentReviews']) {
      if (!db.objectStoreNames.contains(name)) {
        const store = db.createObjectStore(name, { keyPath: 'id' });
        store.createIndex('propertyId', 'propertyId');
        if (name === 'agentResults' || name === 'agentReviews') store.createIndex('jobId', 'jobId');
      }
    }
  },
});
