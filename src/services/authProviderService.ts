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
    status: 'not_configured',
    description: '부동산 전용 Auth backend 연결 후 실제 로그인·RLS·owner-only 관리를 담당합니다.',
    capabilities: REMOTE_REQUIRED_CAPABILITIES,
  },
] as const;

class NotConfiguredRemoteAuthGateway implements RemoteAuthGateway {
  private unavailable(): never {
    throw new Error('REMOTE AUTH Provider가 아직 연결되지 않았습니다. 부동산 전용 Auth backend가 필요합니다.');
  }

  async getSession(): Promise<AuthSession | null> { return null; }
  async signIn(): Promise<AuthSession> { return this.unavailable(); }
  async signOut(): Promise<void> { this.unavailable(); }
  async inviteUser(): Promise<void> { this.unavailable(); }
  async updateRole(): Promise<void> { this.unavailable(); }
  async setActive(): Promise<void> { this.unavailable(); }
}

export const remoteAuthGateway: RemoteAuthGateway = new NotConfiguredRemoteAuthGateway();
