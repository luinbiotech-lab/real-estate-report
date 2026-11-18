/*
 * Platform explore + public listing preview QA (2026-11-15 platform upgrade).
 * Follows the buyer flow on PC and phone: main → 탐색 → 공개 매물 미리보기, and checks the trust rules on screen:
 * every card has a grade (or says it could not be computed), addresses are masked, values carry badges, nothing is
 * sendable before phase 2, Bangbae 815-11 shows no photo, and the phone layout has no sideways overflow.
 * Reads the local seed only; writes nothing.
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const ARTIFACT_DIR = 'artifacts/agent-qa';
const failures = [];
const check = (ok, label) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failures.push(label); };

await mkdir(ARTIFACT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });

async function run(viewport, tag) {
  const page = await browser.newPage({ viewport });
  const overflow = async () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '검증된 매물 탐색' }).waitFor({ timeout: 30_000 });
  check(await page.getByRole('region', { name: '이용자별 시작' }).count() === 1, `${tag} 메인: 이용자별 시작(매수자·중개사·건물주)`);
  check(await page.getByRole('region', { name: '다른 부동산 사이트와 차이' }).locator('tbody tr').count() === 4, `${tag} 메인: 일반 매물 사이트와 차이 4항목`);
  check(await page.getByText('준비 중', { exact: true }).count() >= 1, `${tag} 메인: 건물주 자료 제출은 준비 중으로 정직하게 표시`);
  await page.locator('.home-graded-list .trust-grade-badge').first().waitFor({ timeout: 30_000 });
  check(await page.locator('.home-graded-list li').count() >= 1, `${tag} 메인: 신뢰 등급 매물 표시`);
  if (tag === 'phone') check(await overflow() <= 1, `${tag} 메인 가로 넘침 없음`);
  await page.screenshot({ path: `${ARTIFACT_DIR}/platform-home-${tag}.png`, fullPage: true });

  await page.getByRole('button', { name: '검증된 매물 탐색' }).click();
  await page.waitForURL('**/explore');
  await page.locator('.explore-card').first().waitFor({ timeout: 30_000 });
  await page.waitForFunction(() => !document.querySelector('.explore-count span'), null, { timeout: 30_000 });
  const cards = await page.locator('.explore-card').evaluateAll((els) => els.map((el) => ({ title: el.querySelector('strong')?.textContent ?? '', badge: el.querySelector('.trust-grade-badge b')?.textContent ?? '' })));
  check(cards.length >= 1, `${tag} 탐색: 매물 카드 ${cards.length}건`);
  check(cards.every((card) => /^[ABCD–]$/.test(card.badge)), `${tag} 탐색: 모든 카드에 등급(또는 확인 불가) 표시 (${cards.map((c) => c.badge).join('')})`);
  check(cards.every((card) => !/\d+-\d+/.test(card.title)), `${tag} 탐색: 카드 제목에 지번 없음 (${cards[0]?.title})`);
  check(await page.getByText('구매자에게는 물건마다').count() === 1, `${tag} 탐색: 내부 미리보기 안내`);
  if (tag === 'phone') {
    check(await page.locator('.bottom-tab.active').innerText() === '탐색', `${tag} 하단 탭 '탐색' 활성`);
    check(await overflow() <= 1, `${tag} 탐색 가로 넘침 없음`);
  } else {
    check(await page.getByRole('navigation', { name: 'DA:ON 주 메뉴' }).getByRole('link', { name: /^탐색/ }).count() === 1, `${tag} PC 메뉴에 탐색`);
  }
  // Grade strip filters exactly that grade.
  const strip = page.locator('.explore-grade-strip button').first();
  const stripCount = Number(await strip.locator('em').innerText());
  await strip.click();
  check(await page.locator('.explore-card').count() === stripCount, `${tag} 탐색: 등급 A 누르면 A만 (${stripCount}건)`);
  await strip.click();
  await page.screenshot({ path: `${ARTIFACT_DIR}/platform-explore-${tag}.png`, fullPage: true });

  await page.locator('.explore-card').first().click();
  await page.waitForURL('**/listing/**');
  await page.getByText('공개 화면 미리보기').first().waitFor({ timeout: 30_000 });
  await page.locator('.listing-trust .trust-criteria, .listing-trust .pl-lead').first().waitFor();
  check(await page.getByRole('navigation', { name: '현재 위치' }).innerText().then((t) => t.includes('공개 매물 미리보기')), `${tag} 미리보기: 위치 표시(홈 › 탐색 › 공개 매물 미리보기)`);
  check(await page.getByRole('button', { name: '문의하기' }).isDisabled() && await page.getByRole('button', { name: '투자 보고서 요청' }).isDisabled(), `${tag} 미리보기: 문의·보고서 요청 비활성(2단계 전)`);
  const badges = await page.locator('.listing-facts .fact-badge').allInnerTexts();
  check(badges.length >= 1 && badges.every((b) => ['공식확인', '중개사 입력', '계산값'].includes(b)), `${tag} 미리보기: 값마다 근거 표시 (${[...new Set(badges)].join('/')})`);
  await page.locator('.checklist-rows li').first().waitFor({ timeout: 30_000 });
  const checklist = await page.locator('.checklist-rows li').count();
  check(checklist >= 7, `${tag} 미리보기: 매수 전 확인표 ${checklist}항목(서류 4·후보값·기본정보·리스크)`);
  check((await page.locator('.listing-market-head').innerText()).length > 0, `${tag} 미리보기: 시세 위치 문장 (${await page.locator('.listing-market-head').innerText()})`);
  const masked = await page.locator('.pl-head h1').innerText();
  await page.getByRole('button', { name: '전체 주소' }).click();
  const full = await page.locator('.pl-head h1').innerText();
  await page.getByRole('button', { name: '구까지' }).click();
  const gu = await page.locator('.pl-head h1').innerText();
  check(full.length >= masked.length && gu.length <= masked.length && !/\d+-\d+/.test(masked), `${tag} 미리보기: 주소 공개 범위 (${gu} / ${masked} / ${full})`);
  await page.getByRole('button', { name: '동·도로명까지' }).click();
  if (tag === 'phone') check(await overflow() <= 1, `${tag} 미리보기 가로 넘침 없음`);
  await page.screenshot({ path: `${ARTIFACT_DIR}/platform-listing-${tag}.png`, fullPage: true });

  // Bangbae 815-11: never a photo on the public page.
  await page.goto(`${BASE_URL}/explore`, { waitUntil: 'domcontentloaded' });
  await page.locator('.explore-card').first().waitFor({ timeout: 30_000 });
  // The seed's address is the road address (동광로18길 7), so the masked card title has no '방배동': find it by id.
  const bangbae = page.locator('a.explore-card[href*="bangbae"]').first();
  if (await bangbae.count()) {
    check(await bangbae.locator('img').count() === 0, `${tag} 방배 815-11 카드 사진 없음`);
    await bangbae.click();
    await page.locator('.listing-photo').waitFor();
    check(await page.locator('.listing-photo img').count() === 0, `${tag} 방배 815-11 공개 화면 사진 없음`);
  } else check(false, `${tag} 방배 815-11 시드 매물을 찾지 못함`);
  await page.close();
}

try {
  await run({ width: 1440, height: 1000 }, 'pc');
  await run({ width: 390, height: 844 }, 'phone');
  if (failures.length) throw new Error(`${failures.length} check(s) failed: ${failures.join(' / ')}`);
  console.log('Platform explore / listing preview QA: PASS');
} catch (error) {
  console.error('Platform explore / listing preview QA: FAIL');
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
