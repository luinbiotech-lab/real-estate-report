/*
 * Public listing publish smoke (phase 2, 2026-11-18). Local mode (IndexedDB seed + localStorage publish store).
 * PC and phone: publish the Bangbae seed from the workspace preview, open the buyer page /p/<public id>, check that it
 * is outside the workspace (no navigation), carries no internal id / lot / staff contact in text, HTML or title,
 * send an inquiry (refused without consent), refuse the full-address level, withdraw, and see the buyer page close.
 * Writes only localStorage keys it cleans up.
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const ARTIFACT_DIR = 'artifacts/agent-qa';
const SEED_ID = 'daon-bangbae-815-11';
const SECOND_ID = 'sample-seongsu';
const PRIVATE = [SEED_ID, '815-11', '김은미', '010 9953 1270', '010-9953-1270', 'daonasset.korea@gmail.com'];
const failures = [];
const check = (ok, label) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failures.push(label); };

await mkdir(ARTIFACT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });

async function waitForSeed(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(async (seedId) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('real-estate-report'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    try { return await new Promise((res) => { try { const g = db.transaction('properties').objectStore('properties').get(seedId); g.onsuccess = () => res(Boolean(g.result)); g.onerror = () => res(false); } catch { res(false); } }); } finally { db.close(); }
  }, SEED_ID, { timeout: 45_000 });
}

async function openPreview(page, id = SEED_ID) {
  await page.goto(`${BASE_URL}/listing/${id}`, { waitUntil: 'domcontentloaded' });
  await page.getByText('공개 화면 미리보기').first().waitFor({ timeout: 30_000 });
  await page.locator('.checklist-rows li').first().waitFor({ timeout: 30_000 });
  await page.locator('.publish-status').filter({ hasNotText: '확인 중' }).first().waitFor({ timeout: 15_000 });
}

// QA-only office values (never a real brokerage); the publish gate requires all five.
const OFFICE = { '중개사무소 명칭': 'QA 시험 공인중개사사무소', '소재지': '서울특별시 시험구 시험로 1', '연락처': '02-0000-0000', '등록번호': 'QA-0000-00000', '대표 공인중개사 성명': 'QA 대표' };

async function fillOffice(page, tag) {
  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'domcontentloaded' });
  const section = page.locator('section[aria-label="중개사무소 정보"]');
  await section.waitFor({ timeout: 30_000 });
  for (const [label, value] of Object.entries(OFFICE)) await section.getByLabel(label).fill(value);
  // 2026-11-27 루인 #86: typed values are not proof; the gate also needs how and when the registration was confirmed.
  await section.getByLabel('등록정보 확인 방법').click();
  await page.getByRole('option', { name: '국가공간정보포털 부동산중개업 조회' }).click();
  await section.getByLabel('등록정보 확인일').fill('2026-11-27');
  await page.getByRole('button', { name: '설정 저장' }).click();
  await page.waitForTimeout(800);
  check(await section.locator('.MuiAlert-root').count() === 0, `${tag} 설정: 중개사무소 다섯 칸 입력·저장`);
}

async function run(viewport, tag) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await waitForSeed(page);
  await page.evaluate(() => { localStorage.removeItem('daon-public-listings-v1'); localStorage.removeItem('daon-public-inquiries-v1'); });
  try {
    await openPreview(page);
    check(await page.getByRole('button', { name: '게시', exact: true }).isDisabled(), `${tag} 중개사무소 정보 없으면 게시 버튼 꺼짐`);
    check((await page.locator('.publish-blockers').innerText()).includes('중개사무소 정보'), `${tag} 중개사무소 정보 입력 안내 표시`);
    await fillOffice(page, tag);
    await openPreview(page);
    await page.getByRole('button', { name: '전체 주소' }).click();
    check(await page.getByRole('button', { name: '게시', exact: true }).isDisabled(), `${tag} 전체 주소 범위에서는 게시 버튼 꺼짐`);
    check((await page.locator('.publish-blockers').innerText()).includes('전체 주소'), `${tag} 전체 주소 게시 불가 이유 표시`);
    await page.getByRole('button', { name: '동·도로명까지' }).click();

    await page.getByRole('button', { name: '게시', exact: true }).click();
    await page.locator('.publish-panel a').first().waitFor({ timeout: 10_000 });
    const href = await page.locator('.publish-panel a').first().getAttribute('href');
    check(/\/p\/[0-9a-f-]{36}$/.test(href ?? ''), `${tag} 게시 후 공개 주소 생성 (${href})`);
    check(!(href ?? '').includes(SEED_ID), `${tag} 공개 주소에 내부 물건 번호 없음`);
    check((await page.locator('.publish-status').innerText()).includes('게시 중'), `${tag} 상태: 게시 중`);

    await page.goto(href, { waitUntil: 'domcontentloaded' });
    await page.locator('.pl-head h1').waitFor({ timeout: 30_000 });
    check(await page.locator('.app-shell, nav').count() === 0, `${tag} 공개 화면에는 업무 메뉴 없음`);
    check(await page.locator('.listing-staff-link, .publish-panel').count() === 0, `${tag} 공개 화면에 내부 링크·게시 패널 없음`);
    const text = await page.locator('body').innerText();
    const html = (await page.content()).replace(/<script[\s\S]*?<\/script>/g, '');
    const title = await page.title();
    for (const [where, value] of [['글자', text], ['HTML·속성', html], ['제목', title]]) {
      const leaks = PRIVATE.filter((needle) => value.includes(needle));
      check(leaks.length === 0, `${tag} 공개 화면 ${where}: 비공개 값 없음${leaks.length ? ` (노출: ${leaks.join(', ')})` : ''}`);
    }
    check(title.includes('DA:ON'), `${tag} 공개 화면 제목 (${title})`);
    const officeText = await page.locator('.pl-office').first().innerText().catch(() => '');
    check(Object.values(OFFICE).every((value) => officeText.includes(value)), `${tag} 공개 화면: 중개사무소 명칭·대표·등록번호·소재지·전화 표시`);
    check(await page.locator('.checklist-rows li').count() >= 7 && await page.locator('.fact-badge').count() >= 5, `${tag} 공개 화면: 값별 근거·매수 전 확인표`);
    check(await page.locator('.building-placeholder').count() === 1 && await page.locator('.pl-gallery img').count() === 0, `${tag} 사진 금지 물건: 실제 사진 없이 일러스트(실제 사진 아님 표시)`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(overflow <= 1, `${tag} 가로 넘침 없음 (${overflow}px)`);
    if (tag === 'phone') check(await page.locator('.public-mobile-cta').isVisible(), `${tag} 하단 고정 문의 버튼`);
    await page.screenshot({ path: `${ARTIFACT_DIR}/public-listing-${tag}.png`, fullPage: true });

    const ask = tag === 'phone' ? page.locator('.public-mobile-cta').getByRole('button', { name: '문의하기' }) : page.locator('.pl-side').getByRole('button', { name: '문의하기' });
    await ask.click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('이름').fill('김매수');
    await dialog.getByLabel('연락처 (전화 또는 이메일)').fill('010-1111-2222');
    check(await dialog.getByRole('button', { name: '보내기' }).isDisabled(), `${tag} 동의 전에는 문의 보내기 꺼짐`);
    await dialog.getByLabel('개인정보 수집·이용에 동의합니다 (필수)').check();
    await dialog.getByRole('button', { name: '보내기' }).click();
    await dialog.getByText('접수되었습니다').waitFor({ timeout: 10_000 });
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('daon-public-inquiries-v1') || '[]'));
    check(stored.length === 1 && stored[0].consentAt && stored[0].publicListingId === href.split('/p/')[1] && !JSON.stringify(stored).includes(SEED_ID), `${tag} 문의 접수(동의 시각·공개 번호만 기록)`);
    await page.screenshot({ path: `${ARTIFACT_DIR}/public-listing-inquiry-${tag}.png` });
    await dialog.getByRole('button', { name: '닫기' }).click();

    // 2026-11-24 pilot: the inquiry reaches the staff inbox and the home to-do, and its status can be changed.
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.getByText('새 매수 문의 1건').waitFor({ timeout: 30_000 });
    check(true, `${tag} 홈 오늘 할 일에 새 매수 문의 1건`);
    await page.goto(`${BASE_URL}/inquiries`, { waitUntil: 'domcontentloaded' });
    const card = page.locator('.inbox-card').filter({ hasText: '김매수' });
    await card.waitFor({ timeout: 30_000 });
    check(await card.locator('a.inbox-contact[href="tel:01011112222"]').count() === 1, `${tag} 문의함: 이름·전화 걸기 링크`);
    check((await card.locator('.inbox-listing').innerText()).length > 0 && !(await card.innerText()).includes('815-11'), `${tag} 문의함: 매물 제목(지번 없음) 표시`);
    await card.getByRole('combobox').click();
    await page.getByRole('option', { name: '답변함' }).click();
    await page.getByText('처리 전 문의가 없습니다.').waitFor({ timeout: 10_000 });
    const afterStatus = await page.evaluate(() => JSON.parse(localStorage.getItem('daon-public-inquiries-v1') || '[]'));
    check(afterStatus[0]?.status === 'answered', `${tag} 문의함: 답변함으로 바꾸면 저장되고 처리 전 목록에서 빠짐`);
    const inboxOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(inboxOverflow <= 1, `${tag} 문의함 가로 넘침 없음 (${inboxOverflow}px)`);
    await page.locator('.inbox-filters').getByRole('button', { name: /^전체/ }).click();
    await page.locator('.inbox-card').first().waitFor();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${ARTIFACT_DIR}/inquiry-inbox-${tag}.png`, fullPage: true });


    // 루인 #71 review: /p/A → /p/B must drop A's listing and A's open inquiry form; A → B → A must end on A.
    await openPreview(page, SECOND_ID);
    await page.getByRole('button', { name: '게시', exact: true }).click();
    await page.locator('.publish-panel a').first().waitFor({ timeout: 10_000 });
    const hrefB = await page.locator('.publish-panel a').first().getAttribute('href');
    const pathA = new URL(href).pathname;
    const pathB = new URL(hrefB).pathname;
    const go = (path) => page.evaluate((next) => { history.pushState({}, '', next); dispatchEvent(new PopStateEvent('popstate')); }, path);
    await page.goto(href, { waitUntil: 'domcontentloaded' });
    await page.locator('.pl-head h1').waitFor({ timeout: 30_000 });
    const titleA = await page.locator('.pl-head h1').innerText();
    await (tag === 'phone' ? page.locator('.public-mobile-cta') : page.locator('.pl-side')).getByRole('button', { name: '문의하기' }).click();
    await page.getByRole('dialog').getByLabel('이름').fill('전환시험');
    await page.getByRole('dialog').getByLabel('연락처 (전화 또는 이메일)').fill('010-3333-4444');
    await page.getByRole('dialog').getByLabel('개인정보 수집·이용에 동의합니다 (필수)').check();
    await go(pathB);
    await page.waitForFunction((a) => { const h = document.querySelector('.pl-head h1'); return h && h.textContent !== a; }, titleA, { timeout: 15_000 });
    const titleB = await page.locator('.pl-head h1').innerText();
    check(titleB !== titleA && !(await page.locator('body').innerText()).includes(titleA), `${tag} A→B 전환: A 매물 내용이 남지 않음 (${titleA} → ${titleB})`);
    check(await page.getByRole('dialog').count() === 0, `${tag} A→B 전환: A에서 열어 둔 문의창 닫힘(A 내용이 B로 갈 수 없음)`);
    const afterSwitch = await page.evaluate(() => JSON.parse(localStorage.getItem('daon-public-inquiries-v1') || '[]'));
    check(!afterSwitch.some((row) => row.name === '전환시험'), `${tag} A→B 전환: A 문의 내용이 어디에도 접수되지 않음`);
    // Same with a lookup that finds nothing (unknown / withdrawn id): A's form must not survive either.
    await (tag === 'phone' ? page.locator('.public-mobile-cta') : page.locator('.pl-side')).getByRole('button', { name: '문의하기' }).click();
    await page.getByRole('dialog').getByLabel('이름').fill('전환시험');
    await go('/p/00000000-0000-4000-8000-000000000000');
    await page.getByText('게시가 끝났거나 없는 매물입니다').waitFor({ timeout: 15_000 });
    check(await page.getByRole('dialog').count() === 0 && await page.locator('.pl-head').count() === 0, `${tag} B→없는 매물 전환: 이전 매물·문의창 모두 사라짐`);
    await go(pathA); await go(pathB); await go(pathA);
    await page.waitForFunction((a) => document.querySelector('.pl-head h1')?.textContent === a, titleA, { timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(500);
    check(await page.locator('.pl-head h1').innerText() === titleA && page.url().endsWith(pathA), `${tag} A→B→A 빠른 전환: 마지막 주소(A)의 매물만 표시`);
    await openPreview(page);
    await page.getByRole('button', { name: '게시 철회' }).click();
    await page.locator('.publish-status').filter({ hasText: '철회' }).waitFor({ timeout: 10_000 });
    await page.goto(href, { waitUntil: 'domcontentloaded' });
    await page.getByText('게시가 끝났거나 없는 매물입니다').waitFor({ timeout: 15_000 });
    check(await page.locator('.pl-head').count() === 0, `${tag} 철회 후 공개 주소는 매물 내용 없이 '게시 종료' 안내`);
    await page.goto(`${BASE_URL}/p/not-a-real-id`, { waitUntil: 'domcontentloaded' });
    await page.getByText('게시가 끝났거나 없는 매물입니다').waitFor({ timeout: 15_000 });
    check(true, `${tag} 없는 공개 번호는 안내만 표시`);
    check(errors.length === 0, `${tag} 화면 오류 없음${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  } finally {
    await page.evaluate(() => { localStorage.removeItem('daon-public-listings-v1'); localStorage.removeItem('daon-public-inquiries-v1'); }).catch(() => undefined);
    await context.close();
  }
}

try {
  await run({ width: 1440, height: 1000 }, 'pc');
  await run({ width: 390, height: 844 }, 'phone');
  if (failures.length) throw new Error(`${failures.length} check(s) failed: ${failures.join(' / ')}`);
  console.log('Public listing publish smoke: PASS');
} catch (error) {
  console.error('Public listing publish smoke: FAIL');
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
