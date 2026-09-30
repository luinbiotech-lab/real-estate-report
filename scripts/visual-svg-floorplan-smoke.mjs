import { chromium } from 'playwright';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const SOURCE_URL = 'https://upload.wikimedia.org/wikipedia/commons/7/74/Little_White_House_floor_plan.svg';

function assert(condition, message) { if (!condition) throw new Error(message); }

const response = await fetch(SOURCE_URL);
assert(response.ok, `Failed to fetch public-domain SVG: ${response.status}`);
const svgText = await response.text();
assert(svgText.includes('<svg'), 'Fetched source is not SVG');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

try {
  await page.goto(`${BASE_URL}/digital-twin-intake`, { waitUntil: 'networkidle' });
  const input = page.locator('input[type="file"]');
  await input.setInputFiles({
    name: 'Little_White_House_floor_plan.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(svgText),
  });
  await page.waitForFunction(() => document.body.innerText.includes('등록 완료'), undefined, { timeout: 30000 });

  const extraction = await page.evaluate(async (text) => {
    const mod = await import('/src/services/floorPlanGeometryService.ts');
    const file = new File([text], 'Little_White_House_floor_plan.svg', { type: 'image/svg+xml' });
    const asset = {
      id: 'svg-public-domain-test',
      propertyId: 'qa-property',
      assetType: 'floor_plan',
      fileFormat: 'svg',
      storagePath: 'qa/svg',
      fileName: file.name,
      mimeType: file.type,
      fileData: file,
      version: 1,
      processingStatus: 'uploaded',
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const geometry = await mod.floorPlanGeometryService.extract(asset);
    return {
      parser: geometry.parser,
      lineCount: geometry.lineCount,
      polylineCount: geometry.polylineCount,
      textCount: geometry.textCount,
      segmentCount: geometry.previewSegments.length,
      bounds: geometry.bounds,
      labels: geometry.labelCandidates,
      unitStatus: geometry.unitStatus,
    };
  }, svgText);

  assert(extraction.parser === 'svg_floorplan_v1', `Unexpected parser: ${extraction.parser}`);
  assert(extraction.segmentCount > 10, `Too few SVG geometry segments: ${extraction.segmentCount}`);
  assert((extraction.bounds?.width || 0) > 0 && (extraction.bounds?.height || 0) > 0, 'SVG bounds were not extracted');
  assert(extraction.unitStatus === 'drawing_units_unverified', `Scale safety status mismatch: ${extraction.unitStatus}`);

  console.log('Public-domain SVG floor plan intake: PASS');
  console.log(JSON.stringify(extraction, null, 2));
} finally {
  await browser.close();
}
