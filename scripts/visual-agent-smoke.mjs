import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const ARTIFACT_DIR = 'artifacts/agent-qa';

async function waitForText(page, text, timeout = 30_000) {
  await page.waitForFunction((expected) => document.body?.innerText.includes(expected), text, { timeout });
}

async function verifyPage(page, path, requiredTexts, screenshotName) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
  for (const text of requiredTexts) await waitForText(page, text);
  await page.screenshot({ path: `${ARTIFACT_DIR}/${screenshotName}.png`, fullPage: true });
  console.log(`[PASS] ${path}: ${requiredTexts.join(' | ')}`);
}

await mkdir(ARTIFACT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

try {
  await verifyPage(page, '/spatial', [
    'Spatial Workspace',
    '공간 자료 Intake',
    '공간 모델',
    '리노베이션 검토',
    'Digital Twin 준비 자산',
  ], 'spatial-workspace');

  await verifyPage(page, '/agents', [
    'Agent Operations',
    'Human Review Gate',
    'Interior Vision Agent',
    'Floor Plan Agent',
    'Space Agent',
    'Renovation Agent',
    'Risk / Compliance Agent',
  ], 'agent-operations');

  await verifyPage(page, '/risk', [
    'Risk / Compliance Workspace',
    '사전 점검 실행',
    '확정 판단',
  ], 'risk-workspace');

  console.log('Rendered Agent + Spatial + Risk smoke QA: PASS');
} catch (error) {
  await page.screenshot({ path: `${ARTIFACT_DIR}/failure.png`, fullPage: true });
  console.error('Rendered Agent + Spatial + Risk smoke QA: FAIL');
  console.error(error);
  throw error;
} finally {
  await browser.close();
}
