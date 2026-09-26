import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = 'dist-cutover';
if (!existsSync(root)) throw new Error('dist-cutover build가 없습니다.');

const required = [
  '서울 서초구 동광로18길 7',
  '4150000000',
  '래미안 원페를라 인접',
  '소유자 직접 사용 / 잔금일 기준 전체 명도 가능',
];

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const corpus = files(root).map((file) => readFileSync(file).toString('utf8')).join('\n');
const missing = required.filter((marker) => !corpus.includes(marker));
if (missing.length) throw new Error(`Cutover build에 local property seed가 포함되지 않았습니다: ${JSON.stringify(missing)}`);

console.log('Cutover build local-seed presence scan: PASS');
