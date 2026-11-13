import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const ARTIFACT_DIR = 'artifacts/agent-qa';

async function waitForText(page, text, timeout = 30_000) {
  await page.waitForFunction((expected) => document.body?.innerText.toLowerCase().includes(String(expected).toLowerCase()), text, { timeout });
}

await mkdir(ARTIFACT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

try {
  // 2026-11-13: the site opens on the main page (소개 · 핵심 가치 · 업무 흐름 · 최근 물건/보고서 · 출처), not straight into the list.
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  for (const name of ['DA:ON 소개', '핵심 가치', '업무 흐름', '최근 물건', '최근 보고서', '데이터 출처와 원칙']) await page.getByRole('region', { name }).waitFor({ state: 'visible' });
  for (const text of ['근거로 확인하고', '주소로 물건 조회', '운영 물건']) await waitForText(page, text);
  await page.screenshot({ path: `${ARTIFACT_DIR}/home-main-page.png`, fullPage: true });

  await page.goto(`${BASE_URL}/properties`, { waitUntil: 'domcontentloaded' });
  // List page: header actions, then either KPIs (real inventory) or the empty-state explanation.
  for (const text of ['물건 관리', '주소 조회', '새 물건']) await waitForText(page, text);
  if (await page.getByText('DA:ON PROPERTY OPERATIONS').count()) throw new Error('홈 상단 영어 배너가 남아 있습니다.');
  await page.getByText(/등록 물건|등록된 실제 운영 물건이 없습니다/).first().waitFor({ state: 'visible' });
  // Specialist workspaces and connection chips are behind a collapsed <details> below the list.
  await page.getByText('전문 업무 전체 보기').click();
  for (const text of [
    '대량 자료 검증',
    '임대 · 수익',
    '검토 이력',
    '외부 공유',
    '보고서 이력',
    '3D · 도면',
    '사용자 · 권한',
    '엑셀 대량 등록',
    '인증 연결',
    '외부 공유 연결',
  ]) await waitForText(page, text);
  await page.screenshot({ path: `${ARTIFACT_DIR}/portfolio-operations-hub.png`, fullPage: true });

  // IA (2026-11-13 rework): work-flow sections 홈/물건/조회/분석/보고서/설정 with their sub-pages visible; 설정 holds admin only.
  const mainNav = page.getByRole('navigation', { name: 'DA:ON 주 메뉴' });
  for (const label of ['홈', '물건', '조회', '분석', '보고서', '설정']) await mainNav.getByRole('link', { name: new RegExp(`^${label}`) }).first().waitFor({ state: 'visible' });
  for (const label of ['새 물건 등록', '엑셀 대량 등록', '리스크 · 규제 검토', '임대 · 수익 분석', '외부 공유 센터', '사용자 · 권한 관리']) await mainNav.getByRole('link', { name: label }).waitFor({ state: 'visible' });
  // Low-frequency screens are folded: 전문 분석 under 분석, 연동 · 운영 under 설정.
  if (await mainNav.getByRole('link', { name: '공간 운영' }).count()) throw new Error('전문 분석 블록이 처음부터 펼쳐져 있습니다.');
  const advancedToggle = mainNav.getByRole('button', { name: /전문 분석/ });
  await advancedToggle.click();
  await page.screenshot({ path: `${ARTIFACT_DIR}/portfolio-pc-menu-open.png` });
  await mainNav.getByRole('link', { name: '공간 운영' }).click();
  await page.waitForURL(/\/room-ops$/);
  if (await advancedToggle.getAttribute('aria-expanded') !== 'true') throw new Error('전문 분석 화면에서는 전문 분석 블록이 펼쳐져 있어야 합니다.');
  const crumbs = page.getByRole('navigation', { name: '현재 위치' });
  for (const text of ['홈', '분석', '전문 분석', '공간 운영']) await crumbs.getByText(text, { exact: true }).waitFor({ state: 'visible' });
  await crumbs.getByRole('link', { name: '홈' }).click();
  await page.waitForURL((url) => url.pathname === '/');
  await page.getByRole('region', { name: 'DA:ON 소개' }).waitFor({ state: 'visible' });
  await page.goto(`${BASE_URL}/properties`, { waitUntil: 'domcontentloaded' });
  await waitForText(page, '물건 관리');

  // Phone width: the closed drawer is off-canvas and inert; the toggle opens it and Escape closes it.
  await page.setViewportSize({ width: 390, height: 844 });
  const drawer = page.locator('#daon-main-drawer');
  // The shell switches to the drawer on a matchMedia change event; give React a moment to re-render after the resize.
  const becameInert = await page.waitForFunction(() => document.querySelector('#daon-main-drawer')?.hasAttribute('inert'), null, { timeout: 5_000 }).then(() => true).catch(() => false);
  if (!becameInert) throw new Error(`닫힌 모바일 메뉴가 키보드 포커스 대상에 남아 있습니다. (inert=${await drawer.getAttribute('inert')}, aria-hidden=${await drawer.getAttribute('aria-hidden')}, width=${await page.evaluate(() => innerWidth)}, mq=${await page.evaluate(() => matchMedia('(max-width: 900px)').matches)})`);
  // Phone home shows cards with a next step instead of the wide table.
  await page.locator('.property-cards li').first().waitFor({ state: 'visible' });
  await page.getByText('다음 할 일').first().waitFor({ state: 'visible' });
  // Bottom tabs (2026-11-13): 홈/물건/조회/보고서/메뉴; 메뉴 opens every section, 설정 last.
  const tabs = page.getByRole('navigation', { name: '하단 메뉴' });
  for (const label of ['홈', '물건', '조회', '보고서', '메뉴']) await tabs.getByText(label, { exact: true }).waitFor({ state: 'visible' });
  await tabs.getByRole('button', { name: '메뉴' }).click();
  for (const label of ['리스크 · 규제 검토', '임대 · 수익 분석', '사용자 · 권한 관리', '데이터 백업 · 복원']) await page.getByRole('navigation', { name: 'DA:ON 주 메뉴' }).getByRole('link', { name: label }).waitFor({ state: 'visible' });
  await page.waitForTimeout(400); // drawer slide-in
  await page.screenshot({ path: `${ARTIFACT_DIR}/portfolio-phone-menu-open.png` });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('#daon-main-drawer')?.hasAttribute('inert'));
  const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
  if (overflow > 1) throw new Error(`390px 홈 화면이 가로로 ${overflow}px 넘칩니다.`);
  await page.screenshot({ path: `${ARTIFACT_DIR}/portfolio-operations-hub-390.png`, fullPage: true });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.getByRole('region', { name: '업무 흐름' }).waitFor({ state: 'visible' });
  const homeOverflow = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
  if (homeOverflow > 1) throw new Error(`390px 메인페이지가 가로로 ${homeOverflow}px 넘칩니다.`);
  await page.screenshot({ path: `${ARTIFACT_DIR}/home-main-page-390.png`, fullPage: true });
  console.log('Rendered portfolio operations hub QA: PASS');
} catch (error) {
  await page.screenshot({ path: `${ARTIFACT_DIR}/portfolio-hub-failure.png`, fullPage: true });
  console.error('Rendered portfolio operations hub QA: FAIL');
  console.log(`::error title=Rendered portfolio hub QA::${String(error?.message || error).split('\n').slice(0, 3).join(' | ').slice(0, 900)}`);
  console.error(error);
  throw error;
} finally {
  await browser.close();
}
