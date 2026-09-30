import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const ARTIFACT_DIR = 'artifacts/preflight-qa';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await mkdir(ARTIFACT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

try {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('real-estate-report', 13);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const now = new Date().toISOString();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('properties', 'readwrite');
        const store = tx.objectStore('properties');
        for (let index = 0; index < 250; index += 1) {
          store.put({
            id: `qa-bulk-list-${String(index + 1).padStart(4, '0')}`,
            propertyNumber: `QA-LIST-${String(index + 1).padStart(4, '0')}`,
            name: `대량등록 목록 QA 물건 ${index + 1}`,
            buildingName: `QA 빌딩 ${index + 1}`,
            tradeType: '매매',
            salePrice: 1000000000 + index * 1000000,
            deposit: 0,
            monthlyRent: 0,
            negotiable: false,
            occupancyStatus: '',
            address: `서울특별시 테스트구 대량로 ${index + 1}`,
            detailAddress: '',
            nearbyStation: '',
            stationDistance: '',
            roadCondition: '',
            landAreaPyeong: 50 + (index % 20),
            landAreaSqm: (50 + (index % 20)) * 3.3058,
            totalFloorAreaPyeong: 120,
            totalFloorAreaSqm: 396.696,
            buildingAreaPyeong: 35,
            zoning: '',
            mainUse: '',
            structure: '',
            basementFloors: 1,
            groundFloors: 4,
            completionDate: '',
            buildingCoverageRate: 0,
            floorAreaRatio: 0,
            elevator: '',
            parkingSpaces: 0,
            parkingFieldNote: '',
            features: '',
            investmentPoints: '',
            locationAnalysis: '',
            developmentPlan: '',
            recommendedUse: '',
            risks: '',
            overallOpinion: '',
            nearbyTransactions: '',
            managerName: 'QA 담당자',
            managerPhone: '',
            managerEmail: '',
            companyName: 'DA:ON ASSET',
            mainImage: '',
            additionalImages: [],
            mapImage: '',
            locationAnalysisImage: '',
            briefingItems: [],
            briefingUpdatedAt: '',
            createdAt: now,
            updatedAt: new Date(Date.now() - index * 1000).toISOString(),
          });
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  });

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.body.innerText.includes('대량등록 목록 QA 물건 1'), undefined, { timeout: 30_000 });

  const result = await page.evaluate(() => {
    const summary = [...document.querySelectorAll('.property-list-summary > div')].map((item) => item.textContent?.replace(/\s+/g, '') || '');
    const rows = document.querySelectorAll('.property-focus-table tbody tr').length;
    const pagination = document.querySelector('.property-list-pagination .MuiPagination-root')?.textContent || '';
    const range = document.querySelector('.property-list-pagination > span')?.textContent || '';
    return {
      summary,
      rows,
      pagination,
      range,
      bodyScrollWidth: document.body.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    };
  });

  const totalSummary = result.summary.find((value) => value.startsWith('전체')) || '';
  const totalCount = Number(totalSummary.replace(/\D/g, ''));
  assert(totalCount >= 250, `Property total summary should include at least 250 QA rows: ${result.summary.join(',')}`);
  assert(result.rows === 25, `Property list page size expected 25, got ${result.rows}`);
  assert(result.pagination.includes(String(Math.ceil(totalCount / 25))), `Property pagination page count mismatch: ${result.pagination}`);
  assert(result.range.includes('1') && result.range.includes('25') && result.range.includes(String(totalCount)), `Property pagination range mismatch: ${result.range}`);
  assert(result.bodyScrollWidth <= result.viewportWidth + 2, `Page-level horizontal overflow: ${result.bodyScrollWidth}/${result.viewportWidth}`);

  await page.screenshot({ path: `${ARTIFACT_DIR}/property-list-250.png`, fullPage: true });
  console.log('Rendered property list 250-row QA: PASS');
} finally {
  await browser.close();
}
