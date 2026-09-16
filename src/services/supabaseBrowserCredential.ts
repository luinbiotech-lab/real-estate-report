function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return atob(padded);
}

function legacyJwtRole(key: string): string | undefined {
  const parts = key.split('.');
  if (parts.length !== 3) return undefined;
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as Record<string, unknown>;
    return typeof payload.role === 'string' ? payload.role : undefined;
  } catch {
    throw new Error('Supabase legacy browser key JWT 형식이 올바르지 않습니다.');
  }
}

export function requireBrowserSafeSupabaseKey(value: string) {
  const key = value.trim();
  if (!key) throw new Error('Supabase public anon/publishable key가 필요합니다.');

  if (/^sb_secret_/i.test(key) || /service[_-]?role/i.test(key)) {
    throw new Error('Supabase server/service_role credential은 browser adapter에 사용할 수 없습니다.');
  }

  if (/^sb_publishable_/i.test(key)) return key;

  if (/^eyJ/i.test(key)) {
    const role = legacyJwtRole(key);
    if (role !== 'anon') {
      throw new Error('Supabase browser adapter에는 legacy anon JWT만 사용할 수 있습니다.');
    }
    return key;
  }

  throw new Error('Supabase browser adapter에는 publishable key 또는 legacy anon JWT만 사용할 수 있습니다.');
}
