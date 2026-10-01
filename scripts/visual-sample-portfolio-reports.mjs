import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const OUT_DIR = 'artifacts/sample-portfolio-report-qa';

function assert(condition, message) { if (!condition) throw new Error(message); }

const ts = '2026-10-01T14:21:00.000Z';
const base = (o) => ({
  deposit: 0, monthlyRent: 0, negotiable: true, detailAddress: '', nearbyStation: '', stationDistance: '', roadCondition: '',
  landAreaSqm: 0, totalFloorAreaSqm: 0, buildingAreaPyeong: 0, structure: '', buildingCoverageRate: 0, floorAreaRatio: 0,
  elevator: '', parkingSpaces: 0, features: '', investmentPoints: '', locationAnalysis: '', developmentPlan: '', recommendedUse: '',
  risks: '', overallOpinion: '', nearbyTransactions: '', managerName: '', managerPhone: '', managerEmail: '', companyName: 'DA:ON ASSET',
  mainImage: '', additionalImages: [], mapImage: '', locationAnalysisImage: '', briefingItems: [], briefingUpdatedAt: '',
  createdAt: ts, updatedAt: ts, ...o,
});
const properties = [
  base({ id:'sample-bangbae-815-11', propertyNumber:'SAMPLE-BB-815-11', name:'방배동 815-11', buildingName:'방배동 815-11 코너빌딩', tradeType:'매매', salePrice:4150000000, occupancyStatus:'소유자 사옥·주택 / 잔금일 기준 전체 명도 협의', address:'서울 서초구 동광로18길 7', landAreaPyeong:50.85, landAreaSqm:168.1, totalFloorAreaPyeong:105.60, totalFloorAreaSqm:349.08, buildingAreaPyeong:24.80, zoning:'제2종일반주거지역(7층 이하)', mainUse:'주택 및 근린생활시설', basementFloors:1, groundFloors:3, completionDate:'1978-07-31', buildingCoverageRate:48.8, floorAreaRatio:146.3, parkingField:2, parkingFieldNote:'현장 이용 기준 2대 · 공식 주차대수와 구분', features:'지하 방음시설 음악·취미·모임 공간 활용', risks:'내부사진 비공개 정책. 미확인 공적자료·Storage binary는 확인 후 승격.', nearbyTransactions:'비교거래 6건 provenance 연결 이력 있음', internalPhotoAllowed:false }),
  base({ id:'sample-seongsu-euptus-328-6', propertyNumber:'SAMPLE-SS-EUPTUS-328-6', name:'엎투스 빌딩', buildingName:'엎투스 빌딩', tradeType:'매매', salePrice:15000000000, deposit:440000000, monthlyRent:32000000, occupancyStatus:'4·5·6층 공실 / 즉시 임대 가능', address:'서울 성동구 성수동2가 328-6', landAreaPyeong:54.15, totalFloorAreaPyeong:244.94, zoning:'준공업지역', mainUse:'', basementFloors:1, groundFloors:8, completionDate:'2021-07-16', elevator:'1대', parkingSpaces:7, features:'과거 임대이력: 보증금 1억 5,000만원 / 월 1,230만원', investmentPoints:'공실층 임대 재구성이 수익률 개선의 핵심', risks:'등기부·건축물대장·임대차계약서·층별 도면 원문 검증 필요' }),
  base({ id:'sample-seongsu-corner19-314-19', propertyNumber:'SAMPLE-SS-CORNER19-314-19', name:'코너19', buildingName:'코너19', tradeType:'매매', salePrice:40000000000, deposit:949200000, monthlyRent:107570000, occupancyStatus:'제공자료 기준 전 층 임대 완료 / 7층 자회사·자가 사용', address:'서울 성동구 성수동2가 314-19', landAreaPyeong:126.6, totalFloorAreaPyeong:680.49, zoning:'준공업지역', mainUse:'', basementFloors:3, groundFloors:8, completionDate:'2021-11-02', elevator:'1대', parkingSpaces:16, features:'옥외광고 수익 월 1,200만원 별도', investmentPoints:'만실 시나리오: 보증금 11억원 / 월 1억 3,500만원', risks:'등기부·건축물대장·임대차계약서·층별 도면 원문 검증 필요' }),
  base({ id:'sample-seongsu-331-7', propertyNumber:'SAMPLE-SS-331-7', name:'성수동2가 331-7 신축부지', buildingName:'', tradeType:'매매', salePrice:5300000000, occupancyStatus:'명도 완료', address:'서울 성동구 성수동2가 331-7', roadCondition:'4m × 2m 코너', landAreaPyeong:36, totalFloorAreaPyeong:63.63, zoning:'준공업지역', mainUse:'', basementFloors:1, groundFloors:3, completionDate:'1993-08-17', elevator:'없음', parkingSpaces:1, recommendedUse:'신축부지 검토', risks:'원문 공적자료 연결 전 샘플 관리 상태' }),
];

await mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

try {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.evaluate(async (rows) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('real-estate-report', 13);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction('properties', 'readwrite');
        for (const row of rows) tx.objectStore('properties').put(row);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  }, properties);

  for (const property of properties) {
    await page.goto(`${BASE_URL}/document/proposal/${property.id}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.d1-sheet', { timeout: 30000 });
    const one = await page.evaluate(() => {
      const sheet = document.querySelector('.d1-sheet');
      if (!(sheet instanceof HTMLElement)) throw new Error('1P sheet missing');
      return {
        text: sheet.textContent || '',
        scrollWidth: sheet.scrollWidth, scrollHeight: sheet.scrollHeight,
        clientWidth: sheet.clientWidth, clientHeight: sheet.clientHeight,
      };
    });
    assert(one.text.includes(property.name) || one.text.includes(property.buildingName), `1P title missing for ${property.id}`);
    assert(!one.text.includes('NaN') && !one.text.includes('undefined'), `1P invalid token for ${property.id}`);
    assert(one.scrollHeight <= one.clientHeight + 2, `1P vertical overflow ${property.id}: ${one.scrollHeight}/${one.clientHeight}`);
    assert(one.scrollWidth <= one.clientWidth + 2, `1P horizontal overflow ${property.id}: ${one.scrollWidth}/${one.clientWidth}`);
    await page.screenshot({ path: `${OUT_DIR}/${property.id}-1p.png`, fullPage: true });

    await page.goto(`${BASE_URL}/document/report/${property.id}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.daon-professional-report-master', { timeout: 30000 });
    const report = await page.evaluate(() => {
      const master = document.querySelector('.daon-professional-report-master');
      const pages = [...master.querySelectorAll('.daon-frame-page, .daon-core-page')].map((node) => ({
        scrollWidth: node.scrollWidth, scrollHeight: node.scrollHeight,
        clientWidth: node.clientWidth, clientHeight: node.clientHeight, text: node.textContent || '',
      }));
      return { text: master?.textContent || '', pages };
    });
    assert(report.text.includes(property.name) || report.text.includes(property.buildingName), `Professional report title missing for ${property.id}`);
    assert(!report.text.includes('NaN') && !report.text.includes('undefined'), `Professional report invalid token for ${property.id}`);
    const standaloneMissing = /(^|[\s·:|])확인 필요(?=$|[\s·:|])/m.test(report.text);
    assert(!standaloneMissing, `Standalone missing placeholder in ${property.id}`);
    for (const [index, item] of report.pages.entries()) {
      assert(item.scrollHeight <= item.clientHeight + 2, `Report ${property.id} page ${index+1} vertical overflow: ${item.scrollHeight}/${item.clientHeight}`);
      assert(item.scrollWidth <= item.clientWidth + 2, `Report ${property.id} page ${index+1} horizontal overflow: ${item.scrollWidth}/${item.clientWidth}`);
    }
    await page.screenshot({ path: `${OUT_DIR}/${property.id}-professional.png`, fullPage: true });
    console.log(`Sample report QA PASS: ${property.name}`);
  }
} finally {
  await browser.close();
}
