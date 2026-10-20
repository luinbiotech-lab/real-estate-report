// Load a TypeScript module (and its relative TS imports) from plain Node, using the project's own typescript package.
// CI runs Node 20 without tsx/strip-types; transpileModule keeps validators dependency-free beyond `npm ci`.
import { existsSync, mkdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
function loadTypeScript() {
  for (const candidate of ['typescript', '/opt/node-tools/node_modules/typescript']) {
    try { return require(candidate); } catch { /* try next */ }
  }
  throw new Error('typescript 패키지를 찾을 수 없습니다. npm ci 후 실행하세요.');
}
const ts = loadTypeScript();

// Transpile a TS module and its relative TS imports into a temp dir so plain Node can import it (no tsx needed in CI).
export async function importTs(entry) {
  const dir = mkdtempSync(join(tmpdir(), 'daon-nav-'));
  const seen = new Map();
  const emit = (path) => {
    const abs = resolve(path);
    if (seen.has(abs)) return seen.get(abs);
    const target = join(dir, relative(process.cwd(), abs).replace(/\.tsx?$/, '.mjs'));
    seen.set(abs, target);
    let code = ts.transpileModule(readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    code = code.replace(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g, (_, spec) => {
      const base = resolve(dirname(abs), spec);
      const source = [base + '.ts', base + '.tsx', join(base, 'index.ts')].find((candidate) => existsSync(candidate));
      if (!source) throw new Error(`import 해석 실패: ${spec} (${path})`);
      const out = emit(source);
      let rel = relative(dirname(target), out).split(sep).join('/');
      if (!rel.startsWith('.')) rel = './' + rel;
      return `from '${rel}'`;
    });
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, code);
    return target;
  };
  try { return await import(pathToFileURL(emit(entry)).href); } finally { rmSync(dir, { recursive: true, force: true }); }
}

