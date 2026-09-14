import { existsSync, readFileSync } from 'node:fs';

const files = {
  dataRoom: 'src/pages/PropertyDataRoomPage.tsx',
  onePage: 'src/pages/DocumentPreview.tsx',
  snapshotPage: 'src/pages/ProfessionalReportSnapshotPage.tsx',
  snapshotService: 'src/services/reportEngine/reportSnapshotService.ts',
  dataBuilder: 'src/services/reportEngine/reportDataBuilder.ts',
  dataRoomService: 'src/services/propertyDataRoomService.ts',
  dataRoomRepository: 'src/repositories/propertyDataRoomRepository.ts',
  buildingFloorService: 'src/services/buildingRegisterFloorService.ts',
  extractionPanel: 'src/components/propertyDataRoom/DocumentExtractionPanel.tsx',
  detailMaster: 'src/components/professionalReport/DaonDetail7PageMaster.tsx',
  app: 'src/App.tsx',
};

for (const file of Object.values(files)) {
  if (!existsSync(file)) throw new Error(`보고서 파이프라인 필수 파일 누락: ${file}`);
}

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readFileSync(file, 'utf8')]));

if (!text.app.includes('path="document/:kind/:id"') || !text.app.includes('ProfessionalReportSnapshotPage')) {
  throw new Error('1P/7P 보고서 라우트 연결이 누락되었습니다.');
}
if (!text.dataRoom.includes('/document/report/${property.id}') || !text.dataRoom.includes('/document/proposal/${property.id}')) {
  throw new Error('Data Room에서 1P/7P 보고서 진입 경로를 유지해야 합니다.');
}
if (!text.onePage.includes('DaonOnePageMaster')) {
  throw new Error('1P 미리보기는 DAON_1P_MASTER renderer를 사용해야 합니다.');
}
if (!text.snapshotPage.includes('DaonDetail7PageMaster') || !text.snapshotPage.includes('최신 데이터로 다시 생성')) {
  throw new Error('7P Snapshot 화면은 DAON_DETAIL_7P_MASTER와 최신 데이터 재생성 경로를 제공해야 합니다.');
}
if (!text.snapshotPage.includes('disabled={confirming || !reportReady}')) {
  throw new Error('검증 미완료 보고서의 확정 버튼은 비활성화되어야 합니다.');
}
if (!text.snapshotService.includes('viewModel.dataQuality.reportReady')) {
  throw new Error('서비스 계층에서도 검증 미완료 보고서 확정을 차단해야 합니다.');
}
if (!text.dataBuilder.includes("dataPolicy: 'property-and-data-room-only'")) {
  throw new Error('보고서 데이터 정책은 Property + Data Room only를 유지해야 합니다.');
}
if (!text.dataRoomService.includes('requiredDocumentsVerified') || !text.dataRoomService.includes('activeCandidates.length === 0')) {
  throw new Error('보고서 준비도는 필수 공적자료 검증과 미처리 후보 0건을 모두 확인해야 합니다.');
}
if (!text.dataRoomRepository.includes("db.transaction(['properties', 'propertyVerificationCandidates', 'propertyVerifications', 'propertyDataSources'], 'readwrite')")) {
  throw new Error('검증 승인 반영은 Property/후보/검증/출처를 하나의 IndexedDB transaction으로 처리해야 합니다.');
}
if (!text.dataRoomRepository.includes('createNextReportSnapshot')) {
  throw new Error('보고서는 immutable versioned Snapshot으로 생성되어야 합니다.');
}
if (!text.buildingFloorService.includes('parseBuildingRegisterFloorText') || !text.buildingFloorService.includes("resourceType: 'property_space'")) {
  throw new Error('건축물대장 층별 데이터는 구조화 파서와 PropertySpace DataSource를 통해 연결되어야 합니다.');
}
if (!text.buildingFloorService.includes('saveVerification') || !text.buildingFloorService.includes("sourceType: 'official_document'")) {
  throw new Error('층별 PropertySpace에는 공식문서 DataSource와 Verification 이력이 함께 저장되어야 합니다.');
}
if (!text.extractionPanel.includes('층별 구성 Data Room 연결') || !text.extractionPanel.includes('buildingRegisterFloorService.parseText')) {
  throw new Error('건축물대장 추출 화면에서 검토 후 층별 구성 연결 경로를 제공해야 합니다.');
}
if (!text.dataBuilder.includes('floors: floorSpaces') || !text.dataBuilder.includes("const fieldKey = `space:${space.id}`")) {
  throw new Error('ReportViewModel은 Data Room PropertySpace와 provenance를 층별 구성으로 매핑해야 합니다.');
}
if (!text.detailMaster.includes('model.building.floors') || text.detailMaster.includes('층별 임대·이용 현황')) {
  throw new Error('7P 2페이지는 층별 placeholder가 아니라 ReportViewModel 실데이터를 렌더링해야 합니다.');
}

console.log('DA:ON report pipeline integrity: PASS');