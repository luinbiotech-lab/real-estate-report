import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function parseEnv(source) {
  const values = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[key] = value;
  }
  return values;
}

const envPath = resolve(process.cwd(), '.env');
const fileEnv = existsSync(envPath) ? parseEnv(readFileSync(envPath, 'utf8')) : {};
function envValue(key, fallback = '') {
  return process.env[key] || fileEnv[key] || fallback;
}

function exactOrigins(value) {
  return value.split(',').map((item) => item.trim()).filter(Boolean).map((item) => {
    if (item === '*') throw new Error('MAP_PROXY_ALLOWED_ORIGINS wildcard는 허용하지 않습니다.');
    const url = new URL(item);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      throw new Error(`유효하지 않은 MAP_PROXY_ALLOWED_ORIGINS 값입니다: ${item}`);
    }
    return url.origin;
  });
}

export const serverEnv = {
  naverClientId: envValue('NAVER_MAP_CLIENT_ID'),
  naverClientSecret: envValue('NAVER_MAP_CLIENT_SECRET'),
  kakaoRestApiKey: envValue('KAKAO_REST_API_KEY'),
  mapProxyHost: envValue('MAP_PROXY_HOST', '127.0.0.1'),
  mapProxyPort: Number(envValue('MAP_PROXY_PORT', '5175')),
  mapProxyAllowedOrigins: exactOrigins(envValue('MAP_PROXY_ALLOWED_ORIGINS', 'http://localhost:5174')),
};
