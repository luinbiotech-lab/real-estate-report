import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const ARTIFACT_DIR = 'artifacts/agent-qa';
const BACKUP_PATH = '/tmp/daon-backup-qa.json';
const QA_MEDIA_ID = 'qa-backup-binary-media';

async function waitForText(page, text, timeout = 30_000) {
  await page.waitForFunction((expected) => document.body?.innerText.toLowerCase().includes(String(expected).toLowerCase()), text, { timeout });
}

await mkdir(ARTIFACT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });

try {
  await page.goto(`${BASE_URL}/backup`, { waitUntil: 'domcontentloaded' });
  for (const text of ['Data Backup Center', '전체 백업 다운로드', 'BACKUP SCOPE', 'RESTORE PREVIEW', 'RESTORE MODE', '병합 복원', '전체 교체 복원', '복원 전 현재 백업', 'Blob/ArrayBuffer 원본도 Base64로 포함합니다.', '현재 단계는 local-first입니다.']) await waitForText(page, text);

  await page.evaluate(async ({ mediaId }) => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('real-estate-report');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('propertyMedia', 'readwrite');
        tx.objectStore('propertyMedia').put({
          id: mediaId,
          propertyId: 'daon-bangbae-815-11',
          category: 'exterior',
          fileName: 'qa-backup-binary.txt',
          mimeType: 'text/plain',
          fileData: new Blob(['qa-backup-binary'], { type: 'text/plain' }),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    });
  }, { mediaId: QA_MEDIA_ID });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '전체 백업 다운로드' }).click();
  const download = await downloadPromise;
  await download.saveAs(BACKUP_PATH);

  const backup = JSON.parse(await readFile(BACKUP_PATH, 'utf8'));
  if (backup.schemaVersion !== 'daon-local-backup-v1') throw new Error(`Unexpected backup schema: ${backup.schemaVersion}`);
  const mediaRows = backup.stores?.propertyMedia;
  if (!Array.isArray(mediaRows)) throw new Error('propertyMedia store missing from backup.');
  const qaRow = mediaRows.find((row) => row?.value?.id === QA_MEDIA_ID);
  if (!qaRow) throw new Error('QA binary media row missing from backup.');
  if (qaRow.value?.fileData?.__daonBinary !== 'blob' || typeof qaRow.value?.fileData?.base64 !== 'string') throw new Error('Blob was not serialized into DA:ON binary payload.');

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(BACKUP_PATH);
  await waitForText(page, 'daon-local-backup-v1');
  await waitForText(page, 'propertyMedia');
  await page.getByRole('button', { name: '병합 복원' }).click();
  await waitForText(page, '병합 복원을 완료했습니다.');

  const restoredText = await page.evaluate(async ({ mediaId }) => new Promise((resolve, reject) => {
    const request = indexedDB.open('real-estate-report');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('propertyMedia', 'readonly');
      const getRequest = tx.objectStore('propertyMedia').get(mediaId);
      getRequest.onerror = () => { db.close(); reject(getRequest.error); };
      getRequest.onsuccess = async () => {
        const blob = getRequest.result?.fileData;
        if (!(blob instanceof Blob)) { db.close(); reject(new Error('Restored fileData is not a Blob.')); return; }
        const text = await blob.text();
        db.close(); resolve(text);
      };
    };
  }), { mediaId: QA_MEDIA_ID });
  if (restoredText !== 'qa-backup-binary') throw new Error(`Restored Blob content mismatch: ${restoredText}`);

  await page.screenshot({ path: `${ARTIFACT_DIR}/data-backup-center.png`, fullPage: true });

  await page.evaluate(async ({ mediaId }) => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('real-estate-report');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('propertyMedia', 'readwrite');
        tx.objectStore('propertyMedia').delete(mediaId);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    });
  }, { mediaId: QA_MEDIA_ID });

  console.log('Rendered local data backup + download + preview + merge restore + Blob round-trip QA: PASS');
} catch (error) {
  await page.screenshot({ path: `${ARTIFACT_DIR}/data-backup-center-failure.png`, fullPage: true });
  console.error('Rendered local data backup round-trip QA: FAIL');
  console.error(error);
  throw error;
} finally {
  await browser.close();
}
