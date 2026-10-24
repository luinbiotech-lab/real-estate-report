#!/usr/bin/env node
// Read-only offline integrity audit. Never imports data into Production or promotes verification status.
import { createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';

export const REQUIRED_REPORT_DOCUMENT_TYPES = Object.freeze(['building_register', 'land_register', 'land_use_plan', 'registry']);

function decodeOriginal(row) {
  const encoded = row.fileData;
  if (!encoded || encoded.__daonBinary !== 'blob' || encoded.mimeType !== 'application/pdf' ||
      typeof encoded.base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded.base64) ||
      encoded.base64.length % 4 !== 0) throw new Error('invalid embedded PDF encoding');
  const bytes = Buffer.from(encoded.base64, 'base64');
  if (bytes.toString('base64') !== encoded.base64 || bytes.subarray(0, 5).toString() !== '%PDF-') {
    throw new Error('embedded original is not an intact PDF');
  }
  return bytes;
}

export function auditDataRoomBackup(backup, { propertyId, originalsDir } = {}) {
  if (backup?.schemaVersion !== 'daon-local-backup-v1' || !Array.isArray(backup?.stores?.propertyDocuments)) {
    throw new Error('unsupported backup schema or missing document store');
  }
  if (!propertyId || typeof propertyId !== 'string') throw new Error('propertyId is required');
  const seenIds = new Set();
  const documents = [];
  const integrityErrors = [];
  for (const entry of backup.stores.propertyDocuments) {
    const row = entry?.value;
    if (!row || typeof row !== 'object') { integrityErrors.push('invalid document row'); continue; }
    const id = String(row.id ?? '');
    if (!id || seenIds.has(id)) { integrityErrors.push('missing/duplicate document ID'); continue; }
    seenIds.add(id);
    if (row.propertyId !== propertyId) { integrityErrors.push(id + ': foreign Property'); continue; }
    if (row.deletedAt) continue;
    const filename = row.originalFileName;
    if (typeof filename !== 'string' || !filename || basename(filename) !== filename ||
        typeof row.storagePath !== 'string' || !row.storagePath.trim()) {
      integrityErrors.push(id + ': invalid filename/storage path'); continue;
    }
    try {
      const bytes = decodeOriginal(row);
      if (!Number.isSafeInteger(row.fileSize) || row.fileSize !== bytes.length) {
        throw new Error('embedded PDF byte length differs from recorded fileSize');
      }
      let originalMatches = null;
      if (originalsDir) {
        const path = join(originalsDir, filename);
        if (!existsSync(path)) throw new Error('Drive original not found in comparison directory');
        const original = readFileSync(path);
        originalMatches = bytes.length === original.length && timingSafeEqual(bytes, original);
        if (!originalMatches) throw new Error('embedded PDF differs from independent Drive original');
      }
      documents.push({ id, documentType: row.documentType, filename, bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        verificationStatus: row.verificationStatus, originalMatches });
    } catch (error) { integrityErrors.push(id + ': ' + error.message); }
  }
  const connectedTypes = REQUIRED_REPORT_DOCUMENT_TYPES.filter(type => documents.some(row => row.documentType === type));
  const officiallyVerifiedTypes = REQUIRED_REPORT_DOCUMENT_TYPES.filter(type =>
    documents.some(row => row.documentType === type && row.verificationStatus === 'verified'));
  const missingTypes = REQUIRED_REPORT_DOCUMENT_TYPES.filter(type => !connectedTypes.includes(type));
  const unverifiedTypes = REQUIRED_REPORT_DOCUMENT_TYPES.filter(type => !officiallyVerifiedTypes.includes(type));
  return { propertyId, schemaVersion: backup.schemaVersion, backupCreatedAt: backup.createdAt,
    integrity: integrityErrors.length ? 'FAIL' : 'PASS', integrityErrors, documents,
    readiness: integrityErrors.length || missingTypes.length || unverifiedTypes.length ? 'BLOCKED' : 'ELIGIBLE_FOR_LIVE_RECHECK',
    connectedTypes, officiallyVerifiedTypes, missingTypes, unverifiedTypes,
    note: 'Offline byte integrity is not official issuance verification or live Data Room/Snapshot readiness.' };
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--backup') options.backupPath = argv[++i];
    else if (argv[i] === '--property-id') options.propertyId = argv[++i];
    else if (argv[i] === '--originals-dir') options.originalsDir = argv[++i];
    else throw new Error('unknown argument: ' + argv[i]);
  }
  if (!options.backupPath || !options.propertyId) throw new Error('usage: node scripts/audit-dataroom-backup.mjs --backup PATH --property-id ID [--originals-dir PATH]');
  return options;
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  try {
    const { backupPath, propertyId, originalsDir } = parseArgs(process.argv.slice(2));
    const result = auditDataRoomBackup(JSON.parse(readFileSync(backupPath, 'utf8')), { propertyId, originalsDir });
    console.log(JSON.stringify(result, null, 2));
    if (result.integrity !== 'PASS') process.exitCode = 1;
  } catch (error) { console.error('FAIL offline Data Room audit: ' + error.message); process.exitCode = 1; }
}
