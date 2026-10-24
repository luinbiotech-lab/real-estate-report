import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const source = readFileSync('src/services/reportEngine/reportDataBuilder.ts', 'utf8');
const start = source.indexOf('function comparablePositiveNumber(');
const end = source.indexOf('export function buildProfessionalReportViewModel(', start);
assert.ok(start >= 0 && end > start, 'comparable parser must exist');
const methods = source.slice(start, end);
function compile(methods) {
  const js = ts.transpileModule(methods + '\nmodule.exports = comparableRows;', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  runInNewContext(js, { module, exports: module.exports, Date, Number });
  return module.exports;
}
function scenarios(fn) {
  const valid = { label: '정상', salePrice: 15000000000, landAreaPyeong: 100, landUnitPrice: 150000000, tradeDate: '2026-02-13', approvalYear: null };
  const rows = [
    valid,
    { ...valid, label: '문자열', salePrice: '15000000000', landAreaPyeong: '100', landUnitPrice: '150000000', tradeDate: '2025-11-25', approvalYear: '2001' },
    { ...valid, label: 'null', salePrice: null },
    { ...valid, label: '공백', salePrice: '' },
    { ...valid, label: '음수', salePrice: -1 },
    { ...valid, label: '면적 없음', landAreaPyeong: null },
    { ...valid, label: '면적 0', landAreaPyeong: 0 },
    { ...valid, label: '평당가 없음', landUnitPrice: null },
    { ...valid, label: '평당가 0', landUnitPrice: 0 },
    { ...valid, label: '날짜 오류', tradeDate: '2026-02-30' },
    { ...valid, label: '날짜 없음', tradeDate: '' },
    { ...valid, label: '명칭 없음', label: ' ' },
    { ...valid, label: '수치 오류', salePrice: '1억' },
  ];
  const mapped = fn({ dataSources: [{ id: 'source-1', resourceType: 'comparable_transaction_set', fieldKey: 'nearbyTransactions', verificationStatus: 'confirmed', metadata: { rows } }] });
  assert.equal(mapped.length, 2, 'invalid legacy rows must not become report facts');
  assert.equal(mapped[0].label, '정상');
  assert.equal(mapped[0].approvalYear, null, 'missing year must not become zero');
  assert.equal(mapped[1].approvalYear, 2001);
  assert.equal(mapped[1].salePrice, 15000000000);
  assert.equal(mapped[0].sourceId, 'source-1');
  assert.equal(mapped[0].verificationStatus, 'confirmed', 'source verification must not be promoted');
  assert.equal(fn({ dataSources: [] }).length, 0);
}
scenarios(compile(methods));
const weakened = methods.replace("if (typeof value !== 'string') return null;", "if (typeof value !== 'string') return 0;");
assert.notEqual(weakened, methods);
assert.throws(() => scenarios(compile(weakened)), /invalid legacy rows/, 'negative control must fail');
console.log('PASS report comparable integrity: malformed legacy rows excluded, provenance retained, negative control detected');
