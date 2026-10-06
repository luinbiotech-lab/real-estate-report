import { openDB } from 'idb';

export const DATABASE_NAME = 'real-estate-report';
export const RISK_AGENT_FOUNDATION_DATABASE_VERSION = 8;
export const DATABASE_VERSION = 14;

export const database = openDB(DATABASE_NAME, DATABASE_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('properties')) db.createObjectStore('properties', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
    if (!db.objectStoreNames.contains('importJobs')) db.createObjectStore('importJobs', { keyPath: 'id' });
    for (const name of [
      'propertyDocuments',
      'propertyMedia',
      'propertyVerifications',
      'propertyVerificationCandidates',
      'propertyDataSources',
      'reportSnapshots',
      'digitalTwinAssets',
      'agentJobs',
      'agentResults',
      'agentReviews',
      'propertySpaces',
      'spaceMediaLinks',
      'spaceRoomLinks',
      'propertyFacilities',
      'roomEvidencePositions',
      'roomConditionHistory',
      'renovationAssessments',
      'roomRenovationAssessments',
      'roomRenovationHistory',
      'riskAssessments',
      'buildingReleaseSnapshots',
      'buildingReleaseSnapshotStates',
      'buildingReleaseShares',
      'buildingReleaseReviewNotes',
      'propertyMediaPolicies',
      'floorPlans',
      'propertySpacesSpatial',
      'mediaAssets',
      'mediaSpaceLinks',
      'viewerScenes',
      'viewerNodes',
      'viewerEdges',
      'walkthroughRoutes',
      'walkthroughSteps',
      'verificationEvents',
    ]) {
      if (!db.objectStoreNames.contains(name)) {
        const store = db.createObjectStore(name, { keyPath: name === 'propertyMediaPolicies' ? 'propertyId' : 'id' });
        if (name !== 'propertyMediaPolicies') store.createIndex('propertyId', 'propertyId');
        if (name === 'propertyMediaPolicies') store.createIndex('propertyId', 'propertyId');
        if (name === 'agentResults' || name === 'agentReviews') store.createIndex('jobId', 'jobId');
        if (name === 'spaceMediaLinks') {
          store.createIndex('spaceId', 'spaceId');
          store.createIndex('mediaId', 'mediaId');
        }
        if (name === 'mediaSpaceLinks') {
          store.createIndex('mediaAssetId', 'mediaAssetId');
          store.createIndex('spaceId', 'spaceId');
          store.createIndex('matchStatus', 'matchStatus');
        }
        if (name === 'viewerNodes') {
          store.createIndex('sceneId', 'sceneId');
          store.createIndex('spaceId', 'spaceId');
        }
        if (name === 'viewerEdges') {
          store.createIndex('sceneId', 'sceneId');
          store.createIndex('fromNodeId', 'fromNodeId');
          store.createIndex('toNodeId', 'toNodeId');
        }
        if (name === 'walkthroughSteps') {
          store.createIndex('routeId', 'routeId');
          store.createIndex('spaceId', 'spaceId');
          store.createIndex('mediaAssetId', 'mediaAssetId');
        }
        if (name === 'verificationEvents') {
          store.createIndex('targetType', 'targetType');
          store.createIndex('targetId', 'targetId');
        }
        if (name === 'spaceRoomLinks' || name === 'roomRenovationAssessments' || name === 'roomEvidencePositions' || name === 'roomConditionHistory' || name === 'roomRenovationHistory') {
          store.createIndex('spaceId', 'spaceId');
          store.createIndex('digitalTwinAssetId', 'digitalTwinAssetId');
          store.createIndex('roomCandidateId', 'roomCandidateId');
        }
        if (name === 'roomEvidencePositions') {
          store.createIndex('resourceId', 'resourceId');
          store.createIndex('resourceType', 'resourceType');
        }
        if (name === 'roomRenovationHistory') store.createIndex('assessmentId', 'assessmentId');
        if (name === 'buildingReleaseSnapshotStates' || name === 'buildingReleaseShares' || name === 'buildingReleaseReviewNotes') store.createIndex('snapshotId', 'snapshotId');
      }
    }
  },
});
