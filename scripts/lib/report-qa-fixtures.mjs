// Shared DA:ON report QA fixtures (extracted 2026-11-16 from qa-report-pdf-text.mjs so the PDF text check and the
// fixed-engine visual regression seed exactly the same test properties). Test data only: recordClass 'qa_fixture',
// generated pixel images (exterior only, no interior photos, no owner sample files). Local-mode QA server only.
import { deflateSync } from 'node:zlib';

export const SEED_ID = 'daon-bangbae-815-11';

// ---- generated test images (same approach as e2e-online-listings: real pixels, no external or owner files) ----
function crc32(buf) { let c, crc = 0xffffffff; for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
export function png(width, height, pixel) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) { raw[y * (width * 3 + 1)] = 0; for (let x = 0; x < width; x++) { const [r, g, b] = pixel(x, y); const o = y * (width * 3 + 1) + 1 + x * 3; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; } }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
export const IMAGES = {
  exterior: png(480, 320, (x, y) => (y < 80 ? [135, 190, 235] : y > 280 ? [90, 90, 95] : x > 100 && x < 380 ? ((x - 100) % 50 < 30 && (y - 80) % 50 < 30 ? [60, 90, 120] : [200, 190, 175]) : [150, 170, 150])),
  street: png(480, 320, (x, y) => (y < 120 ? [170, 200, 230] : y > 250 ? [80, 80, 85] : (x % 120) < 90 ? [185 - (x % 120), 175, 160] : [120, 130, 140])),
  map: png(600, 420, (x, y) => (Math.abs(y - 210) < 6 || Math.abs(x - 300) < 6 ? [250, 250, 250] : (x - 300) ** 2 + (y - 210) ** 2 < 120 ? [200, 40, 40] : [226, 232, 220])),
};

// ---- fixtures (QA inputs; values are test data, labelled as such in the property name) ----
export const LONG = {
  occupancyStatus: '현재 소유자 직접 사용 중이며 잔금일 기준 전체 명도 협의가 가능합니다. 매입 후 장기간 공실 정리보다 실제 사용 계획을 빠르게 세우기 좋은 조건입니다.',
  roadCondition: '양면 도로 접면 코너. 파사드 노출, 출입구 분리, 방문객 동선 계획에서 실제 장점으로 작동합니다.',
  recommendedUse: '1층은 응대·브랜드 공간, 상층 업무/대표공간으로 소규모 사옥\n코너 파사드를 살린 목적형 외식·라이프스타일 플래그십\n지하 방음공간을 음악·콘텐츠 기능으로 살린 복합 문화공간',
  developmentPlan: '리노베이션 또는 신축을 통해 토지 활용가치 재평가. 제2종일반주거지역(7층 이하) 조건으로 도로·주차·일조·높이·건축선 사전검토가 필요합니다.',
  risks: '2026.09.02 등기 열람분상 과거 가처분 및 근저당권 설정은 말소 기록이 확인됩니다. 계약 체결 전 최신 등기사항전부증명서로 재확인합니다.',
  overallOpinion: '50.85평 코너 대지, 서래마을 생활권, 잔금일 기준 전체 명도 협의 가능성, 기존 건물의 즉시 활용성을 한 번에 확보하는 자산입니다.',
  locationAnalysis: '서래마을과 함지박사거리의 생활·외식 수요, 래미안 원페를라의 주거 배후가 맞닿는 생활권에서 목적형 공간으로 포지셔닝하기 좋습니다.',
};
export const SHORT = { shortOccupancyLabel: '소유자 사용 · 명도 협의', shortRoadLabel: '양면 도로 코너', shortUseLabel: '소규모 사옥 · 플래그십', shortDevelopmentLabel: '리노베이션·신축 검토' };
export const BROKER = { price: 3_950_123_456, confirmedAt: '2026-11-05T16:00:00Z' }; // UTC 16:00 = KST 2026-11-06 00:00 (date boundary)
export const DEALS = [
  { dealDate: '2026-06-02', legalDong: '방배동', jibun: '882-25', type: 'commercial', buildingUse: '제2종근린생활', dealAmount: 4_200_000_000, landAreaSqm: 194.7, landPricePerPyeong: 71_311_556 },
  { dealDate: '2025-11-25', legalDong: '방배동', jibun: '811-20', type: 'commercial', buildingUse: '제2종근린생활', dealAmount: 4_500_000_000, landAreaSqm: 186.1, landPricePerPyeong: 79_936_056 },
  { dealDate: '2025-11-25', legalDong: '방배동', jibun: '811-19', type: 'commercial', buildingUse: '제2종근린생활', dealAmount: 4_100_000_000, landAreaSqm: 228.4, landPricePerPyeong: 59_342_294 },
  { dealDate: '2025-11-18', legalDong: '방배동', jibun: '456-30', type: 'commercial', buildingUse: '제2종근린생활', dealAmount: 3_500_000_000, landAreaSqm: 167.8, landPricePerPyeong: 68_952_920 },
  { dealDate: '2025-10-24', legalDong: '방배동', jibun: '2112', type: 'commercial', buildingUse: '제2종근린생활', dealAmount: 5_100_000_000, landAreaSqm: 198, landPricePerPyeong: 85_149_394 },
];
export const ESTIMATE = {
  method: 'land_unit_price_iqr_v1', landAreaSqm: 168.1, comparableCount: 5, excluded: { upstream: 0 }, computedAt: '2026-11-05T15:35:22.455Z',
  areaRange: { minSqm: 84.1, maxSqm: 336.2 }, deals: DEALS, state: 'estimated',
  unitLow: 68_952_920, unitMid: 71_311_556, unitHigh: 79_936_056, low: 3_506_257_442, mid: 3_626_194_133, high: 4_064_750_140,
  note: '비교거래 5건 토지 평당가 하위25%·중앙값·상위25% × 본건 토지 50.85평 · DA:ON 추정, 감정평가 아님',
};

/** Route the generated test images (served under /__qa__/) for a Playwright page or context. */
export async function routeQaImages(target) {
  for (const [name, body] of Object.entries(IMAGES)) await target.route(`**/__qa__/${name}.png`, (route) => route.fulfill({ status: 200, contentType: 'image/png', body }));
}

/** Wait until the local bootstrap has seeded the reference property (the fixtures reuse its record shape). */
export async function waitForSeed(page) {
  await page.waitForFunction(async (seedId) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('real-estate-report'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    try { return await new Promise((res) => { try { const g = db.transaction('properties').objectStore('properties').get(seedId); g.onsuccess = () => res(Boolean(g.result)); g.onerror = () => res(false); } catch { res(false); } }); } finally { db.close(); }
  }, SEED_ID, { timeout: 45_000 });
}

/**
 * Write one QA fixture property (plus media, spaces and, unless sparse, comparables and price estimate) into IndexedDB.
 * fx: { key, short, broker, sparse, managerName }. overrides: extra Property fields applied last (e.g. a long address).
 */
export async function seedReportFixture(page, { id, name, fx, overrides = {} }) {
  await page.evaluate(async ({ id, name, seedId, fx, long, short, broker, estimate, deals, overrides }) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('real-estate-report'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const get = (store, key) => new Promise((res, rej) => { const g = db.transaction(store).objectStore(store).get(key); g.onsuccess = () => res(g.result); g.onerror = () => rej(g.error); });
    try {
      const base = await get('properties', seedId);
      const now = new Date().toISOString();
      const blank = fx.sparse ? { locationAnalysis: '', roadCondition: '', overallOpinion: '', features: '', developmentPlan: '', recommendedUse: '', occupancyStatus: long.occupancyStatus, buildingCoverageRate: 0, floorAreaRatio: 0, completionDate: '', mapImage: '', nearbyTransactions: '', landUnitPrice: 0 } : {};
      const property = {
        ...base, id, name, propertyNumber: `QA-PDF-${fx.key.toUpperCase()}`, buildingName: '', recordClass: 'qa_fixture', recordClassSource: 'qa-report-pdf-text',
        internalPhotoAllowed: false, mainImage: '/__qa__/exterior.png', mapImage: '/__qa__/map.png', additionalImages: [],
        tradeType: '매매', salePrice: 4_150_000_000, negotiable: true,
        landAreaSqm: 168.1, landAreaPyeong: 50.85, totalFloorAreaSqm: 349.08, totalFloorAreaPyeong: 105.6, buildingAreaPyeong: 24.8,
        zoning: '제2종일반주거지역(7층 이하)', mainUse: '주택 및 근린생활시설', basementFloors: 1, groundFloors: 3, completionDate: '1978-07-31',
        buildingCoverageRate: 48.8, floorAreaRatio: 146.3, parkingSpaces: 2,
        ...long,
        features: '파사드·내부동선·지하공간을 브랜드 목적에 맞게 재구성',
        investmentPoints: '서래마을·함지박사거리 수요권 코너 입지\n기존 건물을 사옥·주거업무 복합공간으로 즉시 검토\n중장기 신축 가능성까지 검토 가능한 토지',
        shortHeadline: '', shortOccupancyLabel: '', shortRoadLabel: '', shortUseLabel: '', shortDevelopmentLabel: '',
        ...(fx.short ? short : {}),
        // 루인 review (2026-11-12): name entered vs not entered; phone/e-mail left blank so the office contact fallback is exercised.
        managerName: fx.managerName, managerPhone: '', managerEmail: '',
        brokerAchievablePrice: fx.broker ? broker.price : 0, brokerAchievablePriceRationale: fx.broker ? 'QA: 인근 매수 문의 2건 기준' : '', brokerAchievablePriceConfirmedAt: fx.broker ? broker.confirmedAt : '',
        ...blank,
        ...overrides,
        createdAt: now, updatedAt: now,
      };
      const media = (n, url, caption) => ({ id: `${id}-m${n}`, propertyId: id, mediaType: 'image', category: 'exterior', storagePath: `qa/${id}/${n}`, url, fileName: `${n}.png`, mimeType: 'image/png', caption, aiTags: [], verificationStatus: 'confirmed', sortOrder: n, isPrimary: n === 0, createdAt: now, updatedAt: now });
      const space = (n, floor, spaceName, areaSqm, currentCondition) => ({ id: `${id}-space-${n}`, propertyId: id, floor, name: spaceName, spaceType: 'floor', areaSqm, currentCondition, verificationStatus: 'confirmed', createdAt: now, updatedAt: now });
      await new Promise((res, rej) => {
        const tx = db.transaction(['properties', 'propertyMedia', 'propertyDataSources', 'propertySpaces'], 'readwrite');
        tx.objectStore('properties').put(property);
        [media(0, '/__qa__/exterior.png', 'QA 외관(생성 이미지)'), media(1, '/__qa__/street.png', 'QA 가로(생성 이미지)')].forEach((m) => tx.objectStore('propertyMedia').put(m));
        [space(1, '3F', '주택', 81.98, '주거공간'), space(2, '2F', '주택', 81.98, '주거공간'), space(3, '1F', '근린생활시설 + 점포', 81.98, '전면 상가 및 출입부'), space(4, 'B1', '다가구용 단독주택(1가구)', 103.14, '방음시설 설치 · 음악/취미/모임공간')].forEach((s) => tx.objectStore('propertySpaces').put(s));
        if (!fx.sparse) {
          tx.objectStore('propertyDataSources').put({ id: `comparables:${id}`, propertyId: id, fieldKey: 'nearbyTransactions', resourceType: 'comparable_transaction_set', sourceType: 'public_api', sourceName: 'QA 비교거래(테스트 값)', sourceReference: 'qa', collectedAt: now, verificationStatus: 'confirmed', metadata: { rows: deals.map((d) => ({ label: `${d.legalDong} ${d.jibun}`, salePrice: d.dealAmount, landAreaPyeong: Math.round((d.landAreaSqm / 3.305785) * 100) / 100, landUnitPrice: d.landPricePerPyeong, tradeDate: d.dealDate })) }, createdAt: now });
          tx.objectStore('propertyDataSources').put({ id: `achievable-price:${id}`, propertyId: id, fieldKey: 'achievablePrice', resourceType: 'achievable_price_estimate', sourceType: 'calculated', sourceName: 'QA 추정(테스트 값)', sourceReference: 'qa', collectedAt: now, verificationStatus: 'estimated', metadata: { estimate }, createdAt: now });
        }
        tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
      });
    } finally { db.close(); }
  }, { id, name, seedId: SEED_ID, fx, long: LONG, short: SHORT, broker: BROKER, estimate: ESTIMATE, deals: DEALS, overrides });
}
