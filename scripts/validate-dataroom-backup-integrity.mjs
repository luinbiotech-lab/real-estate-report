import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditDataRoomBackup } from './audit-dataroom-backup.mjs';

const propertyId = 'property-1';
const sample = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n');
const row = (id, documentType, status = 'verified') => ({ key: id, value: {
  id, propertyId, documentType, originalFileName: id + '.pdf',
  storagePath: 'properties/' + propertyId + '/documents/' + id + '.pdf',
  fileSize: sample.length, verificationStatus: status,
  fileData: { __daonBinary: 'blob', mimeType: 'application/pdf', base64: sample.toString('base64') },
} });
const entries = [row('building', 'building_register'), row('land', 'land_register'),
  row('use', 'land_use_plan'), row('registry', 'registry')];
const backup = { schemaVersion: 'daon-local-backup-v1', createdAt: '2026-09-26T00:00:00Z',
  stores: { propertyDocuments: entries } };
const dir = mkdtempSync(join(tmpdir(), 'daon-backup-audit-'));
try {
  for (const entry of entries) writeFileSync(join(dir, entry.value.originalFileName), sample);
  const good = auditDataRoomBackup(backup, { propertyId, originalsDir: dir });
  assert.equal(good.integrity, 'PASS');
  assert.equal(good.readiness, 'ELIGIBLE_FOR_LIVE_RECHECK');
  assert.equal(good.documents.length, 4);
  assert.ok(good.documents.every(item => item.originalMatches === true));

  const clone = () => structuredClone(backup);
  const missingLand = clone(); missingLand.stores.propertyDocuments.splice(1, 1);
  assert.deepEqual(auditDataRoomBackup(missingLand, { propertyId }).missingTypes, ['land_register']);
  assert.equal(auditDataRoomBackup(missingLand, { propertyId }).readiness, 'BLOCKED');

  const userConfirmed = clone(); userConfirmed.stores.propertyDocuments[0].value.verificationStatus = 'confirmed';
  assert.deepEqual(auditDataRoomBackup(userConfirmed, { propertyId }).unverifiedTypes, ['building_register']);
  assert.equal(auditDataRoomBackup(userConfirmed, { propertyId }).readiness, 'BLOCKED');

  const corrupt = clone(); corrupt.stores.propertyDocuments[0].value.fileData.base64 = Buffer.from('not a pdf').toString('base64');
  assert.equal(auditDataRoomBackup(corrupt, { propertyId }).integrity, 'FAIL');

  const wrongSize = clone(); wrongSize.stores.propertyDocuments[0].value.fileSize++;
  assert.equal(auditDataRoomBackup(wrongSize, { propertyId }).integrity, 'FAIL');

  const foreign = clone(); foreign.stores.propertyDocuments[0].value.propertyId = 'foreign-property';
  assert.equal(auditDataRoomBackup(foreign, { propertyId }).integrity, 'FAIL');

  const mismatch = clone(); writeFileSync(join(dir, 'building.pdf'), Buffer.from('%PDF-1.4\nWRONG\n%%EOF'));
  assert.equal(auditDataRoomBackup(mismatch, { propertyId, originalsDir: dir }).integrity, 'FAIL');

  const duplicate = clone(); duplicate.stores.propertyDocuments.push(structuredClone(duplicate.stores.propertyDocuments[0]));
  assert.equal(auditDataRoomBackup(duplicate, { propertyId }).integrity, 'FAIL');

  console.log('PASS Data Room backup offline audit: byte matching, missing/confirmed gates, corrupt/size/foreign/mismatch/duplicate negative controls');
} finally { rmSync(dir, { recursive: true, force: true }); }
