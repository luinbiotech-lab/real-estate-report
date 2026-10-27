import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Exercise the actual service, not a reimplemented status helper.
// Data entry must never mint an independent "verified" attestation.
const source = readFileSync('src/services/comparableTransactionService.ts', 'utf8');
const ui = readFileSync('src/components/propertyDataRoom/ComparableTransactionPanel.tsx', 'utf8');
function harness(text) {
  const saves = { sources: [], verifications: [], properties: [] };
  const property = { id: 'p1', nearbyTransactions: '', updatedAt: '2026-10-01T00:00:00Z' };
  const mocks = {
    '../repositories/propertyDataRoomRepository': { propertyDataRoomRepository: {
      getDataSources: async () => [], getVerifications: async () => [],
      saveDataSource: async (row) => { saves.sources.push(row); },
      saveVerification: async (row) => { saves.verifications.push(row); },
    } },
    '../repositories/propertyRepository': { propertyRepository: {
      getById: async (id) => id === property.id ? property : null,
      update: async (row) => { saves.properties.push(row); },
    } },
    '../utils/format': { formatWon: (value) => String(value) + '원' },
  };
  const js = ts.transpileModule(text, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  runInNewContext(js, {
    module, exports: module.exports, require: (id) => {
      if (!(id in mocks)) throw new Error('unexpected import: ' + id);
      return mocks[id];
    },
    Date, Number, String, Math, Error, Array,
  });
  return { replace: module.exports.comparableTransactionService.replace, saves };
}
const valid = { label: '원문 거래', sourceRow: 11, sourceRecordLabel: '원문 11',
  salePrice: 4_500_000_000, landAreaPyeong: 60, landUnitPrice: 75_000_000,
  tradeDate: '2026-02-13' };
const input = (verificationStatus) => ({
  sourceName: '제공 원문', sourceReference: 'original.pdf', verificationStatus,
});
const actual = harness(source);
await assert.rejects(actual.replace('p1', [valid], input('verified')), /별도 검증 이력/,
  'data editor must not self-attest verified');
assert.equal(actual.saves.sources.length, 0, 'verified attempt must not persist a source');
assert.equal(actual.saves.verifications.length, 0, 'verified attempt must not mint a verification');
assert.equal(actual.saves.properties.length, 0, 'verified attempt must not change Property');
await actual.replace('p1', [valid], input('confirmed'));
assert.equal(actual.saves.sources[0].verificationStatus, 'confirmed');
assert.equal(actual.saves.verifications[0].status, 'confirmed');
assert.ok(actual.saves.verifications[0].verifiedAt, 'confirmed entry retains its confirmation timestamp');
assert.equal(actual.saves.sources[0].metadata.provenance.independentOfficialVerification, false);
await actual.replace('p1', [valid], input('imported'));
assert.equal(actual.saves.sources[1].verificationStatus, 'imported');
assert.equal(actual.saves.verifications[1].status, 'imported');
assert.equal(actual.saves.verifications[1].verifiedAt, undefined);
await actual.replace('p1', [valid], input('unverified'));
assert.equal(actual.saves.sources[2].verificationStatus, 'unverified');
assert.equal(actual.saves.verifications[2].status, 'unverified');
assert.equal(actual.saves.verifications[2].verifiedAt, undefined);
assert.ok(ui.includes("const statusOptions: Array<Extract<VerificationStatus, 'confirmed' | 'imported' | 'unverified'>> = ['confirmed', 'imported', 'unverified'];"),
  'editor cannot offer self-attested verified');
assert.match(ui, /기존 비교거래 검증은 수정·재저장 시 재검토가 필요/,
  'editing previously verified data must show an explicit warning');

// Negative control: restoring the old self-approval path must reproduce the bug.
const weakened = source.replace("if (source.verificationStatus === 'verified') {",
  "if (false) {");
assert.notEqual(weakened, source, 'negative control must mutate the real guard');
const oldBehavior = harness(weakened);
await oldBehavior.replace('p1', [valid], input('verified'));
assert.equal(oldBehavior.saves.sources[0].verificationStatus, 'verified');
assert.equal(oldBehavior.saves.verifications[0].status, 'verified');
console.log('PASS comparable verification boundary: verified rejected without writes, confirmed/imported preserved, UI guarded, negative control reproduces bypass');
