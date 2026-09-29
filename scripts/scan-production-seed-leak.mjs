import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = 'dist';
if (!existsSync(root)) throw new Error('dist build가 없습니다.');

const forbidden = [
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

const hits = [];
for (const file of files(root)) {
  const content = readFileSync(file);
  const text = content.toString('utf8');
  for (const marker of forbidden) if (text.includes(marker)) hits.push({ file, marker });
}
if (hits.length) throw new Error(`Post-cutover production build에 local property seed가 포함되었습니다: ${JSON.stringify(hits)}`);
console.log('Production build local-seed leak scan: PASS');
