import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const ARTIFACT_DIR = 'artifacts/agent-qa';
const MANIFEST_PATH = '/tmp/daon-remote-migration-dry-run.json';
const HANDOFF_PATH = '/tmp/daon-remote-migration-handoff.json';
const QA_INLINE_PROPERTY_ID = 'qa-inline-property';
const QA_INLINE_BINARY_ID = 'qa-inline-binary-risk';
const QA_BINARY_PAYLOAD_SENTINEL = 'DAON_QA_SENSITIVE_BINARY_PAYLOAD_SENTINEL_20260916';

async function waitForText(page, text, timeout = 30_000) {
  await page.waitForFunction((expected) => document.body?.innerText.toLowerCase().includes(String(expected).toLowerCase()), text, { timeout });
}

async function writeQaRows(page) {
  await page.evaluate(async ({ propertyId, riskId, binaryPayload }) => new Promise((resolve, reject) => {
    const request = indexedDB.open('real-estate-report');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(['properties', 'riskAssessments'], 'readwrite');
      tx.objectStore('properties').put({ id: propertyId, name: 'QA inline property', mainImage: 'data:image/png;base64,UUE=' });
      tx.objectStore('riskAssessments').put({ id: riskId, propertyId: 'daon-bangbae-815-11', title: 'QA binary risk', payload: new Blob([binaryPayload], { type: 'text/plain' }) });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }), { propertyId: QA_INLINE_PROPERTY_ID, riskId: QA_INLINE_BINARY_ID, binaryPayload: QA_BINARY_PAYLOAD_SENTINEL });
}

async function cleanupQaRows(page) {
  await page.evaluate(async ({ propertyId, riskId }) => new Promise((resolve, reject) => {
    const request = indexedDB.open('real-estate-report');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(['properties', 'riskAssessments'], 'readwrite');
      tx.objectStore('properties').delete(propertyId);
      tx.objectStore('riskAssessments').delete(riskId);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }), { propertyId: QA_INLINE_PROPERTY_ID, riskId: QA_INLINE_BINARY_ID });
}

await mkdir(ARTIFACT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 1400 } });

try {
  await page.goto(`${BASE_URL}/migration-readiness`, { waitUntil: 'domcontentloaded' });
  for (const text of ['Migration Readiness Review', 'REMOTE MIGRATION · DRY-RUN ONLY', 'NETWORK WRITES = 0', 'Dry-Run 실행']) await waitForText(page, text);

  await writeQaRows(page);
  await page.getByRole('button', { name: 'Dry-Run 실행' }).click();
  for (const text of ['MIGRATION GATE', 'BLOCKER REVIEW', 'STORAGE PLAN', 'REHEARSAL CHECKLIST', 'networkWrites=0', 'INLINE_DATA_URL', 'INLINE_BINARY']) await waitForText(page, text);

  const manifestDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Manifest JSON 다운로드' }).click();
  const manifestDownload = await manifestDownloadPromise;
  await manifestDownload.saveAs(MANIFEST_PATH);
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));

  if (manifest.schemaVersion !== 'daon-remote-migration-plan-v1') throw new Error(`Unexpected migration schema: ${manifest.schemaVersion}`);
  if (manifest.dryRun !== true) throw new Error('Migration manifest must remain dryRun=true.');
  if (manifest.networkWrites !== 0) throw new Error(`Migration dry-run performed writes: ${manifest.networkWrites}`);
  if (!Array.isArray(manifest.properties) || manifest.properties.length < 1) throw new Error('Expected seeded local properties in migration manifest.');
  if (!manifest.counts || manifest.counts.properties !== manifest.properties.length) throw new Error('Migration manifest property counts are inconsistent.');
  if (manifest.properties.some((row) => row?.id === QA_INLINE_PROPERTY_ID)) throw new Error('Inline data URL Property must be excluded from migration writes.');
  if (manifest.objects.some((row) => row?.id === QA_INLINE_BINARY_ID)) throw new Error('Structured Blob object must be excluded from migration writes.');
  const blockerCodes = new Set((manifest.blockers ?? []).map((row) => row?.code));
  if (!blockerCodes.has('INLINE_DATA_URL') || !blockerCodes.has('INLINE_BINARY')) throw new Error('Expected inline payload blockers were not produced.');
  if (manifest.readyForRemoteWrite !== false) throw new Error('Manifest with inline payload blockers cannot be ready for remote write.');

  const handoffDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Handoff Bundle 다운로드' }).click();
  const handoffDownload = await handoffDownloadPromise;
  await handoffDownload.saveAs(HANDOFF_PATH);
  const handoff = JSON.parse(await readFile(HANDOFF_PATH, 'utf8'));

  if (handoff.schemaVersion !== 'daon-remote-migration-handoff-v1') throw new Error(`Unexpected handoff schema: ${handoff.schemaVersion}`);
  if (handoff.safety?.dryRunOnly !== true || handoff.safety?.networkWritesPerformed !== 0) throw new Error('Handoff safety boundary is invalid.');
  if (handoff.safety?.remoteExecutionEnabled !== false || handoff.safety?.secretsIncluded !== false || handoff.safety?.binaryPayloadsIncluded !== false) throw new Error('Handoff must exclude remote execution, secrets, and binary payloads.');
  if (handoff.readiness?.productionReady !== false || handoff.readiness?.localPlanReady !== false) throw new Error('Blocked handoff cannot be marked locally or production ready.');
  if (handoff.readiness?.blockerCount !== manifest.blockers.length) throw new Error('Handoff blocker count must reconcile with manifest.');
  if (!Array.isArray(handoff.deploymentOrder) || handoff.deploymentOrder.length < 8) throw new Error('Handoff deployment order is incomplete.');
  if (!Array.isArray(handoff.verificationChecklist) || handoff.verificationChecklist.length < 10) throw new Error('Handoff verification checklist is incomplete.');
  if (handoff.manifest?.networkWrites !== 0 || handoff.manifest?.dryRun !== true) throw new Error('Embedded migration manifest safety boundary changed.');

  const serializedHandoff = JSON.stringify(handoff);
  for (const forbidden of ['SUPABASE_SERVICE_ROLE_KEY', 'DAON_OWNER_BOOTSTRAP_KEY=', 'service_role=']) {
    if (serializedHandoff.includes(forbidden)) throw new Error(`Secret-like marker found in handoff bundle: ${forbidden}`);
  }
  if (serializedHandoff.includes('data:image/png;base64,UUE=')) throw new Error('Blocked inline image leaked into handoff bundle.');
  if (serializedHandoff.includes(QA_BINARY_PAYLOAD_SENTINEL)) throw new Error('Blocked structured binary payload leaked into handoff bundle.');

  await page.screenshot({ path: `${ARTIFACT_DIR}/remote-migration-readiness.png`, fullPage: true });
  console.log('Rendered remote migration readiness + payload blockers + manifest + handoff bundle QA: PASS');
} catch (error) {
  await page.screenshot({ path: `${ARTIFACT_DIR}/remote-migration-readiness-failure.png`, fullPage: true });
  console.error('Rendered remote migration readiness QA: FAIL');
  console.error(error);
  throw error;
} finally {
  try { await cleanupQaRows(page); } catch { /* best-effort QA cleanup */ }
  await browser.close();
}
