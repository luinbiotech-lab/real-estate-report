import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE_URL = process.env.REPORT_QA_BASE_URL || 'http://127.0.0.1:4174';
const ARTIFACT_DIR = 'artifacts/agent-qa';
async function waitForText(page, text, timeout = 30_000) { await page.waitForFunction((expected) => document.body?.innerText.toLowerCase().includes(String(expected).toLowerCase()), text, { timeout }); }
async function verifyPage(page, path, requiredTexts, screenshotName) { await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' }); for (const text of requiredTexts) await waitForText(page, text); await page.screenshot({ path: `${ARTIFACT_DIR}/${screenshotName}.png`, fullPage: true }); console.log(`[PASS] ${path}: ${requiredTexts.join(' | ')}`); }

async function verifyDigitalTwinIntake(page) {
  await page.goto(`${BASE_URL}/digital-twin-intake`, { waitUntil: 'domcontentloaded' }); await waitForText(page, '도면 · 3D · 측정자료 등록');
  const dxf = `0\nSECTION\n2\nENTITIES\n0\nLINE\n8\nWALL\n10\n0\n20\n0\n11\n4\n21\n0\n0\nLINE\n8\nWALL\n10\n4\n20\n0\n11\n4\n21\n3\n0\nENDSEC\n0\nEOF\n`;
  await page.locator('input[type="file"]').setInputFiles({ name: 'qa-floor.dxf', mimeType: 'application/dxf', buffer: Buffer.from(dxf, 'utf8') });
  await waitForText(page, 'qa-floor.dxf 등록 완료'); await waitForText(page, 'Agent 검토 큐 연결'); await waitForText(page, 'qa-floor.dxf');
  await page.screenshot({ path: `${ARTIFACT_DIR}/digital-twin-intake-upload.png`, fullPage: true });
  await page.goto(`${BASE_URL}/digital-twin`, { waitUntil: 'domcontentloaded' }); await waitForText(page, 'Digital Twin Workspace'); await waitForText(page, 'qa-floor.dxf');
  await page.screenshot({ path: `${ARTIFACT_DIR}/digital-twin-intake-handoff.png`, fullPage: true });
  console.log('[PASS] Digital Twin intake: DXF upload → asset persistence → Agent queue → Workspace handoff');
}

async function verifyExternalShareCenter(page) {
  await page.goto(`${BASE_URL}/external-shares`, { waitUntil: 'domcontentloaded' });
  for (const text of ['외부 공유 센터', '전체 공유', 'ACTIVE', 'EXPIRED', 'REVOKED', '미해결 검토', '감사대장 CSV', '감사대장 JSON', '이미 외부에 전달된 standalone HTML 파일은 삭제하거나 원격 차단할 수 없습니다']) await waitForText(page, text);
  await page.getByPlaceholder('물건명 · 주소 · 공유대상 · Snapshot 검색').waitFor({ state: 'visible', timeout: 30_000 });
  await page.screenshot({ path: `${ARTIFACT_DIR}/external-share-center.png`, fullPage: true });
  console.log('[PASS] /external-shares: audit KPIs + CSV/JSON export + revoke boundary + status filter + search input');
}

async function verifyPropertyHub(page) {
  await page.goto(`${BASE_URL}/property/daon-bangbae-815-11`, { waitUntil: 'domcontentloaded' });
  for (const text of ['PROPERTY DETAIL HUB', '방배동 815-11 코너빌딩', 'CORE PROPERTY PROFILE', 'WORKSPACE NAVIGATION', '사진 · 미디어', '문서 · 공적자료', '비교거래', '임대 · 수익 분석', '검토 이력', '보고서', '3D · 도면', '입지 브리핑', 'Data Room 전체보기', '대표 외관 미디어 미연결']) await waitForText(page, text);
  await page.screenshot({ path: `${ARTIFACT_DIR}/bangbae-property-hub.png`, fullPage: true });
  console.log('[PASS] Bangbae property hub: fact-first summary + 8 workspace entry cards + no fabricated hero media');
}

async function verifyBangbaeDataRoom(page) {
  await page.goto(`${BASE_URL}/property/daon-bangbae-815-11/data-room`, { waitUntil: 'domcontentloaded' });
  for (const text of ['방배동 815-11 코너빌딩', '층별 구성 · Data Room', '4개 층', '합계 349.08㎡', '3F', '2F', '1F', 'B1', '제2종근린생활시설(부동산중개업소) + 점포', '다가구용단독주택(1가구)', '외부자료', '방배동 815-11 건축물대장.pdf', '비교거래 요약', '6건', '5,862만/평 ~ 8,788만/평', '2026-06-02', '방배동 실거래사례1년간.pdf', '비교거래 전체 보기']) await waitForText(page, text);
  await page.screenshot({ path: `${ARTIFACT_DIR}/bangbae-data-room-overview.png`, fullPage: true });
  console.log('[PASS] Bangbae Data Room: floor provenance + 6 comparable transactions + market summary rendered');
}

await mkdir(ARTIFACT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true }); const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
try {
  await verifyPage(page, '/control-center', ['Agent Control Center', 'A0 · INTEGRATOR', 'Blocked Agent', '검토 필요 Agent', 'Report Agent', 'Agent Workspace'], 'agent-control-center');
  await verifyPage(page, '/agents/interior-vision', ['A4 · ISOLATED AGENT WORKSPACE', 'Interior Vision Agent', 'Agent Isolation Rule', 'Contract Input → Output', 'Direct Write Owns', 'Forbidden Direct Writes', 'Promotion Rule', 'Safety Boundary'], 'agent-workspace-interior-vision');
  await verifyPage(page, '/agents/digital-twin', ['A7 · ISOLATED AGENT WORKSPACE', 'Digital Twin Agent', 'production candidate ≠ construction-ready ≠ legal BIM'], 'agent-workspace-digital-twin');
  await verifyPage(page, '/agents/report', ['A11 · ISOLATED AGENT WORKSPACE', 'Report Agent', '보류 상태'], 'agent-workspace-report-deferred');
  await verifyPage(page, '/interior', ['Interior Workspace', 'Interior ↔ 3D Room Linking', '추천 연결 후보', 'Room Intelligence View', 'Intelligent rooms', '승인된 설비 인벤토리', '브라우저 로컬 픽셀 분석'], 'interior-workspace');
  await verifyPage(page, '/room-ops', ['Room Twin Operations', 'Digital Twin × Room Intelligence Operations'], 'room-twin-operations');
  await verifyPage(page, '/spatial', ['Spatial Workspace', '공간 자료 Intake', '공간 모델', '리노베이션 검토', 'Digital Twin 준비 자산'], 'spatial-workspace');
  await verifyDigitalTwinIntake(page);
  await verifyPage(page, '/digital-twin', ['Digital Twin Workspace', 'Geometry', '축척', '높이', '공간 경계', '문·창 연결', '개구부 치수', 'Twin 후보 갱신', 'Multi-floor Building Model', 'Building Production Gate / 다층 Candidate Release', 'Building Release & Collaboration Layer', 'Geometry Readiness · Remote Inspection', 'Remote Inspection HTML'], 'digital-twin-workspace');
  await verifyPage(page, '/income?propertyId=daon-bangbae-815-11', ['임대 · 수익 분석', '방배동 815-11 코너빌딩', '시나리오 입력', '수익성 결과', 'NOI', 'Cap Rate', 'Cash-on-Cash', '저장된 시나리오'], 'rental-income-workspace');
  await verifyPage(page, '/review-history?propertyId=daon-bangbae-815-11', ['검토 이력 통합', '방배동 815-11 코너빌딩', '자료 검증', 'Agent Review', '보고서', '외부 검토', 'AUDIT TIMELINE', '시간순 검토 기록'], 'review-history-workspace');
  await verifyExternalShareCenter(page);
  await verifyPropertyHub(page);
  await verifyBangbaeDataRoom(page);
  await verifyPage(page, '/agents', ['Agent Operations', 'Human Review Gate', 'Interior Vision Agent', 'Floor Plan Agent', 'Space Agent', 'Renovation Agent', 'Risk / Compliance Agent'], 'agent-operations');
  await verifyPage(page, '/risk', ['Risk / Compliance Workspace', '사전 점검 실행', '확정 판단'], 'risk-workspace');
  console.log('Rendered core platform + property hub + Data Room + financial/review workspaces smoke QA: PASS');
} catch (error) { await page.screenshot({ path: `${ARTIFACT_DIR}/failure.png`, fullPage: true }); console.error('Rendered modular agent contract architecture smoke QA: FAIL'); console.error(error); throw error; } finally { await browser.close(); }
