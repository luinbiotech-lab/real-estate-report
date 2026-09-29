import { MapServiceError } from './types';

function resolveProxyBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim() || '';
  if (!configured) return '';
  const url = new URL(configured);
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new Error('VITE_API_BASE_URL은 HTTPS origin이어야 합니다. localhost만 HTTP를 허용합니다.');
  }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('VITE_API_BASE_URL에는 origin만 설정해야 합니다.');
  }
  return url.origin;
}

export const PROXY_BASE_URL = resolveProxyBaseUrl();

function proxyUrl(path: string) {
  if (!path.startsWith('/api/')) throw new Error('Protected proxy path는 /api/로 시작해야 합니다.');
  return `${PROXY_BASE_URL}${path}`;
}

export interface ProxyStatus { proxyConnected: boolean; naverConfigured: boolean; kakaoConfigured: boolean; kakaoRoadviewConfigured: boolean }
let status: ProxyStatus = { proxyConnected: false, naverConfigured: false, kakaoConfigured: false, kakaoRoadviewConfigured: false };

export const getProxyStatus = () => status;
export async function refreshProxyStatus(): Promise<ProxyStatus> {
  try {
    const response = await fetch(proxyUrl('/api/status'), { cache: 'no-store' });
    if (!response.ok) throw new Error();
    const data = await response.json() as Omit<ProxyStatus, 'proxyConnected'>;
    status = { proxyConnected: true, naverConfigured: data.naverConfigured, kakaoConfigured: data.kakaoConfigured, kakaoRoadviewConfigured: Boolean(import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY?.trim()) };
  } catch {
    status = { proxyConnected: false, naverConfigured: false, kakaoConfigured: false, kakaoRoadviewConfigured: false };
  }
  return status;
}

export async function proxyFetch(path: string, params: Record<string, string>): Promise<Response> {
  let response: Response;
  try { response = await fetch(`${proxyUrl(path)}?${new URLSearchParams(params)}`, { cache: 'no-store' }); }
  catch { throw new MapServiceError('proxy-unavailable', 'Protected API proxy에 연결할 수 없습니다. 배포 origin과 allowlist 설정을 확인해 주세요.'); }
  if (!response.ok) {
    let message = `API 요청에 실패했습니다. (${response.status})`;
    let code: 'missing-key' | 'request-failed' | 'auth-failed' = 'request-failed';
    try {
      const body = await response.json() as { message?: string; code?: string };
      message = body.message || message;
      if (body.code === 'API_NOT_CONFIGURED') code = 'missing-key';
      if (body.code === 'AUTH_FAILED') code = 'auth-failed';
    } catch { /* binary/error response */ }
    throw new MapServiceError(code, message);
  }
  return response;
}
