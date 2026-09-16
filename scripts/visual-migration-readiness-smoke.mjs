import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const ARTIFACT_DIR = 'artifacts/agent-qa';
const MANIFEST_PATH = '/tmp/daon-remote-migration-dry-run.json';

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

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Manifest JSON 다운로드' }).click();
  const download = await downloadPromise;
  await download.saveAs(MANIFEST_PATH);
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));

  if (manifest.schemaVersion !== 'daon-remote-migration-plan-v1') throw new Error(`Unexpected migration schema: ${manifest.schemaVersion}`);
  if (manifest.dryRun !== true) throw new Error('Migration manifest must remain dryRun=true.');
  if (manifest.networkWrites !== 0) throw new Error(`Migration dry-run performed writes: ${manifest.networkWrites}`);
  if (!Array.isArray(manifest.properties) || manifest.properties.length < 1) throw new Error('Expected seeded local properties in migration manifest.');
  if (!manifest.counts || manifest.counts.properties !== manifest.properties.length) throw new Error('Migration manifest property counts are inconsistent.');

  await page.screenshot({ path: `${ARTIFACT_DIR}/remote-migration-readiness.png`, fullPage: true });
  console.log('Rendered remote migration readiness + dry-run manifest download QA: PASS');
} catch (error) {
  await page.screenshot({ path: `${ARTIFACT_DIR}/remote-migration-readiness-failure.png`, fullPage: true });
  console.error('Rendered remote migration readiness QA: FAIL');
  console.error(error);
  throw error;
} finally {
  await browser.close();
}
