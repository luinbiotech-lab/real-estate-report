import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(process.cwd(), '.env');
if (!existsSync(path)) {
  writeFileSync(path, 'NAVER_MAP_CLIENT_ID=\nNAVER_MAP_CLIENT_SECRET=\nKAKAO_REST_API_KEY=\n');
  console.log('.env 서버 전용 변수 틀을 생성했습니다.');
  process.exit(0);
}
const replacements = new Map([
  ['VITE_NAVER_MAP_CLIENT_ID', 'NAVER_MAP_CLIENT_ID'],
  ['VITE_NAVER_MAP_CLIENT_SECRET', 'NAVER_MAP_CLIENT_SECRET'],
  ['VITE_KAKAO_REST_API_KEY', 'KAKAO_REST_API_KEY'],
  ['KAKAO_JAVASCRIPT_KEY', 'VITE_KAKAO_JAVASCRIPT_KEY'],
]);
const migrated = readFileSync(path, 'utf8').split(/\r?\n/).map((line) => {
  const match = line.match(/^(\s*)([A-Z0-9_]+)(\s*=.*)$/);
  if (!match || !replacements.has(match[2])) return line;
  return `${match[1]}${replacements.get(match[2])}${match[3]}`;
}).join('\n');
const withStreetViewKey = /^VITE_KAKAO_JAVASCRIPT_KEY=/m.test(migrated) ? migrated : `${migrated.replace(/\s*$/, '')}\nVITE_KAKAO_JAVASCRIPT_KEY=\n`;
writeFileSync(path, withStreetViewKey);
console.log('.env 변수명을 서버 전용 형식으로 이전했습니다. 값은 출력하지 않았습니다.');
