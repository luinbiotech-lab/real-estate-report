import { chromium } from 'playwright';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

try {
  await page.goto(`${BASE_URL}/spatial`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Spatial Workspace' }).waitFor({ timeout: 30_000 });
  const spatialText = await page.locator('main').innerText();
  assert(spatialText.includes('공간 자료 Intake'), 'Spatial intake section missing');
  assert(spatialText.includes('공간 모델'), 'Spatial model section missing');
  assert(spatialText.includes('리노베이션 검토'), 'Renovation assessment section missing');
  assert(spatialText.includes('Digital Twin 준비 자산'), 'Digital Twin asset section missing');

  await page.goto(`${BASE_URL}/agents`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Agent Operations' }).waitFor({ timeout: 30_000 });
  const agentText = await page.locator('main').innerText();
  assert(agentText.includes('Human Review Gate'), 'Human Review Gate missing');
  assert(agentText.includes('Interior Vision Agent'), 'Interior Vision Agent control missing');
  assert(agentText.includes('Floor Plan Agent'), 'Floor Plan Agent control missing');
  assert(agentText.includes('Space Agent'), 'Space Agent control missing');
  assert(agentText.includes('Renovation Agent'), 'Renovation Agent control missing');
  assert(agentText.includes('Risk / Compliance Agent'), 'Risk / Compliance Agent control missing');

  await page.goto(`${BASE_URL}/risk`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Risk / Compliance Workspace' }).waitFor({ timeout: 30_000 });
  const riskText = await page.locator('main').innerText();
  assert(riskText.includes('사전 점검 실행'), 'Risk pre-check action missing');
  assert(riskText.includes('확정 판단'), 'Risk expert-review disclaimer missing');

  console.log('Rendered Agent + Spatial + Risk smoke QA: PASS');
} finally {
  await browser.close();
}
