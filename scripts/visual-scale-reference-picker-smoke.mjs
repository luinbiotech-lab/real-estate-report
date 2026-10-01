import { chromium } from 'playwright';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
function assert(condition, message) { if (!condition) throw new Error(message); }

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

try {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('real-estate-report', 13);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const now = new Date().toISOString();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(['properties', 'digitalTwinAssets'], 'readwrite');
        tx.objectStore('properties').put({
          id:'qa-scale-picker-property', propertyNumber:'QA-SCALE-001', name:'축척 선택 QA', buildingName:'', tradeType:'매매',
          salePrice:0, deposit:0, monthlyRent:0, negotiable:false, occupancyStatus:'', address:'QA', detailAddress:'',
          nearbyStation:'', stationDistance:'', roadCondition:'', landAreaPyeong:0, landAreaSqm:0, totalFloorAreaPyeong:0,
          totalFloorAreaSqm:0, buildingAreaPyeong:0, zoning:'', mainUse:'', structure:'', basementFloors:0, groundFloors:1,
          completionDate:'', buildingCoverageRate:0, floorAreaRatio:0, elevator:'', parkingSpaces:0, features:'',
          investmentPoints:'', locationAnalysis:'', developmentPlan:'', recommendedUse:'', risks:'', overallOpinion:'',
          nearbyTransactions:'', managerName:'', managerPhone:'', managerEmail:'', companyName:'DA:ON ASSET',
          mainImage:'', additionalImages:[], mapImage:'', locationAnalysisImage:'', briefingItems:[], briefingUpdatedAt:'',
          createdAt:now, updatedAt:now,
        });
        tx.objectStore('digitalTwinAssets').put({
          id:'qa-scale-picker-asset', propertyId:'qa-scale-picker-property', assetType:'floor_plan', fileFormat:'svg',
          storagePath:'qa/scale.svg', fileName:'scale.svg', mimeType:'image/svg+xml', floor:'1F', version:1,
          processingStatus:'processing',
          metadata:{
            geometryStatus:'extracted_candidate',
            geometry:{
              parser:'svg_floorplan_v1', sourceAssetId:'qa-scale-picker-asset', lineCount:0, polylineCount:1, textCount:0,
              layers:['qa'], bounds:{minX:0,minY:0,maxX:100,maxY:100,width:100,height:100}, labelCandidates:[],
              semanticLayerCandidates:[], unitStatus:'drawing_units_unverified', warnings:[],
              previewSegments:[{kind:'polyline',layer:'qa',semantic:'unknown',points:[{x:0,y:50},{x:100,y:50},{x:100,y:100},{x:0,y:100},{x:0,y:50}]}],
            }
          }, createdAt:now, updatedAt:now,
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  });

  await page.goto(`${BASE_URL}/digital-twin`, { waitUntil: 'networkidle' });
  const select = page.getByLabel('대상 물건');
  await select.click();
  await page.getByRole('option', { name: /축척 선택 QA/ }).click();
  await page.waitForSelector('svg[aria-label="축척 기준선 선택 도면"]', { timeout: 30000 });
  const svg = page.locator('svg[aria-label="축척 기준선 선택 도면"]');
  const box = await svg.boundingBox();
  assert(box, 'Scale picker SVG box missing');
  await svg.click({ position: { x: box.width * 0.2, y: box.height * 0.5 } });
  await page.getByText('끝점을 선택하면 도면상 길이가 자동 계산됩니다.').waitFor({ timeout: 5000 });
  await svg.click({ position: { x: box.width * 0.8, y: box.height * 0.5 } });
  await page.getByText(/선택 완료 · 도면상 길이/).waitFor({ timeout: 5000 });
  const drawing = page.getByLabel('도면상 기준 길이');
  await page.waitForTimeout(100);
  const value = await drawing.inputValue();
  assert(Number(value) > 50 && Number(value) < 70, `Unexpected auto drawing length: ${value}`);
  await page.getByLabel('실제 기준 길이(m)').fill('16.4592');
  await page.getByLabel('기준 근거').fill('Sun Deck 표기 54 ft');
  const save = page.getByRole('button', { name: '확인한 축척 저장' });
  assert(await save.isEnabled(), 'Save should be enabled after two-point pick + real length');
  console.log('Two-point scale reference picker QA: PASS');
  console.log(JSON.stringify({ drawingLength: value, realLengthM: 16.4592 }, null, 2));
} finally {
  await browser.close();
}
