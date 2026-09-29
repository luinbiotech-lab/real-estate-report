import { createSupabaseRemoteAuthGateway } from './supabaseRemoteAuthGateway';
import { DAON_REMOTE_AUTH_FUNCTION, DAON_SUPABASE_PROJECT_URL, DAON_SUPABASE_PUBLISHABLE_KEY } from './supabaseProductionConfig';
import type { AccessRole } from './accessControlService';

export type AuthProviderKind = 'local_policy' | 'remote_auth';
export type AuthProviderStatus = 'ready' | 'not_configured';

export interface AuthProviderCapabilities {
  authenticatedSession: boolean;
  userInvitation: boolean;
  persistentProfile: boolean;
  rlsEnforcement: boolean;
  ownerOnlyAdministration: boolean;
  multiDevicePersistence: boolean;
}

export interface AuthProviderSummary {
  kind: AuthProviderKind;
  label: string;
  status: AuthProviderStatus;
  description: string;
  capabilities: AuthProviderCapabilities;
}

export interface AuthSession {
  userId: string;
  email?: string;
  displayName?: string;
  role: AccessRole;
}

export interface RemoteAuthGateway {
  getSession(): Promise<AuthSession | null>;
  signIn(email: string, password: string): Promise<AuthSession>;
  signOut(): Promise<void>;
  inviteUser(email: string, role: AccessRole, displayName?: string): Promise<void>;
  updateRole(userId: string, role: AccessRole): Promise<void>;
  setActive(userId: string, active: boolean): Promise<void>;
}

const LOCAL_CAPABILITIES: AuthProviderCapabilities = {
  authenticatedSession: false,
  userInvitation: false,
  persistentProfile: false,
  rlsEnforcement: false,
  ownerOnlyAdministration: false,
  multiDevicePersistence: false,
};

const REMOTE_REQUIRED_CAPABILITIES: AuthProviderCapabilities = {
  authenticatedSession: true,
  userInvitation: true,
  persistentProfile: true,
  rlsEnforcement: true,
  ownerOnlyAdministration: true,
  multiDevicePersistence: true,
};

export const AUTH_PROVIDER_SUMMARIES: readonly AuthProviderSummary[] = [
  {
    kind: 'local_policy',
    label: 'LOCAL POLICY',
    status: 'ready',
    description: '브라우저에서 역할표와 테스트 프로필을 관리합니다. 실제 인증 보안 경계는 아닙니다.',
    capabilities: LOCAL_CAPABILITIES,
  },
  {
    kind: 'remote_auth',
    label: 'REMOTE AUTH',
    status: 'ready',
    description: '부동산 전용 Supabase Auth/RLS production backend에 연결되어 실제 로그인·서버 프로필·owner-only 관리를 담당합니다.',
    capabilities: REMOTE_REQUIRED_CAPABILITIES,
  },
] as const;

export const remoteAuthGateway = createSupabaseRemoteAuthGateway({
  projectUrl: DAON_SUPABASE_PROJECT_URL,
  anonKey: DAON_SUPABASE_PUBLISHABLE_KEY,
  adminFunctionName: DAON_REMOTE_AUTH_FUNCTION,
});
