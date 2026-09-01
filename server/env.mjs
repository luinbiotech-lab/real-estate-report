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
export const serverEnv = {
  naverClientId: process.env.NAVER_MAP_CLIENT_ID || fileEnv.NAVER_MAP_CLIENT_ID || '',
  naverClientSecret: process.env.NAVER_MAP_CLIENT_SECRET || fileEnv.NAVER_MAP_CLIENT_SECRET || '',
  kakaoRestApiKey: process.env.KAKAO_REST_API_KEY || fileEnv.KAKAO_REST_API_KEY || '',
};
