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

async function openPreview(page) {
  await page.goto(`${BASE_URL}/listing/${SEED_ID}`, { waitUntil: 'domcontentloaded' });
  await page.getByText('공개 화면 미리보기').first().waitFor({ timeout: 30_000 });
  await page.locator('.checklist-rows li').first().waitFor({ timeout: 30_000 });
  await page.locator('.publish-status').filter({ hasNotText: '확인 중' }).first().waitFor({ timeout: 15_000 });
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
