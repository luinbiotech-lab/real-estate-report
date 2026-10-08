import { existsSync, readFileSync } from 'node:fs';

const files = {
  workflow: '.github/workflows/post-migration-reconciliation.yml',
  script: 'scripts/post-migration-reconciliation.mjs',
};
for (const file of Object.values(files)) if (!existsSync(file)) throw new Error(`Post-migration reconciliation file missing: ${file}`);

const workflow = readFileSync(files.workflow, 'utf8');
const script = readFileSync(files.script, 'utf8');

for (const marker of [
  'workflow_dispatch:',
  'SUPABASE_SERVICE_ROLE_KEY',
  'secrets.SUPABASE_SERVICE_ROLE_KEY',
  'sample-bangbae-815-11',
  'post-migration-reconciliation.mjs',
  'Production mutation: NONE',
]) if (!workflow.includes(marker)) throw new Error(`Reconciliation workflow marker missing: ${marker}`);

for (const marker of [
  "propertyRows.length !== 1",
  "rows('property_objects'",
  "rows('property_assets'",
  "rows('property_verification_candidates'",
  "rows('property_verifications'",
  "rows('report_snapshots'",
  '/storage/v1/object/daon-property-assets/',
  'bytes.byteLength !== expectedSize',
  'writesPerformed: 0',
  'storageObjectsVerified',
  "rows('property_media_policies'",
  "rows('property_spaces_spatial'",
  "rows('viewer_scenes'",
  "rows('walkthrough_routes'",
  "rows('verification_events'",
  "propertyId === 'sample-bangbae-815-11'",
  'bangbaeContract.typedSpaces === 5',
  'bangbaeContract.viewerNodes === 5',
  'bangbaeContract.viewerEdges === 4',
  'bangbaeContract.walkthroughSteps === 5',
  'bangbaeContract.verificationEvents >= 11',
  'bangbaeContract.comparableRows === 6',
  'bangbaeContract.comparableProvenanceComplete',
  'bangbaeContract.exteriorOnlyEvidence',
]) if (!script.includes(marker)) throw new Error(`Reconciliation script marker missing: ${marker}`);

for (const forbidden of [
  "method: 'POST'",
  "method: 'PATCH'",
  "method: 'DELETE'",
  '.upload(',
  '.insert(',
  '.update(',
  '.delete(',
  'sb_secret_',
]) {
  if (script.includes(forbidden)) throw new Error(`Reconciliation script must remain read-only / secret-clean: ${forbidden}`);
}

console.log('Post-migration reconciliation contract: PASS');
