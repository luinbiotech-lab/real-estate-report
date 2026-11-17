/*
 * Rendered public listing privacy smoke (2026-11-16, 루인 #65).
 * Seeds one listing whose record is full of private canaries (lot number, detail address, owner / tenant / manager,
 * phone, e-mail, internal name, notes, a file-name evidence label, a signed photo URL, comparable deal labels), opens the
 * buyer screens on PC and phone, and fails if any canary appears in the visible text, the HTML (attributes included),
 * the document title or meta tags. The internal id is allowed only in the two preview-only places that are not part of
 * the public snapshot: the /listing/:id address itself and the staff link "업무 화면에서 이 물건 열기".
 * Local mode only (IndexedDB); writes only the QA record it creates.
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const ARTIFACT_DIR = 'artifacts/agent-qa';
const SEED_ID = 'daon-bangbae-815-11';
const ID = 'qa-privacy-7f3a9c';
const CANARY = {
  id: ID,
  name: '홍길동빌딩(777-55)',
  lot: '777-55',
  detail: '비밀상세주소-B동',
  owner: '소유자김철수',
  tenant: '임차인박영희',
  manager: '담당자이몽룡',
  phone: '010-9876-5432',
  email: 'private.broker@example.com',
  company: '비밀중개법인',
  note: '내부메모-매도인급매',
  risk: '근저당-채권최고액-비공개',
  file: '서초동777-55_등기부등본_원본.pdf',
  photoToken: 'SIGNEDTOKEN123',
  deal: '비교거래-역삼동123-4',
  rationale: '협상가근거-비공개',
};
const failures = [];
const check = (ok, label) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failures.push(label); };

await mkdir(ARTIFACT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });

async function seed(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(async (seedId) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('real-estate-report'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    try { return await new Promise((res) => { try { const g = db.transaction('properties').objectStore('properties').get(seedId); g.onsuccess = () => res(Boolean(g.result)); g.onerror = () => res(false); } catch { res(false); } }); } finally { db.close(); }
  }, SEED_ID, { timeout: 45_000 });
  await page.evaluate(async ({ seedId, c }) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('real-estate-report'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const get = (store, key) => new Promise((res, rej) => { const g = db.transaction(store).objectStore(store).get(key); g.onsuccess = () => res(g.result); g.onerror = () => rej(g.error); });
    try {
      const base = await get('properties', seedId);
      const now = new Date().toISOString();
      const property = {
        ...base, id: c.id, name: c.name, buildingName: c.name, propertyNumber: 'QA-PRIVACY', recordClass: 'qa_fixture', recordClassSource: 'visual-public-listing-privacy-smoke',
        address: `서울특별시 서초구 서초동 ${c.lot}`, detailAddress: c.detail, latitude: 37.491234, longitude: 127.011234,
        occupancyStatus: `${c.tenant} 영업 중`, listingStatusSource: c.manager, listingStatusNote: c.note,
        roadCondition: `서초동 ${c.lot} 앞 8m 도로, 문의 ${c.phone}`, nearbyStation: '교대역', stationDistance: '도보 5분',
        // Explicit values (not taken from the seed) so the facts, evidence and unit price always render.
        tradeType: '매매', salePrice: 4_150_000_000, landAreaPyeong: 50.85, landAreaSqm: 168.1, totalFloorAreaSqm: 349.08, totalFloorAreaPyeong: 105.6,
        zoning: '제2종일반주거지역', mainUse: '근린생활시설', structure: '철근콘크리트구조', basementFloors: 1, groundFloors: 4, completionDate: '2010-05-12',
        brokerAchievablePrice: 3_900_000_000, brokerAchievablePriceRationale: c.rationale,
        features: c.note, investmentPoints: c.note, locationAnalysis: c.note, developmentPlan: c.note, overallOpinion: c.note,
        risks: c.risk, nearbyTransactions: c.deal,
        managerName: c.manager, managerPhone: c.phone, managerEmail: c.email, companyName: c.company,
        internalPhotoAllowed: true, mainImage: `https://example.supabase.co/storage/v1/object/sign/media/a.jpg?token=${c.photoToken}`, additionalImages: [],
        briefingItems: [{ id: 'b', title: c.owner, body: c.owner }],
        createdAt: now, updatedAt: now,
      };
      await new Promise((res, rej) => {
        const tx = db.transaction(['properties', 'propertyDataSources', 'propertyVerifications'], 'readwrite');
        tx.objectStore('properties').put(property);
        tx.objectStore('propertyVerifications').put({ id: `${c.id}-v-zoning`, propertyId: c.id, fieldKey: 'zoning', status: 'verified', note: c.note, verifiedBy: c.manager, verifiedAt: now, createdAt: now, updatedAt: now });
        tx.objectStore('propertyDataSources').put({ id: `${c.id}-s-zoning`, propertyId: c.id, fieldKey: 'zoning', sourceType: 'official_document', sourceName: c.file, collectedAt: now, verificationStatus: 'verified', metadata: { owner: c.owner }, createdAt: now });
        tx.objectStore('propertyDataSources').put({ id: `comparables:${c.id}`, propertyId: c.id, fieldKey: 'nearbyTransactions', resourceType: 'comparable_transaction_set', sourceType: 'public_api', sourceName: c.file, sourceReference: 'qa', collectedAt: now, verificationStatus: 'confirmed', metadata: { rows: [{ label: c.deal, salePrice: 5_000_000_000, landAreaPyeong: 100, landUnitPrice: 50_000_000, tradeDate: '2026-10-01' }] }, createdAt: now });
        tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
      });
    } finally { db.close(); }
  }, { seedId: SEED_ID, c: CANARY });
}

async function cleanup(page) {
  await page.evaluate(async (c) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('real-estate-report'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    try {
      await new Promise((res) => {
        const tx = db.transaction(['properties', 'propertyDataSources', 'propertyVerifications'], 'readwrite');
        tx.objectStore('properties').delete(c.id);
        tx.objectStore('propertyVerifications').delete(`${c.id}-v-zoning`);
        tx.objectStore('propertyDataSources').delete(`${c.id}-s-zoning`);
        tx.objectStore('propertyDataSources').delete(`comparables:${c.id}`);
        tx.oncomplete = () => res(); tx.onerror = () => res();
      });
    } finally { db.close(); }
  }, CANARY);
}

/** Text, HTML (with attributes), title and meta of the page, with the two preview-only id holders removed. */
async function surfaces(page) {
  return page.evaluate((id) => {
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('script, style, link[rel="stylesheet"]').forEach((el) => el.remove());
    const staff = [...clone.querySelectorAll('.listing-staff-link')];
    staff.forEach((el) => el.remove());
    // Explore cards link to /listing/<internal id> (preview routing only); drop that one attribute value.
    clone.querySelectorAll(`a[href*="${id}"]`).forEach((el) => el.setAttribute('href', '[preview-route]'));
    const meta = [...document.querySelectorAll('meta')].map((el) => `${el.getAttribute('name') || el.getAttribute('property') || ''}=${el.getAttribute('content') || ''}`).join('\n');
    return { text: document.body.innerText, html: clone.outerHTML, title: document.title, meta, staffLinks: staff.length };
  }, ID);
}

function scan(tag, where, value) {
  const leaks = Object.entries(CANARY).filter(([key, canary]) => key !== 'id' && value.includes(canary)).map(([key]) => key);
  if (value.includes(ID)) leaks.push('id');
  if (/777/.test(value)) leaks.push('lotDigits');
  if (/37\.491234|127\.011234/.test(value)) leaks.push('exactCoordinates');
  check(leaks.length === 0, `${tag} ${where}: 비공개 값 없음${leaks.length ? ` (노출: ${leaks.join(', ')})` : ''}`);
}

async function run(viewport, tag) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const requests = [];
  page.on('request', (request) => requests.push(request.url()));
  await seed(page);
  try {
    requests.length = 0;
    await page.goto(`${BASE_URL}/listing/${ID}`, { waitUntil: 'domcontentloaded' });
    await page.getByText('공개 화면 미리보기').first().waitFor({ timeout: 30_000 }).catch(async (error) => { console.log((await page.locator('main').innerText().catch(() => '')).slice(0, 600)); throw error; });
    await page.locator('.checklist-rows li').first().waitFor({ timeout: 30_000 });
    await page.locator('.fact-proof').first().waitFor({ timeout: 30_000 }).catch(async (error) => { console.log((await page.locator('.listing-page').innerText().catch(() => '')).slice(0, 1500)); throw error; });
    for (const level of ['동·도로명까지', '구까지']) {
      await page.getByRole('button', { name: level }).click();
      const s = await surfaces(page);
      scan(tag, `공개 미리보기(${level}) 화면 글자`, s.text);
      scan(tag, `공개 미리보기(${level}) HTML·속성`, s.html);
      scan(tag, `공개 미리보기(${level}) 제목·메타`, `${s.title}\n${s.meta}`);
      check(s.staffLinks === 1, `${tag} 내부 링크는 '업무 화면에서 이 물건 열기' 하나뿐 (스냅샷 밖, 2단계 공개본에는 없음)`);
    }
    const proof = await page.locator('.fact-proof').allInnerTexts();
    check(proof.some((line) => line.includes('공식 문서')), `${tag} 파일명 출처는 '공식 문서'로만 표시 (${proof.join(' | ')})`);
    check(await page.locator('.listing-photo img').count() === 0, `${tag} 서명 링크 사진은 공개 화면에 없음`);
    check(!requests.some((url) => url.includes(CANARY.photoToken)), `${tag} 서명 사진 주소로 요청하지 않음`);
    await page.screenshot({ path: `${ARTIFACT_DIR}/public-listing-privacy-${tag}.png`, fullPage: true });

    await page.goto(`${BASE_URL}/explore`, { waitUntil: 'domcontentloaded' });
    const card = page.locator(`a.explore-card[href*="${ID}"]`).first();
    await card.waitFor({ timeout: 30_000 });
    await page.waitForFunction(() => !document.querySelector('.explore-count span'), null, { timeout: 30_000 });
    const cardHtml = await card.evaluate((el) => { const clone = el.cloneNode(true); clone.removeAttribute('href'); return clone.outerHTML; });
    scan(tag, '탐색 카드 HTML·속성', cardHtml);
    scan(tag, '탐색 카드 글자', await card.innerText());
    check(await card.locator('img').count() === 0, `${tag} 탐색 카드: 서명 링크 사진 없음`);
  } finally {
    await cleanup(page);
    await context.close();
  }
}

try {
  await run({ width: 1440, height: 1000 }, 'pc');
  await run({ width: 390, height: 844 }, 'phone');
  if (failures.length) throw new Error(`${failures.length} check(s) failed: ${failures.join(' / ')}`);
  console.log('Public listing privacy smoke: PASS');
} catch (error) {
  console.error('Public listing privacy smoke: FAIL');
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
