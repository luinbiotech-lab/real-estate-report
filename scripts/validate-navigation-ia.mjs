// Information architecture contract (Issue #9):
//  1. every static App route is reachable from the menu (no route silently dropped by an IA change),
//  2. the menu never points at a route that does not exist,
//  3. breadcrumbs/back targets resolve for nested pages,
//  4. user-facing menu titles are Korean-first (English module names only as secondary text),
//  5. the home KPIs exclude explicitly marked sample records.
import { readFileSync } from 'node:fs';

import { importTs } from './lib/ts-module-loader.mjs';

const app = readFileSync('src/App.tsx', 'utf8');
const layout = readFileSync('src/components/Layout.tsx', 'utf8');
const nav = await importTs('src/navigation/navConfig.ts');
const sample = await importTs('src/domain/sampleProperty.ts');

// Routes nested under <Layout> (the app shell). Standalone document routes (document/, briefing, snapshot) are entered from a property, not the menu.
const shellBlock = app.slice(app.indexOf('<Route element={<Layout />}>'), app.indexOf('</Route>', app.indexOf('<Route element={<Layout />}>')));
const shellPaths = ['/', ...[...shellBlock.matchAll(/<Route path="([^"]+)"/g)].map((m) => '/' + m[1])];
if (shellPaths.length < 20) throw new Error(`App shell route 파싱 실패: ${shellPaths.length}개`);
const staticPaths = shellPaths.filter((path) => !path.includes(':'));
const dynamicPaths = shellPaths.filter((path) => path.includes(':'));

const menuPaths = nav.navigablePaths();
const duplicates = menuPaths.filter((path, index) => menuPaths.indexOf(path) !== index);
if (duplicates.length) throw new Error(`메뉴에 같은 경로가 중복되었습니다: ${duplicates.join(', ')}`);
const unreachable = staticPaths.filter((path) => !menuPaths.includes(path));
if (unreachable.length) throw new Error(`메뉴에서 도달할 수 없는 화면이 있습니다: ${unreachable.join(', ')}`);
const dangling = menuPaths.filter((path) => !staticPaths.includes(path));
if (dangling.length) throw new Error(`존재하지 않는 경로를 가리키는 메뉴가 있습니다: ${dangling.join(', ')}`);

// Every menu entry and every dynamic shell route must produce a breadcrumb trail rooted at home.
const samples = { '/property/:id': '/property/abc', '/property/:id/data-room': '/property/abc/data-room', '/property/:id/edit': '/property/abc/edit', '/agents/:agentId': '/agents/a1' };
for (const path of dynamicPaths) if (!samples[path]) throw new Error(`새 동적 경로의 breadcrumb 기대값이 없습니다: ${path}`);
for (const path of [...menuPaths.filter((p) => p !== '/'), ...Object.values(samples)]) {
  const context = nav.resolveRouteContext(path);
  if (!context.crumbs.length || context.crumbs[0].to !== '/' || context.crumbs[0].label !== '홈') throw new Error(`breadcrumb가 홈에서 시작하지 않습니다: ${path}`);
  const last = context.crumbs.at(-1);
  if (!last.label || last.to) throw new Error(`breadcrumb 마지막 항목은 현재 화면이어야 합니다: ${path}`);
}
const expectParent = { '/property/abc/data-room': '/properties', '/property/abc/edit': '/property/abc', '/property/abc': '/properties', '/agents/a1': '/agents', '/property/new': '/properties' };
for (const [path, parent] of Object.entries(expectParent)) {
  const actual = nav.resolveRouteContext(path).parent?.to;
  if (actual !== parent) throw new Error(`뒤로가기 대상 불일치: ${path} → ${actual} (기대 ${parent})`);
}
if (nav.resolveRouteContext('/property/new').crumbs.some((crumb) => crumb.label === '물건 상세')) throw new Error('/property/new 가 물건 상세로 해석되면 안 됩니다.');
if (nav.resolveRouteContext('/').crumbs.length !== 0) throw new Error('홈에는 breadcrumb를 표시하지 않습니다.');

// Korean-first titles: each visible title must contain Hangul (English module names belong in `module`).
for (const item of [...nav.primaryNav, ...nav.navGroups.flatMap((group) => group.items)]) {
  if (!/[가-힣]/.test(item.title)) throw new Error(`메뉴 제목은 한국어 우선이어야 합니다: ${item.title}`);
}
for (const group of nav.navGroups) if (!/[가-힣]/.test(group.label)) throw new Error(`메뉴 그룹명은 한국어여야 합니다: ${group.label}`);
if (nav.navGroups.length > 6) throw new Error(`메뉴 그룹은 6개 이하로 유지합니다: ${nav.navGroups.length}`);

// 2026-11-13 IA rework (루치오: "이 모든 걸 설정으로 뺐네"): work-flow sections, 설정 = admin only.
if (!app.includes('<Route index element={<HomePage />} />') || !app.includes('<Route path="properties" element={<PropertyList />} />')) throw new Error('첫 화면은 사이트 메인(HomePage), 물건 목록은 /properties 여야 합니다.');
if (nav.primaryNav.map((item) => `${item.title}:${item.to}`).join('|') !== '홈:/|물건:/properties|조회:/discover|분석:/readiness|보고서:/report-history|설정:/settings') throw new Error(`PC 주 메뉴는 홈/물건/조회/분석/보고서/설정 업무 흐름 순서여야 합니다: ${nav.primaryNav.map((item) => item.title).join('/')}`);
const groupPaths = (id) => nav.navGroups.find((group) => group.id === id)?.items.map((item) => item.to) ?? [];
const expectGroups = {
  property: ['/property/new', '/import', '/bulk-intake'],
  analysis: ['/risk', '/income', '/review-history'],
  advanced: ['/digital-twin-intake', '/digital-twin', '/spatial', '/interior', '/room-ops'],
  report: ['/external-shares'],
  settings: ['/access', '/backup'],
  integrations: ['/control-center', '/agents', '/migration-readiness'],
};
for (const [id, paths] of Object.entries(expectGroups)) if (groupPaths(id).join('|') !== paths.join('|')) throw new Error(`메뉴 그룹 구성 불일치: ${id} → ${groupPaths(id).join(', ')}`);
// 설정 must not hold work screens again (the defect this rework fixes).
const settingsReach = [...groupPaths('settings'), ...groupPaths('integrations'), '/settings'];
for (const work of [...expectGroups.property, ...expectGroups.analysis, ...expectGroups.advanced, ...expectGroups.report, '/readiness', '/discover', '/report-history']) if (settingsReach.includes(work)) throw new Error(`업무 화면이 설정에 들어가 있습니다: ${work}`);
const sectionOf = Object.fromEntries(nav.primaryNav.map((section) => [section.id, section]));
if (sectionOf.analysis.advanced !== 'advanced' || sectionOf.settings.advanced !== 'integrations') throw new Error('전문 분석은 분석 아래, 연동·운영은 설정 아래 접힘 블록이어야 합니다.');
const expectSection = { '/': 'home', '/properties': 'property', '/property/abc': 'property', '/property/new': 'property', '/import': 'property', '/discover': 'discover', '/readiness': 'analysis', '/risk': 'analysis', '/digital-twin': 'analysis', '/room-ops': 'analysis', '/report-history': 'report', '/external-shares': 'report', '/settings': 'settings', '/access': 'settings', '/control-center': 'settings', '/agents/a1': 'settings' };
for (const [path, id] of Object.entries(expectSection)) if (nav.resolveRouteContext(path).sectionId !== id) throw new Error(`메뉴 영역 판정 불일치: ${path} → ${nav.resolveRouteContext(path).sectionId} (기대 ${id})`);
const riskCrumbs = nav.resolveRouteContext('/digital-twin').crumbs.map((crumb) => crumb.label).join('>');
if (riskCrumbs !== '홈>분석>전문 분석>디지털 트윈') throw new Error(`전문 분석 breadcrumb 불일치: ${riskCrumbs}`);

// Phone bottom tabs: 홈/물건/조회/보고서/메뉴; screens without their own tab light 메뉴.
if (nav.bottomTabs.map((tab) => tab.label).join('/') !== '홈/물건/조회/보고서/메뉴') throw new Error(`하단 탭은 홈/물건/조회/보고서/메뉴여야 합니다: ${nav.bottomTabs.map((tab) => tab.label).join('/')}`);
const expectTab = { '/': 'home', '/properties': 'property', '/property/abc': 'property', '/property/new': 'property', '/import': 'property', '/bulk-intake': 'property', '/discover': 'discover', '/report-history': 'report', '/external-shares': 'report', '/risk': 'menu', '/digital-twin': 'menu', '/readiness': 'menu', '/settings': 'menu', '/access': 'menu', '/agents/a1': 'menu' };
for (const [path, tab] of Object.entries(expectTab)) if (nav.bottomTabOf(path) !== tab) throw new Error(`하단 탭 매핑 불일치: ${path} → ${nav.bottomTabOf(path)} (기대 ${tab})`);
for (const marker of ['bottomTabs.map', 'className="bottom-tabs"', 'aria-label="하단 메뉴"', 'primaryNav.map(renderSection)', 'side-advanced-toggle', 'aria-controls={`side-advanced-${advanced.id}`}']) if (!layout.includes(marker)) throw new Error(`메뉴 계약 누락: ${marker}`);
const home = readFileSync('src/pages/HomePage.tsx', 'utf8');
for (const marker of ['aria-label="DA:ON 소개"', 'aria-label="핵심 가치"', 'aria-label="업무 흐름"', 'aria-label="최근 물건"', 'aria-label="최근 보고서"', 'aria-label="데이터 출처와 원칙"', 'splitSampleProperties(items)', 'refreshProxyStatus()']) if (!home.includes(marker)) throw new Error(`메인페이지 구성 누락: ${marker}`);
if (/검증됨|연결 완료/.test(home.slice(home.indexOf('function sourceRows'), home.indexOf('export default')))) throw new Error('키 설정 여부를 실제 검증 완료처럼 표시하면 안 됩니다.');

// The shell must render from the config, keep the drawer out of the tab order when closed, and show breadcrumbs.
for (const marker of ['primaryNav.map', 'resolveRouteContext(location.pathname)', 'inert={drawerHidden}', 'aria-label="현재 위치"', "event.key === 'Escape'"]) {
  if (!layout.includes(marker)) throw new Error(`Layout IA 계약 누락: ${marker}`);
}

// Record provenance classification: explicit metadata first, legacy markers only for records without it (Issue #9/#12).
const cases = [
  // Legacy records (no recordClass) — migration compatibility, no data rewrite needed.
  [{ id: 'sample-bangbae-815-11', propertyNumber: 'SAMPLE-BB-815-11' }, 'sample', 'legacy-id-prefix'],
  [{ id: 'p-1', propertyNumber: 'SAMPLE-X' }, 'sample', 'legacy-number-prefix'],
  // Reproduction of the PR #14 (52c251a) defect: the local QA bootstrap seed has no marker and was counted as real inventory.
  [{ id: 'daon-bangbae-815-11', propertyNumber: '방배동 815-11' }, 'sample', 'local-bootstrap-seed'],
  [{ id: 'sample-seongsu', propertyNumber: 'SS-2026-001' }, 'sample', 'legacy-id-prefix'],
  [{ id: 'p-2', propertyNumber: '' }, 'operational', 'default'],
  [{ id: 'resample-1', propertyNumber: 'X-SAMPLE' }, 'operational', 'default'],
  // Explicit metadata wins in both directions.
  [{ id: 'sample-bangbae-815-11', propertyNumber: 'SAMPLE-BB-815-11', recordClass: 'operational' }, 'operational', 'explicit'],
  [{ id: 'p-3', propertyNumber: 'DA-3', recordClass: 'qa_fixture' }, 'qa_fixture', 'explicit'],
  [{ id: 'p-4', propertyNumber: 'DA-4', recordClass: 'sample' }, 'sample', 'explicit'],
  // Unknown explicit values never silently promote a record; legacy rules apply and the bad value is reported.
  [{ id: 'sample-x', propertyNumber: '', recordClass: 'real' }, 'sample', 'legacy-id-prefix'],
  [{ id: 'p-5', propertyNumber: '', recordClass: 'real' }, 'operational', 'default'],
  [{ id: 'p-6', propertyNumber: '', recordClass: '' }, 'operational', 'default'],
];
for (const [input, expectedClass, expectedBasis] of cases) {
  const result = sample.classifyPropertyRecord(input);
  if (result.recordClass !== expectedClass || result.basis !== expectedBasis) throw new Error(`레코드 분류 오류: ${JSON.stringify(input)} → ${JSON.stringify(result)} (기대 ${expectedClass}/${expectedBasis})`);
  if (input.recordClass === 'real' && result.invalidExplicitValue !== 'real') throw new Error('알 수 없는 recordClass 값은 보고되어야 합니다.');
  if (sample.isSampleProperty(input) !== (expectedClass !== 'operational')) throw new Error(`isSampleProperty 불일치: ${JSON.stringify(input)}`);
}
const split = sample.splitSampleProperties(cases.map(([input]) => input));
if (split.real.length + split.samples.length !== cases.length || split.real.some((item) => sample.isSampleProperty(item))) throw new Error('splitSampleProperties가 레코드를 잃거나 잘못 분류했습니다.');
const identity = await importTs('src/domain/propertyDataRoom/bangbaeIdentity.ts');
if (!sample.LOCAL_BOOTSTRAP_SEED_IDS.includes(identity.BANGBAE_815_11_LEGACY_LOCAL_PROPERTY_ID)) throw new Error('로컬 방배동 seed ID가 샘플 목록에 없습니다.');
if (sample.LOCAL_BOOTSTRAP_SEED_IDS.includes(identity.BANGBAE_815_11_PRODUCTION_PROPERTY_ID)) throw new Error('Production 방배동 ID를 로컬 seed 목록으로 하드코딩하지 마세요(분류는 표식/metadata로).');
const bootstrap = readFileSync('src/services/localBootstrapService.ts', 'utf8');
if ((bootstrap.match(/recordClass: 'sample', recordClassSource: 'local-bootstrap'/g) ?? []).length < 2) throw new Error('로컬 bootstrap seed는 생성 시 recordClass를 명시해야 합니다.');
const types = readFileSync('src/types.ts', 'utf8');
if (!types.includes('recordClass?: PropertyRecordClass;')) throw new Error('recordClass는 하위 호환을 위해 optional이어야 합니다.');
const hub = readFileSync('src/components/PortfolioOperationsHub.tsx', 'utf8');
if (!hub.includes('splitSampleProperties(items)') || !hub.includes('total: realItems.length')) throw new Error('홈 KPI는 샘플을 제외한 실제 물건 기준이어야 합니다.');
if (!hub.includes("loadState === 'loading'") || !hub.includes("loadState === 'error'")) throw new Error('홈은 로딩/오류 상태를 빈 목록과 구분해야 합니다.');

console.log(`Navigation IA validation passed (${staticPaths.length} static routes reachable, ${dynamicPaths.length} nested routes with breadcrumbs).`);
