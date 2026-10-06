import { chromium } from 'playwright';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const SOURCE_URL = 'https://upload.wikimedia.org/wikipedia/commons/7/74/Little_White_House_floor_plan.svg';
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const response = await fetch(SOURCE_URL);
assert(response.ok, `Failed to fetch SVG: ${response.status}`);
const svgText = await response.text();
const syntheticWindowSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120"><rect x="10" y="10" width="140" height="10"/><rect x="20" y="50" width="60" height="20"/><path d="M100 90 C120 60 150 60 170 80"/></svg>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
try {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const result = await page.evaluate(async ({ svgText, syntheticWindowSvg }) => {
    const mod = await import('/src/services/floorPlanGeometryService.ts');
    const makeAsset = (text, id) => {
      const file = new File([text], `${id}.svg`, { type: 'image/svg+xml' });
      const now = new Date().toISOString();
      return {
        id,
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
    };
    const geometry = await mod.floorPlanGeometryService.extract(makeAsset(svgText, 'svg-semantic-pilot'));
    const synthetic = await mod.floorPlanGeometryService.extract(makeAsset(syntheticWindowSvg, 'svg-window-synthetic'));
    const summarize = (items) => items.reduce((acc, item) => {
      acc[item.semantic] = (acc[item.semantic] || 0) + 1;
      return acc;
    }, {});
    return {
      counts: summarize(geometry.semanticLayerCandidates),
      layers: geometry.semanticLayerCandidates,
      elementCandidates: geometry.elementSemanticCandidates || [],
      elementCounts: summarize(geometry.elementSemanticCandidates || []),
      syntheticElementCandidates: synthetic.elementSemanticCandidates || [],
      syntheticElementCounts: summarize(synthetic.elementSemanticCandidates || []),
      previewSemanticCounts: geometry.previewSegments.reduce((acc, item) => {
        acc[item.semantic] = (acc[item.semantic] || 0) + 1;
        return acc;
      }, {}),
    };
  }, { svgText, syntheticWindowSvg });

  assert(result.elementCandidates.every((item) => item.requiresReview === true), 'Geometry semantic candidates must require Human Review');
  assert(result.elementCandidates.every((item) => item.confidence < 0.5), 'Geometry semantic candidates must remain low confidence');
  assert(result.syntheticElementCounts.wall >= 1, 'Synthetic SVG should produce a low-confidence wall candidate');
  assert(result.syntheticElementCounts.window >= 1, 'Synthetic SVG should produce a low-confidence window candidate');
  assert(result.syntheticElementCounts.door >= 1, 'Synthetic SVG should produce a low-confidence door candidate');
  assert(result.syntheticElementCandidates.every((item) => item.requiresReview === true), 'Synthetic SVG semantic candidates must require Human Review');
  console.log('SVG semantic candidate pilot: PASS');
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}