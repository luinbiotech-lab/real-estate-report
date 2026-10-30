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
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  // Korean-first operations hub (0afc7e4): headline, KPI labels, live connection chips, three primary actions.
  for (const text of [
    'DA:ON PROPERTY OPERATIONS',
    '물건을 확인하고, 검증하고, 보고합니다.',
    '등록 물건',
    '기본정보 입력',
    '7일 내 변경',
    '매매 물건',
    '인증 연결',
    '외부 공유 연결',
    '주소로 물건 조회',
    '새 물건 등록',
    '자료 검증',
    '물건 관리',
  ]) await waitForText(page, text);
  // Specialist workspaces are behind a collapsed <details>; open it, then every entry point must be visible.
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
  ]) await waitForText(page, text);
  await page.screenshot({ path: `${ARTIFACT_DIR}/portfolio-operations-hub.png`, fullPage: true });

  // IA (Issue #9): Korean domain groups expand to their pages and nested pages show a breadcrumb trail.
  const mainNav = page.getByRole('navigation', { name: 'DA:ON 주 메뉴' });
  for (const group of ['물건 관리', '자료 · 검증', '보고서 · 공유', '분석 · 3D', '운영 · 설정']) await mainNav.getByRole('button', { name: new RegExp(group) }).waitFor({ state: 'visible' });
  await mainNav.getByRole('button', { name: /분석 · 3D/ }).click();
  await mainNav.getByRole('link', { name: '공간 운영' }).click();
  await page.waitForURL(/\/room-ops$/);
  const crumbs = page.getByRole('navigation', { name: '현재 위치' });
  for (const text of ['부동산 홈', '분석 · 3D', '공간 운영']) await crumbs.getByText(text).waitFor({ state: 'visible' });
  await crumbs.getByRole('link', { name: '부동산 홈' }).click();
  await page.waitForURL((url) => url.pathname === '/');

  // Phone width: the closed drawer is off-canvas and inert; the toggle opens it and Escape closes it.
  await page.setViewportSize({ width: 390, height: 844 });
  const drawer = page.locator('#daon-main-drawer');
  // The shell switches to the drawer on a matchMedia change event; give React a moment to re-render after the resize.
  const becameInert = await page.waitForFunction(() => document.querySelector('#daon-main-drawer')?.hasAttribute('inert'), null, { timeout: 5_000 }).then(() => true).catch(() => false);
  if (!becameInert) throw new Error(`닫힌 모바일 메뉴가 키보드 포커스 대상에 남아 있습니다. (inert=${await drawer.getAttribute('inert')}, aria-hidden=${await drawer.getAttribute('aria-hidden')}, width=${await page.evaluate(() => innerWidth)}, mq=${await page.evaluate(() => matchMedia('(max-width: 900px)').matches)})`);
  await page.getByRole('button', { name: '메뉴 열기' }).click();
  await page.getByRole('navigation', { name: 'DA:ON 주 메뉴' }).getByRole('link', { name: '주소로 물건 조회' }).waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('#daon-main-drawer')?.hasAttribute('inert'));
  const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
  if (overflow > 1) throw new Error(`390px 홈 화면이 가로로 ${overflow}px 넘칩니다.`);
  await page.screenshot({ path: `${ARTIFACT_DIR}/portfolio-operations-hub-390.png`, fullPage: true });
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
