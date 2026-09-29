import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

const DIST_ROOT = resolve(process.cwd(), 'dist');
const TEXT_EXTENSIONS = new Set(['.html', '.js', '.css', '.json', '.map', '.txt', '.svg', '.xml']);
const sentinels = [
  process.env.NAVER_MAP_CLIENT_SECRET,
  process.env.KAKAO_REST_API_KEY,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  process.env.DAON_OWNER_BOOTSTRAP_KEY,
].map((value) => value?.trim()).filter((value) => value && value.length >= 12);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (entry.isFile() && TEXT_EXTENSIONS.has(extname(entry.name).toLowerCase())) files.push(full);
  }
  return files;
}

const rootStat = await stat(DIST_ROOT).catch(() => null);
if (!rootStat?.isDirectory()) throw new Error('dist가 없습니다. npm run build 이후 secret scan을 실행해야 합니다.');

const files = await walk(DIST_ROOT);
if (!files.length) throw new Error('dist에서 검사할 browser text artifact를 찾지 못했습니다.');

const findings = [];
for (const file of files) {
  const text = await readFile(file, 'utf8');
  for (const sentinel of sentinels) {
    if (text.includes(sentinel)) findings.push({ file, type: 'SERVER_SECRET_SENTINEL' });
  }
  const sbSecretMatches = text.match(/sb_secret_[A-Za-z0-9_-]{16,}/g) ?? [];
  if (sbSecretMatches.length) findings.push({ file, type: 'SUPABASE_SECRET_KEY_PATTERN', count: sbSecretMatches.length });
}

if (findings.length) {
  console.error(JSON.stringify(findings, null, 2));
  throw new Error('Browser build artifact에서 server-only credential 패턴이 검출되었습니다.');
}

console.log(JSON.stringify({
  filesScanned: files.length,
  serverSentinelsChecked: sentinels.length,
  result: 'PASS',
}, null, 2));
console.log('Browser build secret scan: PASS');
