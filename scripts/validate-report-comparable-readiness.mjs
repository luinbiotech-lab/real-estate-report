import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync('src/services/reportEngine/reportComparableReadiness.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function load(js) {
  const module = { exports: {} };
  runInNewContext(js, { module, exports: module.exports, Number, Date, Math, Array });
  return module.exports.assessReportComparableReadiness;
}
const assess = load(compiled);
assert.equal(typeof assess, 'function');
const valid = { label: '비교거래', sourceRow: 11, sourceRecordLabel: '원문 행 11', salePrice: 4_500_000_000, landAreaPyeong: 60, landUnitPrice: 75_000_000, tradeDate: '2026-02-13', arithmeticReviewStatus: 'consistent' };
const bundle = (rows) => ({ dataSources: [{ id: 'market-1', fieldKey: 'nearbyTransactions', resourceType: 'comparable_transaction_set', metadata: { rows } }] });
assert.equal(assess({ dataSources: [] }).ready, true, 'no optional comparables must not block unrelated report');
assert.equal(assess(bundle([valid])).ready, true);
assert.equal(assess(bundle([{ ...valid, landUnitPrice: 79_050_000 }])).ready, false, 'arithmetic discrepancy must block final');
assert.equal(assess(bundle([{ ...valid, sourceRow: null }])).ready, false, 'missing row locator must block final');
assert.equal(assess(bundle([{ ...valid, sourceRecordLabel: '' }])).ready, false, 'missing record locator must block final');
assert.equal(assess(bundle([{ ...valid, arithmeticReviewStatus: 'review_required' }])).ready, false, 'explicit arithmetic review must block final');
assert.equal(assess(bundle([{ ...valid, salePrice: null }])).ready, false);
assert.equal(assess(bundle([{ ...valid, tradeDate: '2026-02-30' }])).ready, false);
assert.equal(assess(bundle([])).ready, false);
const unrelated = { id: 'other', fieldKey: 'different', resourceType: 'comparable_transaction_set', metadata: { rows: [{...valid, salePrice: null}] } };
assert.equal(assess({ dataSources: [unrelated] }).ready, true, 'unrelated DataSource must not affect gate');

const weakened = compiled.replace('variancePct > 0.5', 'variancePct > 100');
assert.notEqual(weakened, compiled, 'negative-control mutation must apply');
assert.equal(load(weakened)(bundle([{...valid, landUnitPrice: 79_050_000}])).ready, true, 'negative control proves arithmetic gate detects the discrepancy');

const builder = readFileSync('src/services/reportEngine/reportDataBuilder.ts', 'utf8');
const snapshot = readFileSync('src/services/reportEngine/reportSnapshotService.ts', 'utf8');
assert.match(builder, /reportReady: requiredDocumentsMissing\.length === 0 && requiredDocumentsVerified && !unresolvedCandidates && comparableReadiness\.ready/);
assert.match(snapshot, /const comparableReadiness = assessReportComparableReadiness\(bundle\);/);
assert.match(snapshot, /if \(!comparableReadiness\.ready\)/);

// The seeded Bangbae market source contains original reported prices that do
// not reconcile within the existing 0.5% tolerance. Preserve them for review;
// do not silently replace the source-reported values in the MASTER.
const bangbae = [
  { price: 4_500_000_000, area: 56.29, unit: 79_050_000 },
  { price: 5_100_000_000, area: 59.89, unit: 85_160_000 },
  { price: 4_100_000_000, area: 69.09, unit: 58_620_000 },
  { price: 4_200_000_000, area: 58.89, unit: 70_810_000 },
  { price: 3_500_000_000, area: 50.76, unit: 68_950_000 },
  { price: 5_800_000_000, area: 66, unit: 87_880_000 },
];
const pending = bangbae.filter(row => Math.abs((row.unit - row.price / row.area) / (row.price / row.area)) * 100 > 0.5);
assert.equal(pending.length, 3, 'three Bangbae source-reported prices require arithmetic review');
console.log('PASS report comparable finalization: 10 scenarios, negative control, two live/draft gates, Bangbae 3/6 discrepancies');
