import { MapServiceError } from './types';

export interface ProxyStatus { proxyConnected: boolean; naverConfigured: boolean; kakaoConfigured: boolean; kakaoRoadviewConfigured: boolean }
let status: ProxyStatus = { proxyConnected: false, naverConfigured: false, kakaoConfigured: false, kakaoRoadviewConfigured: false };

export const getProxyStatus = () => status;
export async function refreshProxyStatus(): Promise<ProxyStatus> {
  try {
    const response = await fetch('/api/status');
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
  try { response = await fetch(`${path}?${new URLSearchParams(params)}`); }
  catch { throw new MapServiceError('proxy-unavailable', '로컬 API proxy에 연결할 수 없습니다. localhost:5175 실행 상태를 확인해 주세요.'); }
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
