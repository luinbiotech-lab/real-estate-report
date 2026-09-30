import { chromium } from 'playwright';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const SOURCE_URL = 'https://upload.wikimedia.org/wikipedia/commons/7/74/Little_White_House_floor_plan.svg';
function assert(condition, message) { if (!condition) throw new Error(message); }

const response = await fetch(SOURCE_URL);
assert(response.ok, `Failed to fetch source SVG: ${response.status}`);
const svgText = await response.text();

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
try {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const result = await page.evaluate(async (text) => {
    const geometryMod = await import('/src/services/floorPlanGeometryService.ts');
    const topologyMod = await import('/src/services/roomTopologyService.ts');
    const extrusionMod = await import('/src/services/extrusionGeometryService.ts');
    const file = new File([text], 'Little_White_House_floor_plan.svg', { type: 'image/svg+xml' });
    const base = {
      id: 'svg-topology-test', propertyId: 'qa-property', assetType: 'floor_plan', fileFormat: 'svg',
      storagePath: 'qa/svg', fileName: file.name, mimeType: file.type, fileData: file, version: 1,
      processingStatus: 'uploaded', metadata: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    const geometry = await geometryMod.floorPlanGeometryService.extract(base);
    const asset = { ...base, metadata: { geometry } };
    const candidates = topologyMod.roomTopologyService.buildCandidates(asset);
    const extrusion = extrusionMod.extrusionGeometryService.build(asset);
    return {
      candidateCount: candidates.length,
      largest: candidates.slice().sort((a,b)=>b.drawingArea-a.drawingArea).slice(0,10).map((item)=>({
        id:item.id, layer:item.layer, drawingArea:item.drawingArea, pointCount:item.points.length
      })),
      extrusionStatus: extrusion.status,
      extrusionReason: extrusion.reason,
    };
  }, svgText);

  assert(result.candidateCount > 0, 'SVG should produce closed room-boundary candidates');
  assert(result.extrusionStatus === 'blocked' && result.extrusionReason === 'scale_required', `Extrusion safety gate mismatch: ${JSON.stringify(result)}`);
  console.log('SVG room topology + extrusion gate: PASS');
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
