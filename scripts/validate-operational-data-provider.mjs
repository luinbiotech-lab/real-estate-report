import { existsSync, readFileSync } from 'node:fs';

const files = {
  mode: 'src/services/operationalDataMode.ts',
  property: 'src/repositories/propertyRepository.ts',
  dataRoom: 'src/repositories/propertyDataRoomRepository.ts',
  app: 'src/App.tsx',
  bootstrap: 'src/services/localBootstrapService.ts',
  docker: 'Dockerfile',
  render: 'render.yaml',
};

for (const file of Object.values(files)) if (!existsSync(file)) throw new Error(`Operational provider 필수 파일 누락: ${file}`);
const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readFileSync(file, 'utf8')]));

for (const marker of [
  "CUTOVER_MODE = import.meta.env.DEV || import.meta.env.VITE_CUTOVER_MODE === 'true'",
  "REMOTE_OPERATIONAL_MODE = import.meta.env.VITE_REMOTE_OPERATIONAL_MODE === 'true'",
  'CUTOVER_MODE && REMOTE_OPERATIONAL_MODE',
]) if (!text.mode.includes(marker)) throw new Error(`Operational mode 계약 누락: ${marker}`);

for (const marker of [
  'REMOTE_OPERATIONAL_MODE',
  'remoteDataGateway.listProperties()',
  'remoteDataGateway.getProperty(id)',
  'remoteDataGateway.upsertProperty(property)',
  'remoteDataGateway.deleteProperty(id)',
  'remoteDataGateway.getCompanySettings()',
  'remoteDataGateway.saveCompanySettings(value)',
]) if (!text.property.includes(marker)) throw new Error(`Remote Property repository 계약 누락: ${marker}`);

for (const marker of [
  'remoteAssetStorageGateway',
  "loadRemoteAsset<PropertyDocument>('document'",
  "loadRemoteAsset<PropertyMedia>('media'",
  "loadRemoteAsset<DigitalTwinAsset>('digital_twin'",
  'remoteDataGateway.listObjects',
  'remoteDataGateway.upsertObject',
  'remoteDataGateway.listVerificationCandidates',
  'remoteDataGateway.listVerifications',
  'remoteDataGateway.listReportSnapshots',
  'remoteDataGateway.createReportSnapshot',
  'Production Snapshot은 immutable입니다.',
]) if (!text.dataRoom.includes(marker)) throw new Error(`Remote Data Room repository 계약 누락: ${marker}`);

for (const forbidden of [
  "import { bangbae81511DataSeedService }",
  "import { streetViewProvenanceService }",
  'salePrice: 4150000000',
  "address: '서울 서초구 동광로18길 7'",
]) if (text.app.includes(forbidden)) throw new Error(`App production entry에 local seed가 남아 있습니다: ${forbidden}`);

if (!text.app.includes("await import('./services/localBootstrapService')")) throw new Error('Local bootstrap은 dynamic import여야 합니다.');
if (!text.bootstrap.includes("id: 'daon-bangbae-815-11'")) throw new Error('Cutover bootstrap은 별도 모듈에 유지되어야 합니다.');

for (const marker of [
  'ARG VITE_CUTOVER_MODE=false',
  'ARG VITE_REMOTE_OPERATIONAL_MODE=false',
  'VITE_CUTOVER_MODE=$VITE_CUTOVER_MODE',
  'VITE_REMOTE_OPERATIONAL_MODE=$VITE_REMOTE_OPERATIONAL_MODE',
]) if (!text.docker.includes(marker)) throw new Error(`Docker operational mode 계약 누락: ${marker}`);

console.log('Cutover -> remote operational provider switch: PASS');
