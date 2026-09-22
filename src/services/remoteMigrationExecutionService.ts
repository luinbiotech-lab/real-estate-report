import type { PropertyVerification, PropertyVerificationCandidate, ReportSnapshot } from '../domain/propertyDataRoom/types';
import type { LocalMigrationSnapshot, RemoteMigrationPlan } from './remoteMigrationPlanService';
import { remoteAssetStorageGateway, remoteDataGateway } from './remoteDataGateway';

export const REMOTE_MIGRATION_EXECUTION_VERSION = 'daon-remote-migration-execution-v1';
export const REMOTE_MIGRATION_CONFIRMATION = 'MIGRATE TO PRODUCTION';

export interface RemoteMigrationExecutionApproval {
  approved: true;
  confirmationText: typeof REMOTE_MIGRATION_CONFIRMATION;
  expectedPlanGeneratedAt: string;
}

export interface RemoteMigrationExecutionResult {
  schemaVersion: typeof REMOTE_MIGRATION_EXECUTION_VERSION;
  planGeneratedAt: string;
  startedAt: string;
  completedAt: string;
  written: {
    properties: number;
    objects: number;
    assets: number;
    verificationCandidates: number;
    verifications: number;
    reportSnapshots: number;
    companySettings: number;
  };
  skippedExisting: {
    verificationCandidates: number;
    verifications: number;
    reportSnapshots: number;
  };
  reconciliation: {
    expectedProperties: number;
    remotePropertiesPresent: number;
    expectedObjects: number;
    remoteObjectsPresent: number;
    expectedAssets: number;
    remoteAssetsPresent: number;
    expectedVerificationCandidates: number;
    remoteVerificationCandidatesPresent: number;
    expectedVerifications: number;
    remoteVerificationsPresent: number;
    expectedReportSnapshots: number;
    remoteReportSnapshotsPresent: number;
    passed: boolean;
  };
}

function rows<T>(snapshot: LocalMigrationSnapshot, store: string): T[] {
  return (snapshot.stores[store] ?? []) as T[];
}

function requireExecutionGate(plan: RemoteMigrationPlan, approval: RemoteMigrationExecutionApproval) {
  if (!approval.approved || approval.confirmationText !== REMOTE_MIGRATION_CONFIRMATION) {
    throw new Error('Production migration 실행 승인이 확인되지 않았습니다.');
  }
  if (approval.expectedPlanGeneratedAt !== plan.generatedAt) {
    throw new Error('승인된 dry-run plan과 실행 대상 plan이 다릅니다. Dry-run을 다시 실행해 승인해야 합니다.');
  }
  if (!plan.readyForRemoteWrite || plan.blockers.length) {
    throw new Error(`Remote migration blocker가 ${plan.blockers.length}건 남아 있어 실행할 수 없습니다.`);
  }
  if (!plan.dryRun || plan.networkWrites !== 0) {
    throw new Error('실행 입력은 검증된 dry-run plan이어야 합니다.');
  }
  const unsupportedAsset = plan.assetUploads.find((asset) => asset.binarySource !== 'blob');
  if (unsupportedAsset) {
    throw new Error(`${unsupportedAsset.resourceType}/${unsupportedAsset.id}: migration 실행에는 로컬 binary가 필요합니다.`);
  }
}

function findLocalAsset(snapshot: LocalMigrationSnapshot, resourceType: 'document' | 'media' | 'digital_twin', id: string) {
  const store = resourceType === 'document' ? 'propertyDocuments' : resourceType === 'media' ? 'propertyMedia' : 'digitalTwinAssets';
  return rows<Record<string, unknown>>(snapshot, store).find((row) => row.id === id);
}

async function existingIdsByProperty<T extends { id: string; propertyId: string }>(
  propertyIds: string[],
  loader: (propertyId: string) => Promise<T[]>,
) {
  const ids = new Set<string>();
  for (const propertyId of propertyIds) {
    for (const item of await loader(propertyId)) ids.add(item.id);
  }
  return ids;
}

export async function executeRemoteMigration(
  snapshot: LocalMigrationSnapshot,
  plan: RemoteMigrationPlan,
  approval: RemoteMigrationExecutionApproval,
): Promise<RemoteMigrationExecutionResult> {
  requireExecutionGate(plan, approval);
  const startedAt = new Date().toISOString();
  const propertyIds = plan.properties.map((item) => item.id);

  const existingCandidates = await existingIdsByProperty<PropertyVerificationCandidate>(
    propertyIds,
    (propertyId) => remoteDataGateway.listVerificationCandidates(propertyId),
  );
  const existingVerifications = await existingIdsByProperty<PropertyVerification>(
    propertyIds,
    (propertyId) => remoteDataGateway.listVerifications(propertyId),
  );
  const existingSnapshots = await existingIdsByProperty<ReportSnapshot>(
    propertyIds,
    (propertyId) => remoteDataGateway.listReportSnapshots(propertyId),
  );

  const written = {
    properties: 0,
    objects: 0,
    assets: 0,
    verificationCandidates: 0,
    verifications: 0,
    reportSnapshots: 0,
    companySettings: 0,
  };
  const skippedExisting = { verificationCandidates: 0, verifications: 0, reportSnapshots: 0 };

  for (const item of plan.properties) {
    await remoteDataGateway.upsertProperty(item.payload);
    written.properties += 1;
  }

  for (const object of plan.objects) {
    await remoteDataGateway.upsertObject(object);
    written.objects += 1;
  }

  for (const upload of plan.assetUploads) {
    const local = findLocalAsset(snapshot, upload.resourceType, upload.id);
    const blob = local?.fileData;
    if (!(blob instanceof Blob)) throw new Error(`${upload.resourceType}/${upload.id}: 실행 시점에 local Blob을 찾을 수 없습니다.`);
    await remoteAssetStorageGateway.upload(upload.storagePath, blob, upload.mimeType, true);
  }
  for (const asset of plan.assets) {
    await remoteDataGateway.upsertAssetMetadata(asset);
    written.assets += 1;
  }

  for (const item of plan.verificationCandidates) {
    if (existingCandidates.has(item.candidate.id)) {
      skippedExisting.verificationCandidates += 1;
      continue;
    }
    await remoteDataGateway.submitVerificationCandidate(item.candidate);
    written.verificationCandidates += 1;
  }

  for (const item of plan.verifications) {
    if (existingVerifications.has(item.verification.id)) {
      skippedExisting.verifications += 1;
      continue;
    }
    await remoteDataGateway.appendVerification(item.verification);
    written.verifications += 1;
  }

  for (const item of plan.reportSnapshots) {
    if (existingSnapshots.has(item.snapshot.id)) {
      skippedExisting.reportSnapshots += 1;
      continue;
    }
    await remoteDataGateway.createReportSnapshot(item);
    written.reportSnapshots += 1;
  }

  if (plan.companySettings) {
    await remoteDataGateway.saveCompanySettings(plan.companySettings);
    written.companySettings = 1;
  }

  const remoteProperties = await remoteDataGateway.listProperties();
  let remoteObjectCount = 0;
  let remoteAssetCount = 0;
  let remoteVerificationCandidateCount = 0;
  let remoteVerificationCount = 0;
  let remoteReportSnapshotCount = 0;
  for (const propertyId of propertyIds) {
    remoteObjectCount += (await remoteDataGateway.listObjects(propertyId)).filter((item) =>
      plan.objects.some((expected) => expected.objectType === item.objectType && expected.id === item.id)
    ).length;
    remoteAssetCount += (await remoteDataGateway.listAssets(propertyId)).filter((item) =>
      plan.assets.some((expected) => expected.resourceType === item.resourceType && expected.id === item.id)
    ).length;
    remoteVerificationCandidateCount += (await remoteDataGateway.listVerificationCandidates(propertyId)).filter((item) =>
      plan.verificationCandidates.some((expected) => expected.candidate.id === item.id)
    ).length;
    remoteVerificationCount += (await remoteDataGateway.listVerifications(propertyId)).filter((item) =>
      plan.verifications.some((expected) => expected.verification.id === item.id)
    ).length;
    remoteReportSnapshotCount += (await remoteDataGateway.listReportSnapshots(propertyId)).filter((item) =>
      plan.reportSnapshots.some((expected) => expected.snapshot.id === item.id)
    ).length;
  }
  const remotePropertyIds = new Set(remoteProperties.map((property) => property.id));
  const remotePropertiesPresent = propertyIds.filter((id) => remotePropertyIds.has(id)).length;
  const reconciliation = {
    expectedProperties: plan.properties.length,
    remotePropertiesPresent,
    expectedObjects: plan.objects.length,
    remoteObjectsPresent: remoteObjectCount,
    expectedAssets: plan.assets.length,
    remoteAssetsPresent: remoteAssetCount,
    expectedVerificationCandidates: plan.verificationCandidates.length,
    remoteVerificationCandidatesPresent: remoteVerificationCandidateCount,
    expectedVerifications: plan.verifications.length,
    remoteVerificationsPresent: remoteVerificationCount,
    expectedReportSnapshots: plan.reportSnapshots.length,
    remoteReportSnapshotsPresent: remoteReportSnapshotCount,
    passed:
      remotePropertiesPresent === plan.properties.length &&
      remoteObjectCount === plan.objects.length &&
      remoteAssetCount === plan.assets.length &&
      remoteVerificationCandidateCount === plan.verificationCandidates.length &&
      remoteVerificationCount === plan.verifications.length &&
      remoteReportSnapshotCount === plan.reportSnapshots.length,
  };

  if (!reconciliation.passed) {
    throw new Error(`Remote migration reconciliation 실패: ${JSON.stringify(reconciliation)}`);
  }

  return {
    schemaVersion: REMOTE_MIGRATION_EXECUTION_VERSION,
    planGeneratedAt: plan.generatedAt,
    startedAt,
    completedAt: new Date().toISOString(),
    written,
    skippedExisting,
    reconciliation,
  };
}

export const remoteMigrationExecutionService = { execute: executeRemoteMigration };
