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
  comparableService: 'src/services/comparableTransactionService.ts',
  bangbaeSeed: 'src/services/bangbae81511DataSeedService.ts',
  comparablePanel: 'src/components/propertyDataRoom/ComparableTransactionPanel.tsx',
  comparableOverviewPanel: 'src/components/propertyDataRoom/ComparableTransactionOverviewPanel.tsx',
  streetViewProvenance: 'src/services/streetViewProvenanceService.ts',
  mediaPanel: 'src/components/propertyDataRoom/MediaClassificationPanel.tsx',
  extractionPanel: 'src/components/propertyDataRoom/DocumentExtractionPanel.tsx',
  spaceOverviewPanel: 'src/components/propertyDataRoom/PropertySpaceOverviewPanel.tsx',
  detailMaster: 'src/components/professionalReport/DaonDetail7PageMaster.tsx',
  professionalMaster: 'src/components/professionalReport/DaonProfessionalReportMaster.tsx',
  accessPolicy: 'src/domain/professionalReport/reportAccessPolicy.ts',
  app: 'src/App.tsx',
};

for (const file of Object.values(files)) {
  if (!existsSync(file)) throw new Error(`보고서 파이프라인 필수 파일 누락: ${file}`);
}

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readFileSync(file, 'utf8')]));

if (!text.app.includes('path="document/:kind/:id"') || !text.app.includes('ProfessionalReportSnapshotPage')) throw new Error('1P/7P 보고서 라우트 연결이 누락되었습니다.');
if (!text.dataRoom.includes('/document/report/${property.id}') || !text.dataRoom.includes('/document/proposal/${property.id}')) throw new Error('Data Room에서 1P/7P 보고서 진입 경로를 유지해야 합니다.');
if (!text.onePage.includes('DaonOnePageMaster')) throw new Error('1P 미리보기는 DAON_1P_MASTER renderer를 사용해야 합니다.');
if (!text.onePage.includes('propertyDataRoomRepository.getBundle(id)') || !text.onePage.includes('reportMediaCategoryAllowed(item.category, allowInternal)') || !text.onePage.includes('allowInternal ? (value.mainImage || dataRoomHero) : dataRoomHero')) throw new Error('1P는 Data Room 미디어와 중앙 내부사진 제외 정책을 통해 안전한 대표 외관을 선택해야 합니다.');
if (!text.snapshotPage.includes('DaonProfessionalReportMaster') || !text.snapshotPage.includes('최신 데이터로 다시 생성')) throw new Error('Snapshot 화면은 DAON PROFESSIONAL MASTER와 최신 데이터 재생성 경로를 제공해야 합니다.');
if (!text.professionalMaster.includes('DaonReportOpeningPage') || !text.professionalMaster.includes('DaonPropertySummaryMasterPage') || !text.professionalMaster.includes('DaonInvestmentAnalysisMasterPage') || !text.professionalMaster.includes('DaonDevelopmentDeepDiveMasterPage') || !text.professionalMaster.includes('DaonReportClosingPage')) throw new Error('DAON PROFESSIONAL MASTER는 OPENING + SUMMARY + ANALYSIS + DEVELOPMENT + CLOSING 구조를 유지해야 합니다.');
if (!text.snapshotPage.includes('applySnapshotMediaPolicy') || !text.snapshotPage.includes("item.id !== 'property-main'") || !text.snapshotPage.includes("item.category !== 'additional'")) throw new Error('7P Snapshot 경계는 내부사진 제외 물건의 미분류 직접 대표이미지와 추가이미지를 제거해야 합니다.');
if (!text.snapshotPage.includes('disabled={confirming || !reportReady}')) throw new Error('검증 미완료 보고서의 확정 버튼은 비활성화되어야 합니다.');
if (!text.snapshotPage.includes('comparables: snapshot.snapshotData.investment.comparables ?? []')) throw new Error('기존 immutable Snapshot은 신규 비교거래 배열 누락 시 안전하게 정규화되어야 합니다.');
if (!text.snapshotService.includes('viewModel.dataQuality.reportReady')) throw new Error('서비스 계층에서도 검증 미완료 보고서 확정을 차단해야 합니다.');
if (!text.dataBuilder.includes("dataPolicy: 'property-and-data-room-only'")) throw new Error('보고서 데이터 정책은 Property + Data Room only를 유지해야 합니다.');
if (!text.dataRoomService.includes('requiredDocumentsVerified') || !text.dataRoomService.includes('activeCandidates.length === 0')) throw new Error('보고서 준비도는 필수 공적자료 검증과 미처리 후보 0건을 모두 확인해야 합니다.');
if (!text.dataRoomRepository.includes("db.transaction(['properties', 'propertyVerificationCandidates', 'propertyVerifications', 'propertyDataSources'], 'readwrite')")) throw new Error('검증 승인 반영은 Property/후보/검증/출처를 하나의 IndexedDB transaction으로 처리해야 합니다.');
if (!text.dataRoomRepository.includes('createNextReportSnapshot')) throw new Error('보고서는 immutable versioned Snapshot으로 생성되어야 합니다.');
if (!text.buildingFloorService.includes('parseBuildingRegisterFloorText') || !text.buildingFloorService.includes("resourceType: 'property_space'")) throw new Error('건축물대장 층별 데이터는 구조화 파서와 PropertySpace DataSource를 통해 연결되어야 합니다.');
if (!text.buildingFloorService.includes('saveVerification') || !text.buildingFloorService.includes("sourceType: 'official_document'")) throw new Error('층별 PropertySpace에는 공식문서 DataSource와 Verification 이력이 함께 저장되어야 합니다.');
if (!text.extractionPanel.includes('층별 구성 Data Room 연결') || !text.extractionPanel.includes('buildingRegisterFloorService.parseText')) throw new Error('건축물대장 추출 화면에서 검토 후 층별 구성 연결 경로를 제공해야 합니다.');
if (!text.dataBuilder.includes('floors: floorSpaces') || !text.dataBuilder.includes("const fieldKey = `space:${space.id}`")) throw new Error('ReportViewModel은 Data Room PropertySpace와 provenance를 층별 구성으로 매핑해야 합니다.');
if (!text.detailMaster.includes('model.building.floors') || text.detailMaster.includes('층별 임대·이용 현황')) throw new Error('7P 2페이지는 층별 placeholder가 아니라 ReportViewModel 실데이터를 렌더링해야 합니다.');
if (!text.comparableService.includes("resourceType: 'comparable_transaction_set'") || !text.comparableService.includes("sourceType: 'market_data'") || !text.comparableService.includes('saveVerification')) throw new Error('비교거래는 market_data DataSource와 Verification을 함께 저장해야 합니다.');
if (!text.comparablePanel.includes('비교거래 저장 및 보고서 연결') || !text.dataRoom.includes('value="market"')) throw new Error('Data Room은 사용자가 구조화 비교거래를 입력·갱신할 수 있는 경로를 제공해야 합니다.');
if (!text.dataBuilder.includes('comparables: comparableRows(bundle)') || !text.detailMaster.includes('model.investment.comparables')) throw new Error('7P 4페이지는 구조화 비교거래 DataSource를 ReportViewModel을 통해 렌더링해야 합니다.');
if (!text.mediaPanel.includes("'exterior', 'road', 'surroundings'") || !text.dataRoom.includes('MediaClassificationPanel')) throw new Error('Data Room은 외관·도로·주변 미디어를 보고서용 category로 분류할 수 있어야 합니다.');
if (!text.accessPolicy.includes('INTERNAL_MEDIA_CATEGORIES') || !text.accessPolicy.includes("'interior'") || !text.accessPolicy.includes("'lobby'") || !text.accessPolicy.includes("'office'") || !text.accessPolicy.includes("'corridor'") || !text.accessPolicy.includes("'restroom'") || !text.accessPolicy.includes("'basement'") || !text.accessPolicy.includes("'mechanical_room'")) throw new Error('내부사진 제외 정책은 대표적인 실내 카테고리 전체를 중앙 정책으로 관리해야 합니다.');
if (!text.dataBuilder.includes('reportMediaCategoryAllowed(media.category, allowInternal)') || !text.detailMaster.includes('reportMediaCategoryAllowed(item.category, model.media.internalPhotoAllowed)')) throw new Error('Builder와 7P renderer는 동일한 중앙 미디어 접근정책을 사용해야 합니다.');
if (!text.mediaPanel.includes('lockedInternal') || !text.mediaPanel.includes('보고서 제외 고정') || !text.mediaPanel.includes('isInternalMediaCategory(item.category)')) throw new Error('내부사진 제외 물건의 기존 실내 미디어는 Data Room UI에서 외부 카테고리로 우회 변경할 수 없어야 합니다.');
if (!text.dataRoomRepository.includes('REPORT_MEDIA_PRIORITY') || !text.dataRoomRepository.includes('exterior: 0') || !text.dataRoomRepository.includes('road: 1') || !text.dataRoomRepository.includes('surroundings: 2') || !text.dataRoomRepository.includes('sortReportMedia')) throw new Error('Professional Report 미디어는 외관 → 도로 → 주변환경 우선순위를 유지해야 합니다.');
if (!text.streetViewProvenance.includes("resourceType: 'exterior_streetview_verification'") || !text.streetViewProvenance.includes("sourceType: 'map_provider'") || !text.streetViewProvenance.includes("verificationStatus: 'confirmed'") || !text.streetViewProvenance.includes("reportImageAsset: false")) throw new Error('거리뷰 외관 확인은 직접 촬영 asset과 분리된 map-provider provenance로 보존해야 합니다.');
if (!text.app.includes('bangbae81511DataSeedService.ensure()') || !text.bangbaeSeed.includes("const PROPERTY_ID = 'daon-bangbae-815-11'")) throw new Error('방배동 샘플 Data Room 실데이터 bootstrap 경로를 유지해야 합니다.');
if (!text.bangbaeSeed.includes("verificationStatus: 'verified'") || !text.bangbaeSeed.includes("sourceDate: BUILDING_SOURCE_DATE") || !text.bangbaeSeed.includes("sourceVerified: true") || !text.bangbaeSeed.includes("comparableSource.sourceReference === '방배동 실거래사례1년간.pdf'")) throw new Error('방배동 bootstrap은 원본 대조가 끝난 건축물대장·비교거래 provenance만 verified로 승격해야 합니다.');
if (!text.bangbaeSeed.includes("key: '3f', floor: '3F'") || !text.bangbaeSeed.includes("key: '1f', floor: '1F'") || !text.bangbaeSeed.includes("key: '1f-shop', floor: '1F'") || !text.bangbaeSeed.includes("key: 'b1', floor: 'B1'") || !text.bangbaeSeed.includes("areaSqm: 40.99") || !text.bangbaeSeed.includes("label: '방배동 448-37'")) throw new Error('방배동 건축물대장 원본 기준 공간 5행(1층 2용도 분리)과 비교거래 6건 seed 데이터가 누락되었습니다.');
if (!text.dataRoom.includes("import PropertySpaceOverviewPanel from '../components/propertyDataRoom/PropertySpaceOverviewPanel'") || !text.dataRoom.includes('<PropertySpaceOverviewPanel spaces={bundle.spaces ?? []} sources={bundle.dataSources} />')) throw new Error('Data Room 개요에서 구조화 PropertySpace 층별 구성을 직접 확인할 수 있어야 합니다.');
if (!text.spaceOverviewPanel.includes('OFFICIAL FLOOR STRUCTURE') || !text.spaceOverviewPanel.includes('층별 구성 · Data Room') || !text.spaceOverviewPanel.includes('원본 문서 대조가 완료된 항목만 verified로 관리합니다.')) throw new Error('층별 구성 패널은 공부상 층·면적·검증상태·출처와 원본 대조 기준을 명확히 표시해야 합니다.');
if (!text.dataRoom.includes("import ComparableTransactionOverviewPanel from '../components/propertyDataRoom/ComparableTransactionOverviewPanel'") || !text.dataRoom.includes("<ComparableTransactionOverviewPanel sources={bundle.dataSources} onOpenMarket={() => onTab('market')} />")) throw new Error('Data Room 개요에서 구조화 비교거래 요약을 직접 확인하고 전체 비교거래로 이동할 수 있어야 합니다.');
if (!text.comparableOverviewPanel.includes('MARKET COMPARABLES') || !text.comparableOverviewPanel.includes('비교거래 요약') || !text.comparableOverviewPanel.includes('토지 평당가 범위') || !text.comparableOverviewPanel.includes('source?.sourceReference')) throw new Error('비교거래 요약은 거래건수·평당가 범위·최근 거래일·원문 출처를 표시해야 합니다.');

console.log('DA:ON report pipeline integrity: PASS');