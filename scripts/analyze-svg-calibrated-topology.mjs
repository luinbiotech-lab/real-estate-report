import { chromium } from 'playwright';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const SOURCE_URL = 'https://upload.wikimedia.org/wikipedia/commons/7/74/Little_White_House_floor_plan.svg';
const REAL_LENGTH_M = 54 * 0.3048;
const SUN_DECK_DRAWING_WIDTH = 258.138;
const SCALE = REAL_LENGTH_M / SUN_DECK_DRAWING_WIDTH;

function assert(condition, message) { if (!condition) throw new Error(message); }

const response = await fetch(SOURCE_URL);
assert(response.ok, `Failed to fetch source SVG: ${response.status}`);
const svgText = await response.text();

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
try {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const result = await page.evaluate(async ({ svgText, scale, realLengthM, drawingWidth }) => {
    const geometryMod = await import('/src/services/floorPlanGeometryService.ts');
    const topologyMod = await import('/src/services/roomTopologyService.ts');
    const file = new File([svgText], 'Little_White_House_floor_plan.svg', { type: 'image/svg+xml' });
    const base = {
      id:'svg-calibrated-topology', propertyId:'qa-property', assetType:'floor_plan', fileFormat:'svg',
      storagePath:'qa/svg', fileName:file.name, mimeType:file.type, fileData:file, floor:'1F', version:1,
      processingStatus:'processing', metadata:{}, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(),
    };
    const geometry = await geometryMod.floorPlanGeometryService.extract(base);
    const asset = {
      ...base,
      metadata:{
        geometry,
        scaleCalibration:{
          status:'verified', method:'known_distance', drawingLength:drawingWidth, realLengthM,
          metersPerDrawingUnit:scale, referenceLabel:'Sun Deck 54 ft candidate', note:'QA candidate only',
          verifiedAt:new Date().toISOString(),
        },
      },
    };
    const candidates = topologyMod.roomTopologyService.buildCandidates(asset)
      .map((item)=>({
        id:item.id, layer:item.layer, drawingArea:item.drawingArea,
        areaSqmCandidate:item.areaSqmCandidate, perimeterMCandidate:item.perimeterMCandidate,
        pointCount:item.points.length,
      }))
      .sort((a,b)=>(b.areaSqmCandidate||0)-(a.areaSqmCandidate||0));
    const plausible = candidates.filter((item)=>{
      const area=item.areaSqmCandidate||0;
      return area >= 2 && area <= 80;
    });
    return {
      scale,
      geometryBounds: geometry.bounds,
      allCandidateCount:candidates.length,
      plausibleCount:plausible.length,
      largest:candidates.slice(0,15),
      plausible:plausible.slice(0,30),
    };
  }, { svgText, scale:SCALE, realLengthM:REAL_LENGTH_M, drawingWidth:SUN_DECK_DRAWING_WIDTH });

  assert(result.allCandidateCount > 0, 'No room candidates after SVG filtering');
  assert(result.plausibleCount > 0, 'No plausible room candidates after calibration');
  console.log('SVG calibrated topology analysis: PASS');
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
