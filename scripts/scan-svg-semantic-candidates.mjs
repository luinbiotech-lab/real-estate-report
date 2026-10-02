import { chromium } from 'playwright';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const SOURCE_URL = 'https://upload.wikimedia.org/wikipedia/commons/7/74/Little_White_House_floor_plan.svg';
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const response = await fetch(SOURCE_URL);
assert(response.ok, `Failed to fetch SVG: ${response.status}`);
const svgText = await response.text();

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
try {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const result = await page.evaluate(async (text) => {
    const mod = await import('/src/services/floorPlanGeometryService.ts');
    const file = new File([text], 'Little_White_House_floor_plan.svg', { type: 'image/svg+xml' });
    const now = new Date().toISOString();
    const asset = {
      id: 'svg-semantic-pilot',
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
      createdAt: now,
      updatedAt: now,
    };
    const geometry = await mod.floorPlanGeometryService.extract(asset);
    const counts = geometry.semanticLayerCandidates.reduce((acc, item) => {
      acc[item.semantic] = (acc[item.semantic] || 0) + 1;
      return acc;
    }, {});
    return {
      counts,
      layers: geometry.semanticLayerCandidates,
      elementCandidates: geometry.elementSemanticCandidates || [],
      elementCounts: (geometry.elementSemanticCandidates || []).reduce((acc, item) => {
        acc[item.semantic] = (acc[item.semantic] || 0) + 1;
        return acc;
      }, {}),
      previewSemanticCounts: geometry.previewSegments.reduce((acc, item) => {
        acc[item.semantic] = (acc[item.semantic] || 0) + 1;
        return acc;
      }, {}),
    };
  }, svgText);

  assert(result.elementCandidates.every((item) => item.requiresReview === true), 'Geometry semantic candidates must require Human Review');
  assert(result.elementCandidates.every((item) => item.confidence < 0.5), 'Geometry semantic candidates must remain low confidence');
  console.log('SVG semantic candidate pilot: PASS');
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
