import type { RemoteMigrationBlocker, RemoteMigrationPlan } from './remoteMigrationPlanService';

export const REMOTE_MIGRATION_HANDOFF_VERSION = 'daon-remote-migration-handoff-v1';

export interface RemoteMigrationHandoffBundle {
  schemaVersion: typeof REMOTE_MIGRATION_HANDOFF_VERSION;
  generatedAt: string;
  sourcePlanSchemaVersion: RemoteMigrationPlan['schemaVersion'];
  safety: {
    dryRunOnly: true;
    networkWritesPerformed: 0;
    remoteExecutionEnabled: false;
    secretsIncluded: false;
    binaryPayloadsIncluded: false;
  };
  readiness: {
    localPlanReady: boolean;
    productionReady: false;
    blockerCount: number;
    blockers: RemoteMigrationBlocker[];
    externalPrerequisites: string[];
  };
  counts: RemoteMigrationPlan['counts'];
  storageUploads: Array<{
    resourceType: string;
    id: string;
    propertyId: string;
    storagePath: string;
    fileName: string;
    mimeType?: string;
    fileSize?: number;
    binarySource: string;
  }>;
  deploymentOrder: Array<{
    step: number;
    action: string;
    artifact: string;
    gate: string;
  }>;
  verificationChecklist: string[];
  manifest: RemoteMigrationPlan;
}

const externalPrerequisites = [
  'Dedicated real-estate Supabase project provisioned; GPS/Sports projects are not reused.',
  'Production frontend origin and Auth redirect URLs are known.',
  'Server-only service_role and OWNER bootstrap secret are provisioned outside the browser.',
  'Production NAVER/Kakao protected proxy host and provider allowlists are configured.',
  'Human approval is recorded before any migration or Storage write is executed.',
];

const deploymentOrder: RemoteMigrationHandoffBundle['deploymentOrder'] = [
  { step: 1, action: 'Apply Auth/profile schema and RLS', artifact: 'supabase/migrations/20260916_auth_profiles_rls.sql', gate: 'Migration review + dedicated project identity confirmed' },
  { step: 2, action: 'Deploy authenticated OWNER administration boundary', artifact: 'supabase/functions/remote-auth-admin', gate: 'Exact CORS allowlist + server-only bootstrap secret configured' },
  { step: 3, action: 'Bootstrap exactly one initial active OWNER', artifact: 'remote-auth-admin/bootstrap_owner', gate: 'Second bootstrap rejected; bootstrap secret rotated/removed' },
  { step: 4, action: 'Apply Property/Data schema and RLS', artifact: 'supabase/migrations/20260916_property_data_rls.sql', gate: 'Role matrix reviewed against accessControlService capability policy' },
  { step: 5, action: 'Apply private Property asset Storage boundary', artifact: 'supabase/migrations/20260916_property_asset_storage.sql', gate: 'Private bucket + authenticated path policy verified' },
  { step: 6, action: 'Run local migration dry-run again', artifact: 'Migration Readiness Review', gate: 'Blockers = 0 and manifest archived' },
  { step: 7, action: 'Execute controlled Property/Data + Storage migration', artifact: 'RemoteDataGateway implementation', gate: 'Explicit human release approval; remote adapter connected' },
  { step: 8, action: 'Deploy REMOTE/PUBLIC share boundary', artifact: 'supabase/functions/remote-public-share', gate: 'Signed snapshot issuance + token hash/revoke/expiry tests pass' },
  { step: 9, action: 'Run production cross-device E2E', artifact: 'docs/production-connection-runbook.md', gate: 'Role RLS, assets, reports, sharing, maps, restore rehearsal all pass' },
];

const verificationChecklist = [
  'Confirm dedicated Supabase project ID is not any GPS/Sports project ID.',
  'Confirm browser bundle contains no service_role, OWNER bootstrap secret, NAVER secret, or Kakao REST secret.',
  'Confirm wrong OWNER bootstrap key is rejected and only the first bootstrap succeeds.',
  'Confirm VIEWER cannot mutate Property/Data/Storage records.',
  'Confirm EDITOR cannot finalize verification/report states reserved for OWNER/ADMIN.',
  'Confirm final active OWNER cannot be demoted or disabled.',
  'Confirm every document/media/Digital Twin binary round-trips through private Storage.',
  'Confirm no Blob, ArrayBuffer, TypedArray, base64 data URL, or raw binary is stored in JSONB metadata.',
  'Confirm local record counts reconcile with remote table/Storage counts after migration.',
  'Confirm second-device session reads the same Property/Data state.',
  'Confirm public-share raw token is never persisted and revoke/expiry are enforced server-side.',
  'Confirm backup/export and at least one restore rehearsal before production cutover.',
];

export function buildRemoteMigrationHandoffBundle(plan: RemoteMigrationPlan): RemoteMigrationHandoffBundle {
  return {
    schemaVersion: REMOTE_MIGRATION_HANDOFF_VERSION,
    generatedAt: new Date().toISOString(),
    sourcePlanSchemaVersion: plan.schemaVersion,
    safety: {
      dryRunOnly: true,
      networkWritesPerformed: 0,
      remoteExecutionEnabled: false,
      secretsIncluded: false,
      binaryPayloadsIncluded: false,
    },
    readiness: {
      localPlanReady: plan.readyForRemoteWrite,
      productionReady: false,
      blockerCount: plan.blockers.length,
      blockers: plan.blockers,
      externalPrerequisites: [...externalPrerequisites],
    },
    counts: { ...plan.counts },
    storageUploads: plan.assetUploads.map(({ resourceType, id, propertyId, storagePath, fileName, mimeType, fileSize, binarySource }) => ({
      resourceType, id, propertyId, storagePath, fileName, mimeType, fileSize, binarySource,
    })),
    deploymentOrder: deploymentOrder.map((item) => ({ ...item })),
    verificationChecklist: [...verificationChecklist],
    manifest: plan,
  };
}

export function serializeRemoteMigrationHandoffBundle(bundle: RemoteMigrationHandoffBundle) {
  return JSON.stringify(bundle, null, 2);
}

export function downloadRemoteMigrationHandoffBundle(plan: RemoteMigrationPlan) {
  const bundle = buildRemoteMigrationHandoffBundle(plan);
  const blob = new Blob([serializeRemoteMigrationHandoffBundle(bundle)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `daon-remote-migration-handoff-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export const remoteMigrationHandoffService = {
  build: buildRemoteMigrationHandoffBundle,
  serialize: serializeRemoteMigrationHandoffBundle,
  download: downloadRemoteMigrationHandoffBundle,
};
