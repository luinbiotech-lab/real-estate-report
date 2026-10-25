import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Execute the exact TypeScript editor parser/serializer, not a duplicate
// implementation. Existing Data Room provenance must survive every edit.
const source = readFileSync('src/components/propertyDataRoom/ComparableTransactionPanel.tsx', 'utf8');
const start = source.indexOf('function normalizeNumber(');
const end = source.indexOf('export default function ComparableTransactionPanel(', start);
assert.ok(start >= 0 && end > start, 'editor parsing functions must exist');
const methods = source.slice(start, end);
function load(text) {
  const js = ts.transpileModule(text + '\nmodule.exports = { parseRows, rowsFromSource };', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  runInNewContext(js, { module, exports: module.exports, Number, Boolean, String, Array });
  return module.exports;
}
const { parseRows, rowsFromSource } = load(methods);
const sourceRows = [
  { label: '방배동 811-20', salePrice: 4500000000, landAreaPyeong: 56.29, landUnitPrice: 79050000, approvalYear: 1986, tradeDate: '2025-11-25', address: '서울 서초구 방배동', sourceRow: 11, sourceRecordLabel: '방배동 811-20' },
  { label: '방배동 2112', salePrice: 5100000000, landAreaPyeong: 59.89, landUnitPrice: 85160000, approvalYear: null, tradeDate: '2025-10-24', address: '', sourceRow: 10, sourceRecordLabel: '방배동 2112' },
];
const saved = { metadata: { rows: sourceRows } };
const serialized = rowsFromSource(saved);
const restored = parseRows(serialized);
assert.equal(restored.length, 2);
assert.equal(restored[0].sourceRow, 11, 'edit/save must preserve original source row');
assert.equal(restored[0].sourceRecordLabel, '방배동 811-20', 'edit/save must preserve original record label');
assert.equal(restored[1].sourceRow, 10);
assert.equal(restored[1].sourceRecordLabel, '방배동 2112');
assert.equal(restored[1].approvalYear, undefined, 'missing year must not become zero');
assert.equal(restored[0].address, '서울 서초구 방배동');
assert.equal(parseRows('방배동 811-20\t4500000000\t56.29\t79050000\t1986\t2025-11-25')[0].sourceRow, undefined, 'legacy 6-column input must not invent provenance');
assert.equal(parseRows('방배동 811-20,4500000000,56.29,79050000,1986,2025-11-25,서울,서초구')[0].address, '서울, 서초구');
assert.equal(parseRows('방배동 811-20\t4500000000\t56.29\t79050000\t1986\t2025-11-25\t\t\t')[0].sourceRow, undefined);
assert.throws(() => parseRows('방배동 811-20\t4500000000\t56.29\t79050000\t1986\t2025-11-25\t주소\t11'), /9개 항목/);
assert.throws(() => parseRows('방배동 811-20\t4500000000\t56.29\t79050000\t1986\t2025-11-25\t주소\t0\t기록'), /1 이상의 정수/);
assert.throws(() => parseRows('방배동 811-20\t4500000000\t56.29\t79050000\t1986\t2025-11-25\t주소\t11\t'), /모두 입력/);
assert.throws(() => parseRows('방배동 811-20\t4500000000\t56.29\t79050000\t1986\t2025-11-25\t주소\t\t기록'), /모두 입력/);
const weakened = methods.replace("item.sourceRow ?? '', item.sourceRecordLabel ?? ''", "'', ''");
assert.notEqual(weakened, methods, 'negative-control mutation must match serializer');
assert.equal(load(weakened).parseRows(load(weakened).rowsFromSource(saved))[0].sourceRow, undefined, 'negative control reproduces the original provenance-loss defect');
assert.match(source, /원문 행번호·기록명 미입력/, 'editor must warn about missing source locators');
console.log('PASS comparable editor provenance: source row/record round-trip, legacy compatibility, invalid locator guards, negative control');
