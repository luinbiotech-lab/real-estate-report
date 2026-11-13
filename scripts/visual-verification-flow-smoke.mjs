/*
 * Verification candidate decision E2E (12/13 stabilization).
 * A candidate value must not change the Property until a person approves it. Approve → the Property field
 * changes and a verified record + data source are written; reject → the Property stays as it was.
 * QA candidates are inserted into the local IndexedDB only; nothing is sent to a server.
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const ARTIFACT_DIR = 'artifacts/agent-qa';
const APPROVE_ID = 'qa-verif-approve';
const REJECT_ID = 'qa-verif-reject';
const APPROVE_VALUE = '[QA 후보] 방배역 도보 7분';
const REJECT_VALUE = '[QA 후보] 6m 도로 접함';

function idb(page, fn, arg) {
  return page.evaluate(async ({ source, value }) => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('real-estate-report'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const run = (store, mode, op) => new Promise((resolve, reject) => { const tx = db.transaction(store, mode); const req = op(tx.objectStore(store)); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    try { return await (0, eval)(`(${source})`)(run, value); } finally { db.close(); }
  }, { source: fn.toString(), value: arg });
}

const failures = [];
const check = (ok, label) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failures.push(label); };

await mkdir(ARTIFACT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

try {
  await page.goto(`${BASE_URL}/properties`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body?.innerText.includes('물건'), null, { timeout: 30_000 });
  let property;
  for (let attempt = 0; attempt < 30 && !property; attempt += 1) {
    property = await idb(page, async (run) => (await run('properties', 'readonly', (s) => s.getAll()))[0]);
    if (!property) await page.waitForTimeout(500);
  }
  if (!property) throw new Error('seed property not found in IndexedDB');
  const before = { nearbyStation: property.nearbyStation ?? null, roadCondition: property.roadCondition ?? null };
  const now = new Date().toISOString();
  const base = { propertyId: property.id, sourceType: 'manual', sourceName: 'QA 검증 흐름 점검', decisionStatus: 'pending', createdAt: now };
  await idb(page, async (run, rows) => { for (const row of rows) await run('propertyVerificationCandidates', 'readwrite', (s) => s.put(row)); }, [
    { ...base, id: APPROVE_ID, fieldKey: 'nearbyStation', currentValue: before.nearbyStation, candidateValue: APPROVE_VALUE, note: 'QA: 승인 시 물건 정보에 반영되어야 함' },
    { ...base, id: REJECT_ID, fieldKey: 'roadCondition', currentValue: before.roadCondition, candidateValue: REJECT_VALUE, note: 'QA: 거절 시 물건 정보가 바뀌지 않아야 함' },
  ]);

  await page.goto(`${BASE_URL}/property/${encodeURIComponent(property.id)}?tab=verification`, { waitUntil: 'domcontentloaded' });
  await page.getByText(APPROVE_VALUE).waitFor({ timeout: 30_000 });
  const approveRow = page.locator('article', { hasText: APPROVE_VALUE });
  const rejectRow = page.locator('article', { hasText: REJECT_VALUE });
  check(await approveRow.getByText('인근역', { exact: true }).count() === 1, '필드 이름이 한글(인근역)로 표시됨');
  check(await page.getByText('nearbyStation', { exact: true }).count() === 0, '내부 필드 키(nearbyStation)를 화면에 노출하지 않음');
  check(await page.getByText('후보값은 승인하기 전까지 물건 정보를 바꾸지 않습니다. 거절·보류한 값은 기록만 남습니다.').count() === 1, '승인 전 원본 불변 안내 표시');
  const untouched = await idb(page, async (run, id) => run('properties', 'readonly', (s) => s.get(id)), property.id);
  check((untouched.nearbyStation ?? null) === before.nearbyStation, '후보 등록만으로는 물건 정보가 바뀌지 않음');
  const rowLayout = await approveRow.evaluate((row) => {
    const top = (el) => Math.round(el.getBoundingClientRect().top);
    const buttons = [...row.querySelectorAll('button')].map(top);
    return { buttons, rowTop: top(row), rowHeight: Math.round(row.getBoundingClientRect().height) };
  });
  check(rowLayout.buttons.length === 3 && new Set(rowLayout.buttons).size === 1, `승인·보류·거절 버튼이 한 줄에 있음 (${rowLayout.buttons.join(',')})`);
  await page.screenshot({ path: `${ARTIFACT_DIR}/verification-flow-before.png`, fullPage: true });

  await approveRow.getByRole('button', { name: '승인', exact: true }).click();
  await approveRow.getByRole('button', { name: '승인', exact: true }).waitFor({ state: 'detached', timeout: 15_000 });
  await rejectRow.getByRole('button', { name: '거절', exact: true }).click();
  await rejectRow.getByRole('button', { name: '거절', exact: true }).waitFor({ state: 'detached', timeout: 15_000 });

  const after = await idb(page, async (run, id) => ({
    property: await run('properties', 'readonly', (s) => s.get(id)),
    candidates: (await run('propertyVerificationCandidates', 'readonly', (s) => s.getAll())).filter((row) => row.propertyId === id),
    verifications: (await run('propertyVerifications', 'readonly', (s) => s.getAll())).filter((row) => row.propertyId === id),
    sources: (await run('propertyDataSources', 'readonly', (s) => s.getAll())).filter((row) => row.propertyId === id),
  }), property.id);
  const approved = after.candidates.find((row) => row.id === APPROVE_ID);
  const rejected = after.candidates.find((row) => row.id === REJECT_ID);
  check(after.property.nearbyStation === APPROVE_VALUE, '승인 → 물건의 인근역 값이 후보값으로 바뀜');
  check((after.property.roadCondition ?? null) === before.roadCondition, '거절 → 물건의 도로조건 값은 그대로');
  check(approved?.decisionStatus === 'approved' && Boolean(approved.reviewedAt), '승인 후보에 처리 상태·시각 기록');
  check(rejected?.decisionStatus === 'rejected' && Boolean(rejected.reviewedAt), '거절 후보에 처리 상태·시각 기록');
  check(after.verifications.some((row) => row.fieldKey === 'nearbyStation' && row.status === 'verified'), '승인 시 검증 기록(verified) 생성');
  check(!after.verifications.some((row) => row.fieldKey === 'roadCondition' && row.note?.includes('QA')), '거절 시 검증 기록 없음');
  check(after.sources.some((row) => row.metadata?.verificationCandidateId === APPROVE_ID), '승인 시 출처 기록이 후보 ID와 연결됨');
  check(!after.sources.some((row) => row.metadata?.verificationCandidateId === REJECT_ID), '거절 후보는 출처 기록을 만들지 않음');
  check(await approveRow.getByText('승인', { exact: true }).count() >= 1 && await rejectRow.getByText('거절', { exact: true }).count() >= 1, '처리 결과가 화면 상태 칩으로 표시됨');
  const chipContrast = await approveRow.locator('.MuiChip-root').evaluate((chip) => {
    const label = chip.querySelector('.MuiChip-label');
    return { text: getComputedStyle(label).color, bg: getComputedStyle(chip).backgroundColor, width: chip.getBoundingClientRect().width };
  });
  check(chipContrast.text !== chipContrast.bg && chipContrast.text.replace(/\s/g, '') === 'rgb(255,255,255)', `승인 칩 글자가 흰색으로 읽힘 (${chipContrast.text} on ${chipContrast.bg})`);
  check(chipContrast.width < 120, `상태 칩이 칸 전체로 늘어나지 않음 (${Math.round(chipContrast.width)}px)`);
  await page.screenshot({ path: `${ARTIFACT_DIR}/verification-flow-after.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText(APPROVE_VALUE).first().waitFor({ timeout: 30_000 });
  await idb(page, async (run, row) => run('propertyVerificationCandidates', 'readwrite', (s) => s.put(row)), { ...base, id: 'qa-verif-mobile', fieldKey: 'stationDistance', currentValue: property.stationDistance ?? null, candidateValue: '[QA 후보] 도보 7분', note: 'QA: 휴대폰 버튼 배치 확인용(처리하지 않음)' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('[QA 후보] 도보 7분').waitFor({ timeout: 30_000 });
  const mobileButtons = await page.locator('article', { hasText: '[QA 후보] 도보 7분' }).locator('button').evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), width: Math.round(r.width) }; }));
  check(mobileButtons.length === 3 && new Set(mobileButtons.map((b) => b.top)).size === 1 && mobileButtons.every((b) => b.width >= 80), `휴대폰: 처리 버튼 3개가 한 줄·누르기 쉬운 폭 (${mobileButtons.map((b) => b.width).join(',')}px)`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 1, `휴대폰 390px 가로 넘침 없음 (${overflow}px)`);
  // Fixed bottom bars cover rows in a full-page capture, so scroll the pending row to mid-screen and capture the viewport.
  await page.locator('article', { hasText: '[QA 후보] 도보 7분' }).evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const covered = await page.locator('article', { hasText: '[QA 후보] 도보 7분' }).locator('button').first().evaluate((el) => { const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !el.contains(hit); });
  check(!covered, '휴대폰: 처리 버튼이 하단 고정 바에 가려지지 않고 눌림');
  await page.screenshot({ path: `${ARTIFACT_DIR}/verification-flow-mobile.png` });

  // Restore the seed property so later smokes see the original values.
  await idb(page, async (run, value) => {
    const current = await run('properties', 'readonly', (s) => s.get(value.id));
    await run('properties', 'readwrite', (s) => s.put({ ...current, nearbyStation: value.nearbyStation ?? undefined }));
  }, { id: property.id, nearbyStation: before.nearbyStation });

  if (failures.length) throw new Error(`${failures.length} check(s) failed: ${failures.join(' / ')}`);
  console.log('Verification candidate approve/reject flow QA: PASS');
} catch (error) {
  await page.screenshot({ path: `${ARTIFACT_DIR}/verification-flow-failure.png`, fullPage: true }).catch(() => {});
  console.error('Verification candidate approve/reject flow QA: FAIL');
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
