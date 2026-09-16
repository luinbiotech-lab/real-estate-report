import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const ARTIFACT_DIR = 'artifacts/agent-qa';
const MANIFEST_PATH = '/tmp/daon-remote-migration-dry-run.json';
const HANDOFF_PATH = '/tmp/daon-remote-migration-handoff.json';

async function waitForText(page, text, timeout = 30_000) {
  await page.waitForFunction((expected) => document.body?.innerText.toLowerCase().includes(String(expected).toLowerCase()), text, { timeout });
}

await mkdir(ARTIFACT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 1400 } });

try {
  await page.goto(`${BASE_URL}/migration-readiness`, { waitUntil: 'domcontentloaded' });
  for (const text of ['Migration Readiness Review', 'REMOTE MIGRATION · DRY-RUN ONLY', 'NETWORK WRITES = 0', 'Dry-Run 실행']) await waitForText(page, text);

  await page.getByRole('button', { name: 'Dry-Run 실행' }).click();
  for (const text of ['MIGRATION GATE', 'BLOCKER REVIEW', 'STORAGE PLAN', 'REHEARSAL CHECKLIST', 'networkWrites=0']) await waitForText(page, text);

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

  const handoffDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Handoff Bundle 다운로드' }).click();
  const handoffDownload = await handoffDownloadPromise;
  await handoffDownload.saveAs(HANDOFF_PATH);
  const handoff = JSON.parse(await readFile(HANDOFF_PATH, 'utf8'));

  if (handoff.schemaVersion !== 'daon-remote-migration-handoff-v1') throw new Error(`Unexpected handoff schema: ${handoff.schemaVersion}`);
  if (handoff.safety?.dryRunOnly !== true || handoff.safety?.networkWritesPerformed !== 0) throw new Error('Handoff safety boundary is invalid.');
  if (handoff.safety?.remoteExecutionEnabled !== false || handoff.safety?.secretsIncluded !== false || handoff.safety?.binaryPayloadsIncluded !== false) throw new Error('Handoff must exclude remote execution, secrets, and binary payloads.');
  if (handoff.readiness?.productionReady !== false) throw new Error('Handoff must never mark production ready before external infrastructure E2E.');
  if (!Array.isArray(handoff.deploymentOrder) || handoff.deploymentOrder.length < 8) throw new Error('Handoff deployment order is incomplete.');
  if (!Array.isArray(handoff.verificationChecklist) || handoff.verificationChecklist.length < 10) throw new Error('Handoff verification checklist is incomplete.');
  if (handoff.manifest?.networkWrites !== 0 || handoff.manifest?.dryRun !== true) throw new Error('Embedded migration manifest safety boundary changed.');

  const serializedHandoff = JSON.stringify(handoff);
  for (const forbidden of ['SUPABASE_SERVICE_ROLE_KEY', 'DAON_OWNER_BOOTSTRAP_KEY=', 'service_role=']) {
    if (serializedHandoff.includes(forbidden)) throw new Error(`Secret-like marker found in handoff bundle: ${forbidden}`);
  }

  await page.screenshot({ path: `${ARTIFACT_DIR}/remote-migration-readiness.png`, fullPage: true });
  console.log('Rendered remote migration readiness + manifest + handoff bundle download QA: PASS');
} catch (error) {
  await page.screenshot({ path: `${ARTIFACT_DIR}/remote-migration-readiness-failure.png`, fullPage: true });
  console.error('Rendered remote migration readiness QA: FAIL');
  console.error(error);
  throw error;
} finally {
  await browser.close();
}
