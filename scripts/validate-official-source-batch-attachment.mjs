import { readFileSync } from 'node:fs';

const file = 'src/pages/PropertyDataRoomPage.tsx';
const text = readFileSync(file, 'utf8');

for (const marker of [
  'const uploadSourceDocuments = async',
  'Array.from(event.target.files ?? [])',
  "source.resourceType === 'source_document_inventory'",
  'propertyDataRoomService.validateDocument(file)',
  'normalizedSourceFileName(file.name)',
  "inventoryType === 'registry_land' || inventoryType === 'registry_building' || inventoryType === 'registry'",
  'matchedSourceIds.has(source.id)',
  'sourceInventoryDocumentMatches(source, document)',
  'propertyDataRoomService.uploadDocument(id, plan.file',
  'matchedDocumentId: savedDocument.id',
  "binaryStorageStatus: plan.source.metadata?.binaryStorageStatus === 'connected' ? 'connected' : 'not_connected'",
  "multiple type=\"file\"",
  '공적자료 일괄 연결',
]) {
  if (!text.includes(marker)) throw new Error(`공적자료 일괄 연결 계약 누락: ${marker}`);
}

if (!text.includes('matches.length !== 1')) {
  throw new Error('공적자료 일괄 연결은 source inventory 단일 매칭을 강제해야 합니다.');
}
if (!text.includes('이미 이관 파일이 연결된 공적자료입니다')) {
  throw new Error('공적자료 일괄 연결은 기존 binary 연결 중복을 차단해야 합니다.');
}

console.log('Official source batch attachment boundary: PASS');
