import assert from 'node:assert/strict';

// Regression reproducer for the property switch / stale upload completion in PR #15.
// Standalone model of the async sequencing; NOT a browser E2E test.
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function scenario(guardCompletion) {
  let selected = 'A';
  let assets = [];
  let generation = 0;
  const upload = deferred();
  async function load(id) {
    const request = ++generation;
    assets = [];
    const rows = [{ propertyId: id }];
    await Promise.resolve();
    if (request === generation) assets = rows;
  }
  const pendingUpload = (async () => {
    const capturedId = 'A';
    await upload.promise;
    if (guardCompletion && selected !== capturedId) return;
    await load(capturedId);
  })();
  selected = 'B';
  await load('B');
  upload.resolve();
  await pendingUpload;
  return { selected, assets };
}

const broken = await scenario(false);
assert.equal(broken.selected, 'B');
assert.equal(broken.assets[0].propertyId, 'A');
const guarded = await scenario(true);
assert.equal(guarded.selected, 'B');
assert.equal(guarded.assets[0].propertyId, 'B');
console.log('PASS: stale A upload completion is reproduced; selected-property guard prevents cross-property display.');
