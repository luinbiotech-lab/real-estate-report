/*
 * Single source of truth for the DA:ON sidebar, breadcrumbs and route coverage checks.
 * Every static route in App.tsx must appear here (scripts/validate-navigation-ia.mjs), so deep links
 * stay reachable from the menu when the information architecture changes.
 *
 * 2026-11-13 IA rework (루치오: "이 모든 걸 설정으로 뺐네"): menus follow the work flow
 * 홈 → 물건 → 조회 → 분석 → 보고서 → 설정, the way Redfin / Rightmove / 디스코 / 밸류맵 put
 * search · my items · analysis · reports at the top level and keep only account/admin under settings.
 * '설정' now holds company, users/permissions, backup and integrations only. Low-frequency specialist
 * screens sit in a collapsible '전문 분석' block under 분석, never in 설정.
 */

export type NavIconKey =
  | 'home' | 'list' | 'search' | 'add' | 'upload' | 'intake' | 'readiness' | 'review' | 'risk'
  | 'report' | 'share' | 'income' | 'interior' | 'spatial' | 'twinIntake' | 'twin' | 'roomOps'
  | 'access' | 'control' | 'agents' | 'backup' | 'migration' | 'settings' | 'analysis' | 'menu'
  | 'groupProperty' | 'groupVerify' | 'groupReport' | 'groupAnalysis' | 'groupOps';

export interface NavItem {
  to: string;
  /** Korean-first label shown in the menu and breadcrumbs. */
  title: string;
  /** Optional established module name, shown as secondary text only. */
  module?: string;
  icon: NavIconKey;
}

export type NavGroupId = 'property' | 'analysis' | 'advanced' | 'report' | 'settings' | 'integrations';

export interface NavGroup {
  id: NavGroupId;
  label: string;
  summary: string;
  icon: NavIconKey;
  items: NavItem[];
}

export type SectionId = 'home' | 'property' | 'discover' | 'analysis' | 'report' | 'settings';

/** One top-level menu entry. Its own page + the sub-pages of `group`, plus an optional collapsed block (`advanced`). */
export interface NavSection extends NavItem {
  id: SectionId;
  group?: NavGroupId;
  advanced?: NavGroupId;
}

export const HOME_PATH = '/';
export const PROPERTY_LIST_PATH = '/properties';

/** PC side menu, in work-flow order. Every entry is a real page; sub-pages are listed right under it. */
export const primaryNav: NavSection[] = [
  { id: 'home', to: HOME_PATH, title: '홈', module: '오늘 할 일 · 최근 물건 · 보고서', icon: 'home' },
  { id: 'property', to: PROPERTY_LIST_PATH, title: '물건', module: '목록 · 지도 · 등록', icon: 'list', group: 'property' },
  { id: 'discover', to: '/discover', title: '조회', module: '주소 · 지번 공적자료 조회', icon: 'search' },
  { id: 'analysis', to: '/readiness', title: '분석', module: '준비도 · 리스크 · 수익', icon: 'analysis', group: 'analysis', advanced: 'advanced' },
  { id: 'report', to: '/report-history', title: '보고서', module: '보고서 이력 · 외부 공유', icon: 'report', group: 'report' },
  { id: 'settings', to: '/settings', title: '설정', module: '회사 · 권한 · 백업 · 연동', icon: 'settings', group: 'settings', advanced: 'integrations' },
];

export const navGroups: NavGroup[] = [
  { id: 'property', label: '물건', summary: '등록 · 대량 등록', icon: 'groupProperty', items: [
    { to: '/property/new', title: '새 물건 등록', icon: 'add' },
    { to: '/import', title: '엑셀 대량 등록', icon: 'upload' },
    { to: '/bulk-intake', title: '대량 자료 등록 · 검증', module: 'Intake · Verification', icon: 'intake' },
  ]},
  { id: 'analysis', label: '분석', summary: '리스크 · 수익 · 검토', icon: 'groupVerify', items: [
    { to: '/risk', title: '리스크 · 규제 검토', module: 'Risk / Compliance', icon: 'risk' },
    { to: '/income', title: '임대 · 수익 분석', icon: 'income' },
    { to: '/review-history', title: '검토 이력 통합', icon: 'review' },
  ]},
  { id: 'advanced', label: '전문 분석', summary: '도면 · 3D · 공간 · 실내', icon: 'groupAnalysis', items: [
    { to: '/digital-twin-intake', title: '도면 · 3D 자료 등록', icon: 'twinIntake' },
    { to: '/digital-twin', title: '디지털 트윈', module: 'Digital Twin', icon: 'twin' },
    { to: '/spatial', title: '공간 분석', module: 'Spatial Workspace', icon: 'spatial' },
    { to: '/interior', title: '실내 자료 분석', module: 'Interior Workspace', icon: 'interior' },
    { to: '/room-ops', title: '공간 운영', module: 'Room Ops', icon: 'roomOps' },
  ]},
  { id: 'report', label: '보고서', summary: '외부 공유', icon: 'groupReport', items: [
    { to: '/external-shares', title: '외부 공유 센터', icon: 'share' },
  ]},
  { id: 'settings', label: '설정', summary: '권한 · 백업', icon: 'groupOps', items: [
    { to: '/access', title: '사용자 · 권한 관리', icon: 'access' },
    { to: '/backup', title: '데이터 백업 · 복원', icon: 'backup' },
  ]},
  { id: 'integrations', label: '연동 · 운영', summary: 'AI 운영 · 원격 이관', icon: 'groupOps', items: [
    { to: '/control-center', title: 'AI 에이전트 관제', module: 'A0 Control Center', icon: 'control' },
    { to: '/agents', title: 'AI 운영 상세', module: 'Agent Operations', icon: 'agents' },
    { to: '/migration-readiness', title: '원격 이관 준비', module: 'Remote Migration', icon: 'migration' },
  ]},
];

export const groupById = (id: NavGroupId) => navGroups.find((group) => group.id === id)!;

/** Section that owns a group (전문 분석 → 분석, 연동·운영 → 설정). */
export function sectionOfGroup(groupId: NavGroupId | undefined): SectionId | undefined {
  if (!groupId) return undefined;
  return primaryNav.find((section) => section.group === groupId || section.advanced === groupId)?.id;
}

export type BottomTabKey = 'home' | 'property' | 'discover' | 'report' | 'menu';

/** Mobile bottom tabs (Redfin/Rightmove app pattern): 홈 / 물건 / 조회 / 보고서 / 메뉴. 메뉴 opens every section, 설정 last. */
export const bottomTabs: { key: BottomTabKey; label: string; to?: string; icon: NavIconKey }[] = [
  { key: 'home', label: '홈', to: HOME_PATH, icon: 'home' },
  { key: 'property', label: '물건', to: PROPERTY_LIST_PATH, icon: 'list' },
  { key: 'discover', label: '조회', to: '/discover', icon: 'search' },
  { key: 'report', label: '보고서', to: '/report-history', icon: 'report' },
  { key: 'menu', label: '메뉴', icon: 'menu' },
];

export interface Crumb { label: string; to?: string }

export interface RouteContext {
  crumbs: Crumb[];
  /** Where an explicit "back" control should go for nested pages; undefined for top-level pages. */
  parent?: { label: string; to: string };
  groupId?: NavGroupId;
  sectionId: SectionId;
}

const HOME: Crumb = { label: '홈', to: HOME_PATH };
const LIST: Crumb = { label: '물건 목록', to: PROPERTY_LIST_PATH };

function matchItem(pathname: string) {
  for (const group of navGroups) {
    const item = group.items.find((entry) => pathname === entry.to || pathname.startsWith(entry.to + '/'));
    if (item) return { group, item };
  }
  return undefined;
}

/** Breadcrumbs for the app shell. Pure function so the IA validator can exercise it without a browser. */
export function resolveRouteContext(pathname: string): RouteContext {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === HOME_PATH) return { crumbs: [], sectionId: 'home' };
  const section = primaryNav.find((entry) => entry.to === path);
  if (section) return { crumbs: [HOME, { label: section.id === 'property' ? '물건 목록' : section.id === 'discover' ? '주소로 물건 조회' : section.id === 'analysis' ? '준비도 센터' : section.id === 'settings' ? '회사 설정' : section.title }], sectionId: section.id, groupId: section.group };

  const property = path.match(/^\/property\/([^/]+)(?:\/(data-room|edit))?$/);
  if (property && property[1] !== 'new') {
    const id = decodeURIComponent(property[1]);
    const hub: Crumb = { label: '물건 상세', to: `/property/${encodeURIComponent(id)}` };
    if (property[2] === 'edit') return { crumbs: [HOME, LIST, hub, { label: '정보 수정' }], parent: { label: '물건 상세', to: hub.to! }, groupId: 'property', sectionId: 'property' };
    return { crumbs: [HOME, LIST, { label: '물건 상세' }], parent: { label: '물건 목록', to: PROPERTY_LIST_PATH }, groupId: 'property', sectionId: 'property' };
  }
  if (path === '/property/new') return { crumbs: [HOME, LIST, { label: '새 물건 등록' }], parent: { label: '물건 목록', to: PROPERTY_LIST_PATH }, groupId: 'property', sectionId: 'property' };

  const agent = path.match(/^\/agents\/([^/]+)$/);
  if (agent) return { crumbs: [HOME, { label: '설정', to: '/settings' }, { label: 'AI 운영 상세', to: '/agents' }, { label: '에이전트 작업공간' }], parent: { label: 'AI 운영 상세', to: '/agents' }, groupId: 'integrations', sectionId: 'settings' };

  const matched = matchItem(path);
  if (matched) {
    const owner = primaryNav.find((entry) => entry.id === sectionOfGroup(matched.group.id))!;
    const trail: Crumb[] = [HOME, { label: owner.title, to: owner.to }];
    if (matched.group.id === 'advanced' || matched.group.id === 'integrations') trail.push({ label: matched.group.label });
    return { crumbs: [...trail, { label: matched.item.title }], groupId: matched.group.id, sectionId: owner.id };
  }
  return { crumbs: [HOME], sectionId: 'home' };
}

/** Which bottom tab is highlighted for a path. Screens without their own tab light 메뉴. */
export function bottomTabOf(pathname: string): BottomTabKey {
  const { sectionId } = resolveRouteContext(pathname);
  if (sectionId === 'home' || sectionId === 'property' || sectionId === 'discover' || sectionId === 'report') return sectionId;
  return 'menu';
}

/** Static (parameter-free) paths that the menu exposes, used by the route coverage validator. */
export function navigablePaths() {
  return [...primaryNav.map((item) => item.to), ...navGroups.flatMap((group) => group.items.map((item) => item.to))];
}
