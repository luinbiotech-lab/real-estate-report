/*
 * Single source of truth for the DA:ON sidebar, breadcrumbs and route coverage checks.
 * Every static route in App.tsx must appear here (scripts/validate-navigation-ia.mjs), so deep links
 * stay reachable from the menu when the information architecture changes.
 */

export type NavIconKey =
  | 'home' | 'search' | 'add' | 'upload' | 'intake' | 'readiness' | 'review' | 'risk'
  | 'report' | 'share' | 'income' | 'interior' | 'spatial' | 'twinIntake' | 'twin' | 'roomOps'
  | 'access' | 'control' | 'agents' | 'backup' | 'migration' | 'settings'
  | 'groupProperty' | 'groupVerify' | 'groupReport' | 'groupAnalysis' | 'groupOps';

export interface NavItem {
  to: string;
  /** Korean-first label shown in the menu and breadcrumbs. */
  title: string;
  /** Optional established module name, shown as secondary text only. */
  module?: string;
  icon: NavIconKey;
}

export interface NavGroup {
  id: string;
  label: string;
  summary: string;
  icon: NavIconKey;
  items: NavItem[];
}

export const primaryNav: NavItem[] = [
  { to: '/', title: '부동산 홈', module: '물건 현황과 다음 작업', icon: 'home' },
  { to: '/discover', title: '주소로 물건 조회', module: '주소·지번으로 건물 먼저 확인', icon: 'search' },
];

export const navGroups: NavGroup[] = [
  { id: 'property', label: '물건 관리', summary: '등록 · 대량 입력', icon: 'groupProperty', items: [
    { to: '/property/new', title: '새 물건 등록', icon: 'add' },
    { to: '/import', title: '엑셀 대량 등록', icon: 'upload' },
    { to: '/bulk-intake', title: '대량 자료 등록 · 검증', module: 'Intake · Verification', icon: 'intake' },
  ]},
  { id: 'verify', label: '자료 · 검증', summary: '준비도 · 검토 · 리스크', icon: 'groupVerify', items: [
    { to: '/readiness', title: '준비도 센터', module: 'Property Readiness', icon: 'readiness' },
    { to: '/review-history', title: '검토 이력 통합', icon: 'review' },
    { to: '/risk', title: '리스크 · 규제 검토', module: 'Risk / Compliance', icon: 'risk' },
  ]},
  { id: 'report', label: '보고서 · 공유', summary: '보고서 이력 · 외부 공유', icon: 'groupReport', items: [
    { to: '/report-history', title: '보고서 버전 이력', icon: 'report' },
    { to: '/external-shares', title: '외부 공유 센터', icon: 'share' },
  ]},
  { id: 'analysis', label: '분석 · 3D', summary: '수익 · 도면 · 공간', icon: 'groupAnalysis', items: [
    { to: '/income', title: '임대 · 수익 분석', icon: 'income' },
    { to: '/digital-twin-intake', title: '도면 · 3D 자료 등록', icon: 'twinIntake' },
    { to: '/digital-twin', title: '디지털 트윈', module: 'Digital Twin', icon: 'twin' },
    { to: '/spatial', title: '공간 분석', module: 'Spatial Workspace', icon: 'spatial' },
    { to: '/interior', title: '실내 자료 분석', module: 'Interior Workspace', icon: 'interior' },
    { to: '/room-ops', title: '공간 운영', module: 'Room Ops', icon: 'roomOps' },
  ]},
  { id: 'ops', label: '운영 · 설정', summary: '권한 · AI 운영 · 백업', icon: 'groupOps', items: [
    { to: '/access', title: '사용자 · 권한 관리', icon: 'access' },
    { to: '/control-center', title: 'AI 에이전트 관제', module: 'A0 Control Center', icon: 'control' },
    { to: '/agents', title: 'AI 운영 상세', module: 'Agent Operations', icon: 'agents' },
    { to: '/backup', title: '데이터 백업 · 복원', icon: 'backup' },
    { to: '/migration-readiness', title: '원격 이관 준비', module: 'Remote Migration', icon: 'migration' },
    { to: '/settings', title: '회사 설정', icon: 'settings' },
  ]},
];

export interface Crumb { label: string; to?: string }

export interface RouteContext {
  crumbs: Crumb[];
  /** Where an explicit "back" control should go for nested pages; undefined for top-level pages. */
  parent?: { label: string; to: string };
  groupId?: string;
}

const HOME: Crumb = { label: '부동산 홈', to: '/' };

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
  if (path === '/') return { crumbs: [] };
  if (path === '/discover') return { crumbs: [HOME, { label: '주소로 물건 조회' }] };
  if (path === '/property/new') return { crumbs: [HOME, { label: '물건 관리' }, { label: '새 물건 등록' }], parent: { label: '부동산 홈', to: '/' }, groupId: 'property' };

  const property = path.match(/^\/property\/([^/]+)(?:\/(data-room|edit))?$/);
  if (property) {
    const id = decodeURIComponent(property[1]);
    const hub: Crumb = { label: '물건 상세', to: `/property/${encodeURIComponent(id)}` };
    if (property[2] === 'data-room') return { crumbs: [HOME, hub, { label: 'Data Room' }], parent: { label: '물건 상세', to: hub.to! }, groupId: 'property' };
    if (property[2] === 'edit') return { crumbs: [HOME, hub, { label: '정보 수정' }], parent: { label: '물건 상세', to: hub.to! }, groupId: 'property' };
    return { crumbs: [HOME, { label: '물건 상세' }], parent: { label: '부동산 홈', to: '/' }, groupId: 'property' };
  }

  const agent = path.match(/^\/agents\/([^/]+)$/);
  if (agent) return { crumbs: [HOME, { label: '운영 · 설정' }, { label: 'AI 운영 상세', to: '/agents' }, { label: '에이전트 작업공간' }], parent: { label: 'AI 운영 상세', to: '/agents' }, groupId: 'ops' };

  const matched = matchItem(path);
  if (matched) return { crumbs: [HOME, { label: matched.group.label }, { label: matched.item.title }], groupId: matched.group.id };
  return { crumbs: [HOME] };
}

/** Static (parameter-free) paths that the menu exposes, used by the route coverage validator. */
export function navigablePaths() {
  return [...primaryNav.map((item) => item.to), ...navGroups.flatMap((group) => group.items.map((item) => item.to))];
}
