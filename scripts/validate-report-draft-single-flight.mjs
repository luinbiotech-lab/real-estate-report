import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync('src/services/reportEngine/reportDraftSingleFlight.ts', 'utf8');
const preview = readFileSync('src/pages/DocumentPreview.tsx', 'utf8');
assert.match(preview, /createReportDraftOnce\(draftRequests\.current, id, \(propertyId\) => reportSnapshotService\.createDraft\(propertyId\)\)/,
  'report route must use per-component single-flight draft creation');
assert.match(preview, /if \(!cancelled\) navigate\(`\/professional-report\/snapshot\/\$\{snapshot\.id\}`/,
  'unmounted or switched routes must not navigate after draft creation');

function load(code) {
  const compiled = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const execute = runInNewContext(`(function(module, exports) { ${compiled}\n})`, { Map, Promise });
  execute(module, module.exports);
  return module.exports.createReportDraftOnce;
}

function deferred() {
  let resolve; let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function check(singleFlight) {
  const pending = new Map();
  const a = deferred(); const b = deferred();
  const counts = { A: 0, B: 0 };
  const create = (id) => { counts[id]++; return id === 'A' ? a.promise : b.promise; };
  const firstA = singleFlight(pending, 'A', create);
  const secondA = singleFlight(pending, 'A', create);
  assert.equal(firstA, secondA, 'StrictMode effect replay must share a single draft request');
  const firstB = singleFlight(pending, 'B', create);
  assert.notEqual(firstB, firstA, 'different Properties must never share a draft');
  await Promise.resolve();
  assert.deepEqual(counts, { A: 1, B: 1 }, 'exactly one create per Property while pending');
  a.resolve({ id: 'draft-A' }); b.resolve({ id: 'draft-B' });
  assert.equal((await secondA).id, 'draft-A');
  assert.equal((await firstB).id, 'draft-B');
  await Promise.resolve();
  assert.equal(pending.size, 0, 'completed operations must release their map entries');
  const nextA = singleFlight(pending, 'A', async () => ({ id: 'new-version' }));
  assert.notEqual(nextA, firstA, 'later intentional version must create a new draft');
  assert.equal((await nextA).id, 'new-version');
  await Promise.resolve();

  const fail = deferred(); let calls = 0;
  const failed = singleFlight(pending, 'failed', () => { calls++; return fail.promise; });
  assert.equal(singleFlight(pending, 'failed', () => { throw Error('duplicate'); }), failed);
  await Promise.resolve();
  assert.equal(calls, 1);
  fail.reject(new Error('storage failure'));
  await assert.rejects(failed, /storage failure/);
  await Promise.resolve();
  assert.equal(pending.has('failed'), false, 'failed operations must be retryable');
  await assert.rejects(singleFlight(pending, 'throw', () => { throw new Error('sync failure'); }), /sync failure/);
  await Promise.resolve();
  assert.equal(pending.has('throw'), false, 'synchronous throws must also release the entry');
}

await check(load(source));
// Negative control: removing in-flight lookup must fail the duplicate assertion.
const broken = load(source.replace('if (existing) return existing;', 'if (false) return existing;'));
await assert.rejects(check(broken), /StrictMode effect replay must share a single draft request/);
console.log('PASS report draft single-flight: StrictMode replay, Property isolation, settle/retry, and negative control');
