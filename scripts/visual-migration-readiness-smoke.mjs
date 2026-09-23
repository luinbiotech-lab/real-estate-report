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

async function uploadBangbaeSourceDocuments(page) {
  await page.goto(`${BASE_URL}/property/daon-bangbae-815-11/data-room?tab=official`, { waitUntil: 'domcontentloaded' });
  await waitForText(page, '공적자료 및 데이터 출처');
  const uploads = [
    ['방배동 815-11 건축물대장', '방배동 815-11 건축물대장.pdf'],
    ['방배동 815-11 토지등기부', '방배동 815-11 토지등기부.pdf'],
    ['방배동 815-11 건물등기부', '방배동 815-11 건물등기부.pdf'],
    ['방배동 815-11 토지이용계획확인서', '방배동 815-11 토지이용계획확인서.pdf'],
  ];
  for (const [sourceName, fileName] of uploads) {
    const sourceCard = page.locator('article').filter({ hasText: sourceName }).filter({ hasText: 'Storage 미연결' }).last();
    await sourceCard.waitFor({ state: 'visible', timeout: 30_000 });
    const input = sourceCard.locator('input[type="file"]');
    await input.waitFor({ state: 'attached', timeout: 30_000 });
    await input.setInputFiles({
      name: fileName,
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n% DAON migration QA source document\n%%EOF\n', 'utf8'),
    });
    await sourceCard.getByText('이관 파일 준비', { exact: true }).waitFor({ state: 'visible', timeout: 30_000 });
  }
  const readyCount = await page.getByText('이관 파일 준비', { exact: true }).count();
  if (readyCount < 4) throw new Error(`Expected 4 migration-ready source documents, got ${readyCount}.`);
}

async function verifyBangbaeSourceReadinessAfterReload(page) {
  await page.goto(`${BASE_URL}/property/daon-bangbae-815-11/data-room?tab=official`, { waitUntil: 'domcontentloaded' });
  await waitForText(page, '공적자료 및 데이터 출처');
  const readyCount = await page.getByText('이관 파일 준비', { exact: true }).count();
  if (readyCount < 4) throw new Error(`Bangbae source readiness was downgraded after app reload: expected 4 ready documents, got ${readyCount}.`);
  const promotedCard = page.locator('article').filter({ hasText: '방배동 815-11 토지이용계획확인서' }).filter({ hasText: 'Storage 미연결' }).last();
  await promotedCard.getByText('원본 확인', { exact: true }).waitFor({ state: 'visible', timeout: 30_000 });
}

async function uploadBangbaeExteriorMedia(page) {
  await page.goto(`${BASE_URL}/property/daon-bangbae-815-11/data-room?tab=media`, { waitUntil: 'domcontentloaded' });
  await waitForText(page, '보고서 미디어 연결');
  await page.getByLabel('캡션').fill('QA 방배동 코너 외관');
  const input = page.locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  await input.setInputFiles({ name: 'bangbae-815-11-exterior.png', mimeType: 'image/png', buffer: png });
  await waitForText(page, 'QA 방배동 코너 외관');
  const mediaCard = page.locator('article').filter({ hasText: 'QA 방배동 코너 외관' }).last();
  await mediaCard.getByRole('button', { name: '대표 지정', exact: true }).click();
  await waitForText(page, '대표 지정됨');
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
  for (const text of ['Migration Readiness Review', 'REMOTE MIGRATION · CONTROLLED RELEASE', 'DRY-RUN NETWORK WRITES = 0', '이관 대상 물건', 'Dry-Run 실행']) await waitForText(page, text);

  await writeQaRows(page);
  await page.getByLabel('이관 대상 물건').click();
  await page.getByRole('option', { name: /방배동 815-11 코너빌딩/ }).click();
  await page.getByRole('button', { name: 'Dry-Run 실행' }).click();
  for (const text of ['MIGRATION GATE', 'BLOCKER REVIEW', 'STORAGE PLAN', 'REHEARSAL CHECKLIST', 'networkWrites=0', 'INLINE_BINARY']) await waitForText(page, text);

  const manifestDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Manifest JSON 다운로드' }).click();
  const manifestDownload = await manifestDownloadPromise;
  await manifestDownload.saveAs(MANIFEST_PATH);
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));

  if (manifest.schemaVersion !== 'daon-remote-migration-plan-v1') throw new Error(`Unexpected migration schema: ${manifest.schemaVersion}`);
  if (manifest.dryRun !== true) throw new Error('Migration manifest must remain dryRun=true.');
  if (manifest.networkWrites !== 0) throw new Error(`Migration dry-run performed writes: ${manifest.networkWrites}`);
  if (!Array.isArray(manifest.properties) || manifest.properties.length !== 1 || manifest.properties[0]?.id !== 'daon-bangbae-815-11') throw new Error('Property-scoped migration manifest must contain only Bangbae 815-11.');
  if (!manifest.counts || manifest.counts.properties !== manifest.properties.length) throw new Error('Migration manifest property counts are inconsistent.');
  if (manifest.companySettings !== undefined) throw new Error('Property-scoped migration must not include global company settings by default.');
  if (manifest.properties.some((row) => row?.id === QA_INLINE_PROPERTY_ID)) throw new Error('Out-of-scope QA Property must be excluded from the property-scoped migration manifest.');
  if (manifest.objects.some((row) => row?.id === QA_INLINE_BINARY_ID)) throw new Error('Structured Blob object must be excluded from migration writes.');
  const blockerCodes = new Set((manifest.blockers ?? []).map((row) => row?.code));
  if (blockerCodes.has('INLINE_DATA_URL')) throw new Error('Out-of-scope inline Property blocker must not leak into a property-scoped plan.');
  if (!blockerCodes.has('INLINE_BINARY')) throw new Error('Expected in-scope structured binary blocker was not produced.');
  if (!blockerCodes.has('SOURCE_DOCUMENT_BINARY_NOT_CONNECTED')) throw new Error('Expected Bangbae source-document binary blocker was not produced.');
  const sourceBinaryBlockers = (manifest.blockers ?? []).filter((row) => row?.code === 'SOURCE_DOCUMENT_BINARY_NOT_CONNECTED');
  if (sourceBinaryBlockers.length < 3) throw new Error(`Expected at least 3 Bangbae source-document blockers, got ${sourceBinaryBlockers.length}.`);
  if (manifest.readyForRemoteWrite !== false) throw new Error('Manifest with inline/source-document blockers cannot be ready for remote write.');

  await uploadBangbaeSourceDocuments(page);
  await uploadBangbaeExteriorMedia(page);
  await verifyBangbaeSourceReadinessAfterReload(page);
  await page.goto(`${BASE_URL}/migration-readiness`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('이관 대상 물건').click();
  await page.getByRole('option', { name: /방배동 815-11 코너빌딩/ }).click();
  await page.getByRole('button', { name: 'Dry-Run 실행' }).click();
  await waitForText(page, 'INLINE_BINARY');

  const preparedManifestDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Manifest JSON 다운로드' }).click();
  const preparedManifestDownload = await preparedManifestDownloadPromise;
  await preparedManifestDownload.saveAs(MANIFEST_PATH);
  const preparedManifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  const preparedBlockerCodes = new Set((preparedManifest.blockers ?? []).map((row) => row?.code));
  if (preparedBlockerCodes.has('SOURCE_DOCUMENT_BINARY_NOT_CONNECTED')) throw new Error('Source-document blocker remained after all 3 PDFs were prepared.');
  if (!preparedBlockerCodes.has('INLINE_BINARY')) throw new Error('Independent INLINE_BINARY safety blocker must remain after source PDFs are prepared.');
  if (preparedBlockerCodes.has('INLINE_DATA_URL')) throw new Error('Blob-backed exterior media preview data URL must not block migration.');
  const exteriorMediaUploads = (preparedManifest.assetUploads ?? []).filter((asset) =>
    asset?.resourceType === 'media' &&
    asset?.propertyId === 'daon-bangbae-815-11' &&
    asset?.fileName === 'bangbae-815-11-exterior.png'
  );
  if (exteriorMediaUploads.length !== 1 || exteriorMediaUploads[0]?.binarySource !== 'blob') {
    throw new Error('Bangbae exterior media was not mapped to a Blob-backed Storage upload.');
  }
  const sourceDocumentUploads = (preparedManifest.assetUploads ?? []).filter((asset) =>
    asset?.resourceType === 'document' &&
    asset?.propertyId === 'daon-bangbae-815-11' &&
    ['방배동 815-11 건축물대장.pdf', '방배동 815-11 토지등기부.pdf', '방배동 815-11 건물등기부.pdf', '방배동 815-11 토지이용계획확인서.pdf'].includes(asset?.fileName)
  );
  if (sourceDocumentUploads.length !== 4 || sourceDocumentUploads.some((asset) => asset.binarySource !== 'blob')) {
    throw new Error('Prepared Bangbae source documents were not mapped to 4 local-binary Storage uploads.');
  }
  if (preparedManifest.readyForRemoteWrite !== false) throw new Error('Independent inline-binary blocker must keep prepared manifest blocked.');

  const handoffDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Handoff Bundle 다운로드' }).click();
  const handoffDownload = await handoffDownloadPromise;
  await handoffDownload.saveAs(HANDOFF_PATH);
  const handoff = JSON.parse(await readFile(HANDOFF_PATH, 'utf8'));

  if (handoff.schemaVersion !== 'daon-remote-migration-handoff-v1') throw new Error(`Unexpected handoff schema: ${handoff.schemaVersion}`);
  if (handoff.safety?.dryRunOnly !== true || handoff.safety?.networkWritesPerformed !== 0) throw new Error('Handoff safety boundary is invalid.');
  if (handoff.safety?.remoteExecutionEnabled !== false || handoff.safety?.secretsIncluded !== false || handoff.safety?.binaryPayloadsIncluded !== false) throw new Error('Handoff must exclude remote execution, secrets, and binary payloads.');
  if (handoff.readiness?.productionReady !== false || handoff.readiness?.localPlanReady !== false) throw new Error('Blocked handoff cannot be marked locally or production ready.');
  if (handoff.readiness?.blockerCount !== preparedManifest.blockers.length) throw new Error('Handoff blocker count must reconcile with prepared manifest.');
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
