import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Execute the real policy module, not a reimplemented policy model.
const source = readFileSync('src/domain/professionalReport/reportAccessPolicy.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
const execute = runInNewContext(`(function(require, module, exports) { ${compiled}\n})`, {});
execute(() => { throw new Error('Unexpected runtime import in media policy'); }, module, module.exports);
const { internalPhotoAllowed, isBangbae81511, reportMediaCategoryAllowed } = module.exports;

const cases = [
  ['parcel address / explicit true', { id: 'other', name: '', address: '서울 서초구 방배동 815-11', detailAddress: '', internalPhotoAllowed: true }, false],
  ['road address / explicit true', { id: 'other', name: '', address: '서울 서초구 동광로18길 7', detailAddress: '', internalPhotoAllowed: true }, false],
  ['property ID / explicit true', { id: 'daon-bangbae-815-11', name: '', address: '', detailAddress: '', internalPhotoAllowed: true }, false],
  ['parcel address / explicit false', { id: 'other', name: '', address: '방배동 815-11', detailAddress: '', internalPhotoAllowed: false }, false],
  ['unrelated / explicit true', { id: 'other', name: '', address: '서초구 서초동 1', detailAddress: '', internalPhotoAllowed: true }, true],
  ['unrelated / explicit false', { id: 'other', name: '', address: '서초구 서초동 1', detailAddress: '', internalPhotoAllowed: false }, false],
  ['unrelated / unset', { id: 'other', name: '', address: '서초구 서초동 1', detailAddress: '', internalPhotoAllowed: undefined }, true],
];
for (const [label, property, expected] of cases) {
  assert.equal(internalPhotoAllowed(property), expected, label);
  if (expected === false) {
    assert.equal(reportMediaCategoryAllowed('interior', internalPhotoAllowed(property)), false, `${label}: interior`);
  }
}
assert.equal(isBangbae81511(cases[2][1]), true, 'property ID must be sufficient even when address is unavailable');
assert.equal(reportMediaCategoryAllowed('exterior', false), true, 'exterior photos remain allowed');
console.log('PASS: Bangbae hard-deny internal media, seven property cases and exterior allowance');
