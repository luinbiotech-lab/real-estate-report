import { chromium } from 'playwright';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const SOURCE_URL = 'https://upload.wikimedia.org/wikipedia/commons/7/74/Little_White_House_floor_plan.svg';
const REAL_LENGTH_M = 54 * 0.3048;

function assert(condition, message) { if (!condition) throw new Error(message); }

const response = await fetch(SOURCE_URL);
assert(response.ok, `Failed to fetch source SVG: ${response.status}`);
const svgText = await response.text();

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
try {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const result = await page.evaluate(async ({ svgText, realLengthM }) => {
    const mod = await import('/src/services/floorPlanGeometryService.ts');
    const file = new File([svgText], 'Little_White_House_floor_plan.svg', { type: 'image/svg+xml' });
    const asset = {
      id: 'svg-calibration-candidate',
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
    const bounds = geometry.bounds;
    const segments = geometry.previewSegments.flatMap((segment, index) => {
      const points = segment.points;
      const out = [];
      for (let i = 0; i + 1 < points.length; i += 1) {
        const a = points[i], b = points[i + 1];
        const dx = b.x - a.x, dy = b.y - a.y;
        const length = Math.hypot(dx, dy);
        if (!length) continue;
        const horizontalRatio = Math.abs(dx) / length;
        const midY = (a.y + b.y) / 2;
        const midX = (a.x + b.x) / 2;
        out.push({ segmentIndex: index, edgeIndex: i, layer: segment.layer || '', a, b, length, horizontalRatio, midX, midY });
      }
      return out;
    });
    const minY = bounds?.minY ?? 0;
    const height = bounds?.height ?? 1;
    const topBand = minY + height * 0.42;
    const candidates = segments
      .filter((item) => item.horizontalRatio >= 0.985 && item.midY <= topBand)
      .sort((a, b) => b.length - a.length)
      .slice(0, 20)
      .map((item) => ({
        ...item,
        metersPerDrawingUnitCandidate: realLengthM / item.length,
        calibratedFullWidthM: bounds ? bounds.width * (realLengthM / item.length) : undefined,
        calibratedFullHeightM: bounds ? bounds.height * (realLengthM / item.length) : undefined,
      }));
    return { bounds, candidates };
  }, { svgText, realLengthM: REAL_LENGTH_M });

  assert(result.candidates.length > 0, 'No top horizontal calibration candidates found');
  console.log('SVG calibration candidate scan: PASS');
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
