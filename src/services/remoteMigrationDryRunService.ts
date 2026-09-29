import type { Settings } from '../types';
import { database } from '../repositories/database';
import { buildRemoteMigrationPlan, type LocalMigrationSnapshot, type RemoteMigrationPlan } from './remoteMigrationPlanService';

export const REMOTE_MIGRATION_LOCAL_STORES = [
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
] as const;

export interface RemoteMigrationDryRunOptions {
  companySettings?: Settings;
  includeCompanySettings?: boolean;
  propertyIds?: string[];
}

export interface RemoteMigrationDryRunResult {
  snapshot: LocalMigrationSnapshot;
  plan: RemoteMigrationPlan;
}

export async function collectRemoteMigrationSnapshot(options: RemoteMigrationDryRunOptions = {}): Promise<LocalMigrationSnapshot> {
  const db = await database;
  const requestedIds = new Set((options.propertyIds ?? []).map((value) => value.trim()).filter(Boolean));
  const allProperties = await db.getAll('properties');
  const properties = requestedIds.size ? allProperties.filter((property) => requestedIds.has(property.id)) : allProperties;
  if (requestedIds.size && properties.length !== requestedIds.size) {
    const found = new Set(properties.map((property) => property.id));
    const missing = [...requestedIds].filter((id) => !found.has(id));
    throw new Error(`Remote migration 대상 물건을 찾을 수 없습니다: ${missing.join(', ')}`);
  }
  const stores: Record<string, unknown[]> = {};

  for (const storeName of REMOTE_MIGRATION_LOCAL_STORES) {
    const values = await db.getAll(storeName);
    stores[storeName] = requestedIds.size
      ? values.filter((row) => {
          if (!row || typeof row !== 'object' || Array.isArray(row)) return true;
          const propertyId = typeof (row as { propertyId?: unknown }).propertyId === 'string'
            ? (row as { propertyId: string }).propertyId
            : '';
          return !propertyId || requestedIds.has(propertyId);
        })
      : values;
  }

  return {
    properties,
    settings: options.includeCompanySettings ? options.companySettings : undefined,
    stores,
  };
}

export async function runRemoteMigrationDryRun(options: RemoteMigrationDryRunOptions = {}): Promise<RemoteMigrationDryRunResult> {
  const snapshot = await collectRemoteMigrationSnapshot(options);
  return {
    snapshot,
    plan: buildRemoteMigrationPlan(snapshot),
  };
}

export function serializeRemoteMigrationPlan(plan: RemoteMigrationPlan) {
  return JSON.stringify(plan, null, 2);
}

export function downloadRemoteMigrationPlan(plan: RemoteMigrationPlan) {
  const blob = new Blob([serializeRemoteMigrationPlan(plan)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `daon-remote-migration-dry-run-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export const remoteMigrationDryRunService = {
  collect: collectRemoteMigrationSnapshot,
  run: runRemoteMigrationDryRun,
  serialize: serializeRemoteMigrationPlan,
  download: downloadRemoteMigrationPlan,
};
