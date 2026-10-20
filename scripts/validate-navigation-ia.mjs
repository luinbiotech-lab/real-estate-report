// Information architecture contract (Issue #9):
//  1. every static App route is reachable from the menu (no route silently dropped by an IA change),
//  2. the menu never points at a route that does not exist,
//  3. breadcrumbs/back targets resolve for nested pages,
//  4. user-facing menu titles are Korean-first (English module names only as secondary text),
//  5. the home KPIs exclude explicitly marked sample records.
import { existsSync, mkdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
function loadTypeScript() {
  for (const candidate of ['typescript', '/opt/node-tools/node_modules/typescript']) {
    try { return require(candidate); } catch { /* try next */ }
  }
  throw new Error('typescript 패키지를 찾을 수 없습니다. npm ci 후 실행하세요.');
}
const ts = loadTypeScript();

// Transpile a TS module and its relative TS imports into a temp dir so plain Node can import it (no tsx needed in CI).
async function importTs(entry) {
  const dir = mkdtempSync(join(tmpdir(), 'daon-nav-'));
  const seen = new Map();
  const emit = (path) => {
    const abs = resolve(path);
    if (seen.has(abs)) return seen.get(abs);
    const target = join(dir, relative(process.cwd(), abs).replace(/\.tsx?$/, '.mjs'));
    seen.set(abs, target);
    let code = ts.transpileModule(readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    code = code.replace(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g, (_, spec) => {
      const base = resolve(dirname(abs), spec);
      const source = [base + '.ts', base + '.tsx', join(base, 'index.ts')].find((candidate) => existsSync(candidate));
      if (!source) throw new Error(`import 해석 실패: ${spec} (${path})`);
      const out = emit(source);
      let rel = relative(dirname(target), out).split(sep).join('/');
      if (!rel.startsWith('.')) rel = './' + rel;
      return `from '${rel}'`;
    });
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, code);
    return target;
  };
  try { return await import(pathToFileURL(emit(entry)).href); } finally { rmSync(dir, { recursive: true, force: true }); }
}

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
  if (!context.crumbs.length || context.crumbs[0].to !== '/') throw new Error(`breadcrumb가 홈에서 시작하지 않습니다: ${path}`);
  const last = context.crumbs.at(-1);
  if (!last.label || last.to) throw new Error(`breadcrumb 마지막 항목은 현재 화면이어야 합니다: ${path}`);
}
const expectParent = { '/property/abc/data-room': '/property/abc', '/property/abc/edit': '/property/abc', '/property/abc': '/', '/agents/a1': '/agents', '/property/new': '/' };
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

// The shell must render from the config, keep the drawer out of the tab order when closed, and show breadcrumbs.
for (const marker of ['navGroups.map', 'primaryNav.map', 'resolveRouteContext(location.pathname)', 'inert={drawerHidden}', 'aria-label="현재 위치"', "event.key === 'Escape'"]) {
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
