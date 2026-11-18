/**
 * Passkey (WebAuthn) helpers for Supabase Auth's native passkey endpoints.
 *
 * Supabase Auth (GoTrue) exposes:
 *   POST /auth/v1/passkeys/registration/options   (Bearer user JWT)
 *   POST /auth/v1/passkeys/registration/verify    (Bearer user JWT)  { challenge_id, credential }
 *   POST /auth/v1/passkeys/authentication/options (anon)
 *   POST /auth/v1/passkeys/authentication/verify  (anon)            { challenge_id, credential } -> session
 *
 * The browser ceremony runs locally (Face ID / Touch ID / Windows Hello / Android fingerprint / PIN).
 * No private key or biometric data ever leaves the device; Supabase stores only the public key.
 * No new dependency, server, or secret is needed. Passwords remain available as before.
 */

type JsonObject = Record<string, unknown>;

export const PASSKEY_FEATURE_ENABLED = import.meta.env?.VITE_DAON_PASSKEY_ENABLED === 'true';

export function browserSupportsPasskey(): boolean {
  return typeof window !== 'undefined'
    && window.isSecureContext !== false
    && typeof window.PublicKeyCredential === 'function'
    && typeof navigator !== 'undefined'
    && typeof navigator.credentials?.get === 'function'
    && typeof navigator.credentials?.create === 'function';
}

export function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToBase64Url(input: ArrayBuffer | ArrayBufferView): string {
  const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function toBuffer(value: unknown, field: string): ArrayBuffer {
  if (typeof value !== 'string' || !value) throw new Error(`패스키 서버 응답에 ${field} 값이 없습니다.`);
  const bytes = base64UrlToBytes(value);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function credentialDescriptors(list: unknown): PublicKeyCredentialDescriptor[] | undefined {
  if (!Array.isArray(list) || !list.length) return undefined;
  return list.map((item) => {
    const row = (item && typeof item === 'object' ? item : {}) as JsonObject;
    return {
      ...row,
      type: 'public-key',
      id: toBuffer(row.id, 'credential id'),
    } as PublicKeyCredentialDescriptor;
  });
}

/** JSON (base64url) creation options from the server -> browser API shape. */
export function decodeCreationOptions(json: unknown): PublicKeyCredentialCreationOptions {
  const options = (json && typeof json === 'object' ? json : {}) as JsonObject;
  const user = (options.user && typeof options.user === 'object' ? options.user : {}) as JsonObject;
  const result = {
    ...options,
    challenge: toBuffer(options.challenge, 'challenge'),
    user: { ...user, id: toBuffer(user.id, 'user.id') },
  } as unknown as PublicKeyCredentialCreationOptions;
  const exclude = credentialDescriptors(options.excludeCredentials);
  if (exclude) result.excludeCredentials = exclude;
  else delete (result as unknown as JsonObject).excludeCredentials;
  return result;
}

/** JSON (base64url) request options from the server -> browser API shape. */
export function decodeRequestOptions(json: unknown): PublicKeyCredentialRequestOptions {
  const options = (json && typeof json === 'object' ? json : {}) as JsonObject;
  const result = {
    ...options,
    challenge: toBuffer(options.challenge, 'challenge'),
  } as unknown as PublicKeyCredentialRequestOptions;
  const allow = credentialDescriptors(options.allowCredentials);
  if (allow) result.allowCredentials = allow;
  else delete (result as unknown as JsonObject).allowCredentials;
  return result;
}

interface AttachmentCredential extends PublicKeyCredential { authenticatorAttachment: AuthenticatorAttachment | null }

export function encodeRegistrationCredential(credential: PublicKeyCredential): JsonObject {
  const response = credential.response as AuthenticatorAttestationResponse;
  const withTransports = response as AuthenticatorAttestationResponse & { getTransports?: () => string[] };
  return {
    id: credential.id,
    rawId: bytesToBase64Url(credential.rawId),
    type: 'public-key',
    response: {
      attestationObject: bytesToBase64Url(response.attestationObject),
      clientDataJSON: bytesToBase64Url(response.clientDataJSON),
      ...(typeof withTransports.getTransports === 'function' ? { transports: withTransports.getTransports() } : {}),
    },
    clientExtensionResults: credential.getClientExtensionResults?.() ?? {},
    authenticatorAttachment: (credential as AttachmentCredential).authenticatorAttachment ?? undefined,
  };
}

export function encodeAuthenticationCredential(credential: PublicKeyCredential): JsonObject {
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: bytesToBase64Url(credential.rawId),
    type: 'public-key',
    response: {
      authenticatorData: bytesToBase64Url(response.authenticatorData),
      clientDataJSON: bytesToBase64Url(response.clientDataJSON),
      signature: bytesToBase64Url(response.signature),
      ...(response.userHandle ? { userHandle: bytesToBase64Url(response.userHandle) } : {}),
    },
    clientExtensionResults: credential.getClientExtensionResults?.() ?? {},
    authenticatorAttachment: (credential as AttachmentCredential).authenticatorAttachment ?? undefined,
  };
}

/** Plain-Korean message for errors that come from the browser ceremony or Supabase passkey codes. */
export function passkeyErrorMessage(reason: unknown): string {
  const name = reason && typeof reason === 'object' && 'name' in reason ? String((reason as { name: unknown }).name) : '';
  const message = reason instanceof Error ? reason.message : String(reason ?? '');
  if (name === 'NotAllowedError' || name === 'AbortError') return '얼굴·지문 확인이 취소되었거나 시간이 지났습니다. 다시 눌러 주세요.';
  if (name === 'InvalidStateError' || message.includes('webauthn_credential_exists')) return '이 기기에는 이미 패스키가 등록되어 있습니다.';
  if (name === 'SecurityError') return '이 주소에서는 패스키를 쓸 수 없습니다. 운영 주소에서 다시 시도해 주세요.';
  if (message.includes('passkey_disabled')) return '패스키 로그인이 아직 서버에서 켜져 있지 않습니다. 이메일·비밀번호로 로그인해 주세요.';
  if (message.includes('webauthn_credential_not_found')) return '이 패스키는 등록되어 있지 않습니다. 비밀번호로 로그인한 뒤 다시 등록해 주세요.';
  if (message.includes('webauthn_challenge_expired') || message.includes('webauthn_challenge_not_found')) return '확인 시간이 지났습니다. 다시 눌러 주세요.';
  if (message.includes('too_many_passkeys')) return '등록할 수 있는 패스키 수를 넘었습니다.';
  if (message.includes('webauthn_verification_failed')) return '패스키 확인에 실패했습니다. 다시 시도해 주세요.';
  return message || '패스키 처리 중 오류가 발생했습니다.';
}
