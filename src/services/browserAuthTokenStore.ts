import type { RemoteAuthTokenStore, RemoteAuthTokens } from './supabaseRemoteAuthGateway';

const STORAGE_KEY = 'daon:remote-auth:session:v1';

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function parseTokens(value: string | null): RemoteAuthTokens | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<RemoteAuthTokens>;
    if (typeof parsed.accessToken !== 'string' || typeof parsed.refreshToken !== 'string') return null;
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresAt: typeof parsed.expiresAt === 'number' ? parsed.expiresAt : undefined,
    };
  } catch {
    return null;
  }
}

class BrowserPersistentRemoteAuthTokenStore implements RemoteAuthTokenStore {
  async get() {
    if (!isBrowser()) return null;
    return parseTokens(window.localStorage.getItem(STORAGE_KEY));
  }

  async set(tokens: RemoteAuthTokens) {
    if (!isBrowser()) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  }

  async clear() {
    if (!isBrowser()) return;
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function createBrowserPersistentRemoteAuthTokenStore(): RemoteAuthTokenStore {
  return new BrowserPersistentRemoteAuthTokenStore();
}

export const REMOTE_AUTH_SESSION_STORAGE_KEY = STORAGE_KEY;
