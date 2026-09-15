import { existsSync, readFileSync } from 'node:fs';

const files = {
  app: 'src/App.tsx',
  layout: 'src/components/Layout.tsx',
  reportHistoryPage: 'src/pages/ReportHistoryPage.tsx',
  reportHistoryService: 'src/services/reportSnapshotHistoryService.ts',
  twinIntakePage: 'src/pages/DigitalTwinIntakePage.tsx',
  twinIntakeService: 'src/services/digitalTwinAssetIntakeService.ts',
  orchestrator: 'src/services/agentOrchestratorService.ts',
  repository: 'src/repositories/propertyDataRoomRepository.ts',
};

for (const file of Object.values(files)) {
  if (!existsSync(file)) throw new Error(`플랫폼 workflow 필수 파일 누락: ${file}`);
}

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readFileSync(file, 'utf8')]));

if (!text.app.includes('path="report-history"') || !text.layout.includes('to="/report-history"')) {
  throw new Error('보고서 Snapshot 이력 화면의 route/navigation 연결이 필요합니다.');
}
if (!text.reportHistoryService.includes('isLatestReady') || !text.reportHistoryService.includes('archiveSupersededDrafts')) {
  throw new Error('보고서 이력 서비스는 최신 확정본 식별과 이전 draft 보관 기능을 유지해야 합니다.');
}
if (!text.reportHistoryService.includes("snapshot.status === 'ready'") || !text.reportHistoryService.includes('확정된 Snapshot')) {
  throw new Error('확정 Snapshot 임의 archive 차단 규칙을 유지해야 합니다.');
}
if (!text.reportHistoryPage.includes('최신 확정본') || !text.reportHistoryPage.includes('/professional-report/snapshot/')) {
  throw new Error('보고서 이력 화면은 최신 확정본 표시와 Snapshot 미리보기를 제공해야 합니다.');
}

if (!text.app.includes('path="digital-twin-intake"') || !text.layout.includes('to="/digital-twin-intake"')) {
  throw new Error('Digital Twin Intake route/navigation 연결이 필요합니다.');
}
if (!text.twinIntakeService.includes('MAX_ASSET_BYTES = 80 * 1024 * 1024') || !text.twinIntakeService.includes("dxf: 'dxf'") || !text.twinIntakeService.includes("dwg: 'dwg'") || !text.twinIntakeService.includes("glb: 'glb'")) {
  throw new Error('Digital Twin Intake의 파일 제한과 핵심 형식 매핑을 유지해야 합니다.');
}
if (!text.twinIntakeService.includes('saveDigitalTwinAsset(asset)') || !text.twinIntakeService.includes("resourceType: 'digital_twin_asset'")) {
  throw new Error('Digital Twin 원본과 DataSource provenance를 함께 저장해야 합니다.');
}
if (!text.twinIntakeService.includes("queueDigitalTwin(saved, 'upload')") || !text.orchestrator.includes('async queueDigitalTwin')) {
  throw new Error('Digital Twin 업로드는 Agent Human Review 흐름에 연결되어야 합니다.');
}
if (!text.twinIntakePage.includes('파일 선택 및 등록') || !text.twinIntakePage.includes("navigate('/digital-twin')")) {
  throw new Error('Digital Twin Intake 화면은 업로드와 Workspace handoff를 제공해야 합니다.');
}
if (!text.repository.includes('getDigitalTwinAssets') || !text.repository.includes('saveDigitalTwinAsset')) {
  throw new Error('Digital Twin asset repository read/write 경로를 유지해야 합니다.');
}

console.log('Platform workflow integrity: PASS');
