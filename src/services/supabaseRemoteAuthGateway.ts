import type { AccessRole } from './accessControlService';
import type { AuthSession, RemoteAuthGateway } from './authProviderService';

export interface RemoteAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
}

export interface RemoteAuthTokenStore {
  get(): Promise<RemoteAuthTokens | null>;
  set(tokens: RemoteAuthTokens): Promise<void>;
  clear(): Promise<void>;
}

export interface RemoteAuthProfile extends AuthSession {
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupabaseRemoteAuthGatewayConfig {
  projectUrl: string;
  anonKey: string;
  tokenStore?: RemoteAuthTokenStore;
  fetchImpl?: typeof fetch;
  adminFunctionName?: string;
}

interface JsonObject { [key: string]: unknown }

class MemoryRemoteAuthTokenStore implements RemoteAuthTokenStore {
  private tokens: RemoteAuthTokens | null = null;
  async get() { return this.tokens ? { ...this.tokens } : null; }
  async set(tokens: RemoteAuthTokens) { this.tokens = { ...tokens }; }
  async clear() { this.tokens = null; }
}

export function createMemoryRemoteAuthTokenStore(): RemoteAuthTokenStore {
  return new MemoryRemoteAuthTokenStore();
}

function cleanProjectUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) throw new Error('Supabase project URL이 필요합니다.');
  const url = new URL(trimmed);
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('Supabase project URL은 HTTPS여야 합니다. localhost만 HTTP를 허용합니다.');
  if (url.username || url.password || url.search || url.hash) throw new Error('Supabase project URL에 credential/query/hash를 포함할 수 없습니다.');
  return url.origin;
}

function browserSafeAnonKey(value: string) {
  const key = value.trim();
  if (!key) throw new Error('Supabase public anon key가 필요합니다.');
  if (/service[_-]?role/i.test(key)) throw new Error('service_role credential은 browser Auth adapter에 사용할 수 없습니다.');
  return key;
}

function jsonObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function role(value: unknown): AccessRole {
  return value === 'owner' || value === 'admin' || value === 'editor' || value === 'viewer' ? value : 'viewer';
}

function profileToSession(row: JsonObject): RemoteAuthProfile {
  const active = row.is_active === true;
  return {
    userId: String(row.user_id ?? ''),
    email: typeof row.email === 'string' ? row.email : undefined,
    displayName: typeof row.display_name === 'string' ? row.display_name : undefined,
    role: role(row.role),
    active,
    createdAt: typeof row.created_at === 'string' ? row.created_at : undefined,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : undefined,
  };
}

function tokenResponse(value: unknown): RemoteAuthTokens {
  const row = jsonObject(value);
  const accessToken = typeof row.access_token === 'string' ? row.access_token : '';
  const refreshToken = typeof row.refresh_token === 'string' ? row.refresh_token : '';
  if (!accessToken || !refreshToken) throw new Error('REMOTE AUTH token 응답이 올바르지 않습니다.');
  const expiresIn = typeof row.expires_in === 'number' ? row.expires_in : undefined;
  return {
    accessToken,
    refreshToken,
    expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
  };
}

export class SupabaseRemoteAuthGateway implements RemoteAuthGateway {
  private readonly projectUrl: string;
  private readonly anonKey: string;
  private readonly tokenStore: RemoteAuthTokenStore;
  private readonly fetchImpl: typeof fetch;
  private readonly adminFunctionName: string;

  constructor(config: SupabaseRemoteAuthGatewayConfig) {
    this.projectUrl = cleanProjectUrl(config.projectUrl);
    this.anonKey = browserSafeAnonKey(config.anonKey);
    this.tokenStore = config.tokenStore ?? createMemoryRemoteAuthTokenStore();
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.adminFunctionName = config.adminFunctionName?.trim() || 'remote-auth-admin';
    if (!/^[A-Za-z0-9_-]+$/.test(this.adminFunctionName)) throw new Error('유효하지 않은 Auth admin function name입니다.');
  }

  private async request(path: string, init: RequestInit = {}, accessToken?: string) {
    const headers = new Headers(init.headers);
    headers.set('apikey', this.anonKey);
    headers.set('Content-Type', 'application/json');
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    const response = await this.fetchImpl(`${this.projectUrl}${path}`, { ...init, headers, cache: 'no-store' });
    const text = await response.text();
    let payload: unknown = undefined;
    if (text) {
      try { payload = JSON.parse(text); } catch { payload = text; }
    }
    if (!response.ok) {
      const row = jsonObject(payload);
      const detail = typeof row.error_description === 'string' ? row.error_description
        : typeof row.msg === 'string' ? row.msg
          : typeof row.error === 'string' ? row.error
            : typeof row.message === 'string' ? row.message
              : '';
      throw new Error(`REMOTE AUTH 요청 실패 (${response.status})${detail ? `: ${detail}` : ''}`);
    }
    return payload;
  }

  private async refresh(tokens: RemoteAuthTokens) {
    const payload = await this.request('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: tokens.refreshToken }),
    });
    const next = tokenResponse(payload);
    await this.tokenStore.set(next);
    return next;
  }

  private async userIdFor(tokens: RemoteAuthTokens) {
    try {
      const payload = jsonObject(await this.request('/auth/v1/user', { method: 'GET' }, tokens.accessToken));
      return { userId: String(payload.id ?? ''), tokens };
    } catch {
      const refreshed = await this.refresh(tokens);
      const payload = jsonObject(await this.request('/auth/v1/user', { method: 'GET' }, refreshed.accessToken));
      return { userId: String(payload.id ?? ''), tokens: refreshed };
    }
  }

  private async loadProfile(userId: string, accessToken: string): Promise<RemoteAuthProfile> {
    if (!userId) throw new Error('REMOTE AUTH user id가 없습니다.');
    const params = new URLSearchParams({
      select: 'user_id,email,display_name,role,is_active,created_at,updated_at',
      user_id: `eq.${userId}`,
      limit: '1',
    });
    const payload = await this.request(`/rest/v1/profiles?${params.toString()}`, { method: 'GET' }, accessToken);
    const rows = Array.isArray(payload) ? payload.map(jsonObject) : [];
    if (!rows.length) throw new Error('REMOTE AUTH profile을 찾을 수 없습니다.');
    const profile = profileToSession(rows[0]);
    if (!profile.active) throw new Error('비활성화된 REMOTE AUTH 사용자입니다.');
    return profile;
  }

  async getSession(): Promise<AuthSession | null> {
    const stored = await this.tokenStore.get();
    if (!stored) return null;
    try {
      const resolved = await this.userIdFor(stored);
      return await this.loadProfile(resolved.userId, resolved.tokens.accessToken);
    } catch {
      await this.tokenStore.clear();
      return null;
    }
  }

  async signIn(email: string, password: string): Promise<AuthSession> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) throw new Error('이메일과 비밀번호를 입력하세요.');
    const payload = await this.request('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email: normalizedEmail, password }),
    });
    const tokens = tokenResponse(payload);
    await this.tokenStore.set(tokens);
    try {
      const response = jsonObject(payload);
      const user = jsonObject(response.user);
      const userId = String(user.id ?? '');
      return await this.loadProfile(userId, tokens.accessToken);
    } catch (error) {
      await this.tokenStore.clear();
      throw error;
    }
  }

  async signOut(): Promise<void> {
    const tokens = await this.tokenStore.get();
    try {
      if (tokens?.accessToken) await this.request('/auth/v1/logout', { method: 'POST', body: '{}' }, tokens.accessToken);
    } finally {
      await this.tokenStore.clear();
    }
  }

  private async adminAction(body: JsonObject) {
    const stored = await this.tokenStore.get();
    if (!stored) throw new Error('REMOTE AUTH 로그인이 필요합니다.');
    const resolved = await this.userIdFor(stored);
    return this.request(`/functions/v1/${this.adminFunctionName}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }, resolved.tokens.accessToken);
  }

  async inviteUser(email: string, roleValue: AccessRole, displayName?: string): Promise<void> {
    await this.adminAction({ action: 'invite_user', email: email.trim().toLowerCase(), role: roleValue, displayName: displayName?.trim() ?? '' });
  }

  async updateRole(userId: string, roleValue: AccessRole): Promise<void> {
    await this.adminAction({ action: 'update_role', userId, role: roleValue });
  }

  async setActive(userId: string, active: boolean): Promise<void> {
    await this.adminAction({ action: 'set_active', userId, active });
  }

  async bootstrapOwner(bootstrapKey: string): Promise<RemoteAuthProfile> {
    const payload = jsonObject(await this.adminAction({ action: 'bootstrap_owner', bootstrapKey }));
    return profileToSession(jsonObject(payload.profile));
  }

  async listProfiles(): Promise<RemoteAuthProfile[]> {
    const payload = jsonObject(await this.adminAction({ action: 'list_profiles' }));
    return Array.isArray(payload.profiles) ? payload.profiles.map((row) => profileToSession(jsonObject(row))) : [];
  }

  async getAccessToken(): Promise<string | null> {
    const tokens = await this.tokenStore.get();
    if (!tokens) return null;
    try {
      const resolved = await this.userIdFor(tokens);
      return resolved.tokens.accessToken;
    } catch {
      await this.tokenStore.clear();
      return null;
    }
  }

  async getActorId(): Promise<string | null> {
    const tokens = await this.tokenStore.get();
    if (!tokens) return null;
    try {
      const resolved = await this.userIdFor(tokens);
      return resolved.userId || null;
    } catch {
      await this.tokenStore.clear();
      return null;
    }
  }
}

export function createSupabaseRemoteAuthGateway(config: SupabaseRemoteAuthGatewayConfig) {
  return new SupabaseRemoteAuthGateway(config);
}
