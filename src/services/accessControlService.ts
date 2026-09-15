export type AccessRole = 'owner' | 'admin' | 'editor' | 'viewer';

export type AccessCapability =
  | 'view_data'
  | 'edit_property'
  | 'upload_data'
  | 'verify_data'
  | 'use_analysis'
  | 'create_report_draft'
  | 'finalize_report'
  | 'manage_external_share'
  | 'delete_property'
  | 'manage_company'
  | 'manage_users';

export type AccessProfileStatus = 'active' | 'inactive';

export interface AccessProfile {
  id: string;
  displayName: string;
  role: AccessRole;
  status: AccessProfileStatus;
  source: 'local_policy';
  createdAt: string;
  updatedAt: string;
}

export const AUTH_BACKEND_CONNECTED = false;
export const ACCESS_STORAGE_KEY = 'daon:access-profiles:v1';

export const ROLE_LABELS: Record<AccessRole, string> = {
  owner: 'OWNER',
  admin: 'ADMIN',
  editor: 'EDITOR',
  viewer: 'VIEWER',
};

export const CAPABILITY_LABELS: Record<AccessCapability, string> = {
  view_data: '자료 열람',
  edit_property: '물건 수정',
  upload_data: '자료 등록',
  verify_data: '자료 검증',
  use_analysis: '분석 Workspace 사용',
  create_report_draft: '보고서 Draft 생성',
  finalize_report: '보고서 확정',
  manage_external_share: '외부 공유 관리',
  delete_property: '물건 삭제',
  manage_company: '회사 설정 관리',
  manage_users: '사용자·권한 관리',
};

export const ROLE_CAPABILITIES: Record<AccessRole, readonly AccessCapability[]> = {
  owner: [
    'view_data', 'edit_property', 'upload_data', 'verify_data', 'use_analysis',
    'create_report_draft', 'finalize_report', 'manage_external_share',
    'delete_property', 'manage_company', 'manage_users',
  ],
  admin: [
    'view_data', 'edit_property', 'upload_data', 'verify_data', 'use_analysis',
    'create_report_draft', 'finalize_report', 'manage_external_share',
  ],
  editor: [
    'view_data', 'edit_property', 'upload_data', 'use_analysis', 'create_report_draft',
  ],
  viewer: ['view_data'],
};

const now = () => new Date().toISOString();

function readProfiles(): AccessProfile[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ACCESS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AccessProfile[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeProfiles(rows: AccessProfile[]) {
  if (typeof window !== 'undefined') window.localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(rows));
}

function seedProfiles(): AccessProfile[] {
  const existing = readProfiles();
  if (existing.length) return existing;
  const timestamp = now();
  const seeded: AccessProfile[] = [{
    id: 'local-owner',
    displayName: '로컬 소유자',
    role: 'owner',
    status: 'active',
    source: 'local_policy',
    createdAt: timestamp,
    updatedAt: timestamp,
  }];
  writeProfiles(seeded);
  return seeded;
}

export const accessControlService = {
  listProfiles(): AccessProfile[] {
    return seedProfiles().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  addProfile(displayName: string, role: AccessRole): AccessProfile[] {
    const name = displayName.trim();
    if (!name) throw new Error('사용자 표시명을 입력하세요.');
    const rows = seedProfiles();
    const timestamp = now();
    const next: AccessProfile = {
      id: `local-${crypto.randomUUID()}`,
      displayName: name,
      role,
      status: 'active',
      source: 'local_policy',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const updated = [...rows, next];
    writeProfiles(updated);
    return updated;
  },

  updateRole(id: string, role: AccessRole): AccessProfile[] {
    const rows = seedProfiles();
    const target = rows.find((item) => item.id === id);
    if (!target) throw new Error('권한 프로필을 찾을 수 없습니다.');
    if (target.id === 'local-owner' && role !== 'owner') throw new Error('로컬 소유자 프로필의 OWNER 권한은 해제할 수 없습니다.');
    const updated = rows.map((item) => item.id === id ? { ...item, role, updatedAt: now() } : item);
    writeProfiles(updated);
    return updated;
  },

  setStatus(id: string, status: AccessProfileStatus): AccessProfile[] {
    const rows = seedProfiles();
    const target = rows.find((item) => item.id === id);
    if (!target) throw new Error('권한 프로필을 찾을 수 없습니다.');
    if (target.id === 'local-owner' && status !== 'active') throw new Error('로컬 소유자 프로필은 비활성화할 수 없습니다.');
    const updated = rows.map((item) => item.id === id ? { ...item, status, updatedAt: now() } : item);
    writeProfiles(updated);
    return updated;
  },

  can(role: AccessRole, capability: AccessCapability): boolean {
    return ROLE_CAPABILITIES[role].includes(capability);
  },
};
