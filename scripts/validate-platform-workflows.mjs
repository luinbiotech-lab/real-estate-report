import { existsSync, readFileSync } from 'node:fs';

const files = {
  app: 'src/App.tsx', layout: 'src/components/Layout.tsx', propertyHub: 'src/pages/PropertyHubPage.tsx',
  reportHistoryPage: 'src/pages/ReportHistoryPage.tsx', reportHistoryService: 'src/services/reportSnapshotHistoryService.ts',
  twinIntakePage: 'src/pages/DigitalTwinIntakePage.tsx', twinIntakeService: 'src/services/digitalTwinAssetIntakeService.ts', orchestrator: 'src/services/agentOrchestratorService.ts', repository: 'src/repositories/propertyDataRoomRepository.ts',
  releasePanel: 'src/components/BuildingReleasePanel.tsx', releaseShareWorkspace: 'src/components/ReleaseShareWorkspace.tsx', releaseCollaboration: 'src/services/buildingReleaseCollaborationService.ts', releaseSharePackage: 'src/services/releaseSharePackageService.ts', externalShareCenter: 'src/pages/ExternalShareCenterPage.tsx', externalShareProvider: 'src/services/externalShareProviderService.ts',
  rentalIncomePage: 'src/pages/RentalIncomeWorkspacePage.tsx', rentalIncomeService: 'src/services/rentalIncomeScenarioService.ts',
  reviewHistoryPage: 'src/pages/ReviewHistoryPage.tsx', reviewHistoryService: 'src/services/reviewHistoryService.ts',
  interiorPage: 'src/pages/InteriorWorkspacePage.tsx', roomOpsPage: 'src/pages/RoomTwinOperationsPage.tsx',
  accessPage: 'src/pages/AccessManagementPage.tsx',
};
for (const file of Object.values(files)) if (!existsSync(file)) throw new Error(`플랫폼 workflow 필수 파일 누락: ${file}`);
const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readFileSync(file, 'utf8')]));

if (!text.app.includes('PropertyHubPage') || !text.app.includes('path="property/:id"') || !text.app.includes('path="property/:id/data-room"') || !text.app.includes('PropertyDataRoomPage')) throw new Error('물건 상세 메인 허브와 Data Room 세부 route를 분리해야 합니다.');
if (!text.propertyHub.includes('PROPERTY DETAIL HUB') || !text.propertyHub.includes('WORKSPACE NAVIGATION') || !text.propertyHub.includes('Data Room 전체보기')) throw new Error('물건 상세 허브는 핵심정보와 세부 Workspace 진입판을 제공해야 합니다.');
for (const label of ['사진 · 미디어', '문서 · 공적자료', '비교거래', '임대 · 수익 분석', '검토 이력', '보고서', '3D · 도면', '입지 브리핑']) if (!text.propertyHub.includes(label)) throw new Error(`물건 상세 허브 필수 항목 누락: ${label}`);
if (!text.propertyHub.includes('/income?propertyId=') || !text.propertyHub.includes('/review-history?propertyId=')) throw new Error('상세 허브는 선택 물건 context를 임대·수익/검토 이력으로 전달해야 합니다.');
if (!text.propertyHub.includes("label: 'Room Intelligence'") || !text.propertyHub.includes('/room-ops?propertyId=') || !text.propertyHub.includes('approvedRoomLinks')) throw new Error('상세 허브는 PropertySpace/승인 Room link 상태와 함께 Room Intelligence로 물건 context를 전달해야 합니다.');
if (!text.propertyHub.includes('대표 외관 미디어 미연결') || !text.propertyHub.includes('provenance')) throw new Error('대표미디어가 없을 때 가짜 사진 대신 미연결 상태와 provenance 원칙을 표시해야 합니다.');
for (const marker of ["Room Intelligence", "/room-ops?propertyId=", "Interior Intelligence", "/interior?propertyId="]) {
  if (!text.propertyHub.includes(marker)) throw new Error(`Property Hub는 물건 context를 Room/Interior Intelligence로 전달해야 합니다: ${marker}`);
}
const roomOpsPage = readFileSync('src/pages/RoomTwinOperationsPage.tsx', 'utf8');
const interiorWorkspace = readFileSync('src/pages/InteriorWorkspacePage.tsx', 'utf8');
for (const [name, source] of [['Room Twin Operations', roomOpsPage], ['Interior Workspace', interiorWorkspace]]) {
  for (const marker of ["useSearchParams", "searchParams.get('propertyId')", "requestedExists", "setSearchParams({ propertyId: nextId })"]) {
    if (!source.includes(marker)) throw new Error(`${name}는 propertyId query context를 유지해야 합니다: ${marker}`);
  }
}

const readinessService = readFileSync('src/services/propertyReadinessService.ts', 'utf8');
for (const marker of ['REQUIRED_DOCUMENT_TYPES', 'DOCUMENT_TYPE_LABELS', 'inventoryDocumentTypes', 'requiredConnected', 'requiredPresent', 'requiredVerified', 'requiredMissing', "documentState: ReadinessState", '원본확인 4/4 · 파일연결', '공식검증']) {
  if (!readinessService.includes(marker)) throw new Error(`Property Readiness 문서 단계는 원본확인+binary 연결+공식검증을 분리해야 합니다: ${marker}`);
}
for (const marker of ["source.resourceType === 'source_document_inventory'", "source.metadata?.originalSourcePresence === 'confirmed'", "type === 'registry_land' || type === 'registry_building' || type === 'registry'"]) {
  if (!readinessService.includes(marker)) throw new Error(`Source inventory 기반 문서 확보상태 계산 누락: ${marker}`);
}
if (readinessService.includes("state: bundle.documents.length > 0 ? 'ready' : 'missing'")) throw new Error('문서 1건만으로 Property Readiness를 READY 처리하면 안 됩니다.');
if (!readinessService.includes('export function assessRequiredDocumentReadiness')) throw new Error('필수 공적자료 readiness는 공통 함수로 유지해야 합니다.');
const dataRoomService = readFileSync('src/services/propertyDataRoomService.ts', 'utf8');
for (const marker of ['assessRequiredDocumentReadiness(bundle)', 'requiredSourcePresent', 'requiredBinaryConnected', 'requiredOfficiallyVerified', 'requiredDocumentTotal']) {
  if (!dataRoomService.includes(marker)) throw new Error(`Data Room summary는 공통 필수자료 readiness를 사용해야 합니다: ${marker}`);
}
for (const marker of ['문서 준비도', 'requiredSourcePresent', 'requiredBinaryConnected', 'requiredDocumentTotal']) {
  if (!text.propertyHub.includes(marker)) throw new Error(`Property Hub 문서 준비도 UI 누락: ${marker}`);
}

for (const marker of [
  'REMOTE OWNER BOOTSTRAP · ONE TIME',
  'REMOTE USER ADMIN · OWNER ONLY',
  'remoteAuthGateway.bootstrapOwner(ownerBootstrapKey)',
  'remoteAuthGateway.listProfiles()',
  'remoteAuthGateway.inviteUser(remoteInviteEmail, remoteInviteRole, remoteInviteName)',
  'remoteAuthGateway.updateRole(profile.userId, role)',
  'remoteAuthGateway.setActive(profile.userId, !profile.active)',
  "setOwnerBootstrapKey('')",
  "remoteSession?.role === 'owner'",
  "remoteSession && remoteSession.role !== 'owner'",
]) {
  if (!text.accessPage.includes(marker)) throw new Error(`REMOTE OWNER 운영 UI 계약 누락: ${marker}`);
}
if (!text.accessPage.includes('마지막 active OWNER 강등·비활성화') || !text.accessPage.includes('Edge Function/RLS가 최종 차단')) throw new Error('REMOTE OWNER 관리 UI는 서버 보안 경계를 명시해야 합니다.');

if (!text.app.includes('path="report-history"') || !text.layout.includes('to="/report-history"')) throw new Error('보고서 Snapshot 이력 화면의 route/navigation 연결이 필요합니다.');
if (!text.reportHistoryService.includes('isLatestReady') || !text.reportHistoryService.includes('archiveSupersededDrafts')) throw new Error('보고서 이력 서비스는 최신 확정본 식별과 이전 draft 보관 기능을 유지해야 합니다.');
if (!text.reportHistoryService.includes("snapshot.status === 'ready'") || !text.reportHistoryService.includes('확정된 Snapshot')) throw new Error('확정 Snapshot 임의 archive 차단 규칙을 유지해야 합니다.');
if (!text.reportHistoryPage.includes('최신 확정본') || !text.reportHistoryPage.includes('/professional-report/snapshot/')) throw new Error('보고서 이력 화면은 최신 확정본 표시와 Snapshot 미리보기를 제공해야 합니다.');

if (!text.app.includes('path="digital-twin-intake"') || !text.layout.includes('to="/digital-twin-intake"')) throw new Error('Digital Twin Intake route/navigation 연결이 필요합니다.');
if (!text.twinIntakeService.includes('MAX_ASSET_BYTES = 50 * 1024 * 1024') || !text.twinIntakeService.includes("dxf: 'dxf'") || !text.twinIntakeService.includes("dwg: 'dwg'") || !text.twinIntakeService.includes("glb: 'glb'")) throw new Error('Digital Twin Intake는 Production Storage 50MiB 한도와 핵심 형식 매핑을 유지해야 합니다.');
if (!text.twinIntakePage.includes('최대 50MiB') || !text.twinIntakePage.includes('Production private Storage와 동일 기준')) throw new Error('Digital Twin Intake UI는 Production과 동일한 50MiB 한도를 명시해야 합니다.');
if (!text.twinIntakeService.includes('saveDigitalTwinAsset(asset)') || !text.twinIntakeService.includes("resourceType: 'digital_twin_asset'")) throw new Error('Digital Twin 원본과 DataSource provenance를 함께 저장해야 합니다.');
for (const marker of ['uploadFromDocument', "document.documentType !== 'floor_plan'", 'document.fileData instanceof Blob', 'sourceDocumentId: document.id']) {
  if (!text.twinIntakeService.includes(marker)) throw new Error(`Data Room 평면도 → Digital Twin provenance 재사용 계약 누락: ${marker}`);
}
for (const marker of ['Data Room 평면도 재사용', 'getDocuments(id)', "document.documentType === 'floor_plan'", 'asset.sourceDocumentId === document.id', 'Digital Twin 연결']) {
  if (!text.twinIntakePage.includes(marker)) throw new Error(`Digital Twin Intake Data Room 재사용 UI 누락: ${marker}`);
}
for (const marker of ['getSpaces(id)', 'setFloorOptions(floors)', '층 미지정', 'floorOptions.map']) {
  if (!text.twinIntakePage.includes(marker)) throw new Error(`Digital Twin Intake는 검증된 PropertySpace 층 목록을 사용해야 합니다: ${marker}`);
}
if (!text.twinIntakeService.includes("queueDigitalTwin(saved, 'upload')") || !text.orchestrator.includes('async queueDigitalTwin')) throw new Error('Digital Twin 업로드는 Agent Human Review 흐름에 연결되어야 합니다.');
if (!text.twinIntakePage.includes('파일 선택 및 등록') || !text.twinIntakePage.includes("navigate('/digital-twin')")) throw new Error('Digital Twin Intake 화면은 업로드와 Workspace handoff를 제공해야 합니다.');
if (!text.repository.includes('getDigitalTwinAssets') || !text.repository.includes('saveDigitalTwinAsset')) throw new Error('Digital Twin asset repository read/write 경로를 유지해야 합니다.');

for (const [name, page] of [['Interior Workspace', text.interiorPage], ['Room Twin Operations', text.roomOpsPage]]) {
  for (const marker of ['useSearchParams', "searchParams.get('propertyId')", 'requestedExists', 'setSearchParams({ propertyId: nextId })']) {
    if (!page.includes(marker)) throw new Error(`${name} 물건 context 유지 계약 누락: ${marker}`);
  }
}

if (!text.app.includes('path="income"') || !text.layout.includes('to="/income"')) throw new Error('임대·수익 분석 route/navigation 연결이 필요합니다.');
if (!text.rentalIncomePage.includes('useSearchParams') || !text.rentalIncomePage.includes("searchParams.get('propertyId')")) throw new Error('임대·수익 Workspace는 허브에서 전달한 propertyId context를 유지해야 합니다.');
if (!text.rentalIncomePage.includes('임대 · 수익 분석') || !text.rentalIncomePage.includes('NOI') || !text.rentalIncomePage.includes('Cap Rate') || !text.rentalIncomePage.includes('Cash-on-Cash')) throw new Error('임대·수익 Workspace는 핵심 투자수익 지표를 제공해야 합니다.');
if (!text.rentalIncomePage.includes('시나리오 저장') || !text.rentalIncomePage.includes('저장된 시나리오')) throw new Error('임대·수익 Workspace는 복수 시나리오 저장/재사용을 제공해야 합니다.');
if (!text.rentalIncomeService.includes('calculateRentalIncomeMetrics') || !text.rentalIncomeService.includes('effectiveGrossIncome') || !text.rentalIncomeService.includes('cashOnCashReturnPct')) throw new Error('임대·수익 서비스는 EGI/NOI/Cap Rate/Cash-on-Cash 계산을 유지해야 합니다.');
if (!text.rentalIncomeService.includes("STORAGE_KEY = 'daon:rental-income-scenarios:v1'")) throw new Error('임대·수익 시나리오는 버전된 로컬 저장소에 보존되어야 합니다.');

if (!text.app.includes('path="review-history"') || !text.layout.includes('to="/review-history"')) throw new Error('검토 이력 통합 route/navigation 연결이 필요합니다.');
if (!text.reviewHistoryPage.includes('useSearchParams') || !text.reviewHistoryPage.includes("searchParams.get('propertyId')")) throw new Error('검토 이력 Workspace는 허브에서 전달한 propertyId context를 유지해야 합니다.');
if (!text.reviewHistoryPage.includes('검토 이력 통합') || !text.reviewHistoryPage.includes('자료 검증') || !text.reviewHistoryPage.includes('Agent Review') || !text.reviewHistoryPage.includes('외부 검토')) throw new Error('검토 이력 화면은 자료/Agent/보고서/외부검토를 한 화면에 제공해야 합니다.');
if (!text.reviewHistoryPage.includes('AUDIT TIMELINE') || !text.reviewHistoryPage.includes('시간순 검토 기록')) throw new Error('검토 이력 화면은 시간순 감사 타임라인을 제공해야 합니다.');
if (!text.reviewHistoryService.includes("kind: 'verification'") || !text.reviewHistoryService.includes("kind: 'agent_review'") || !text.reviewHistoryService.includes("kind: 'report_snapshot'") || !text.reviewHistoryService.includes("kind: 'external_review'")) throw new Error('검토 이력 서비스는 4개 원천을 모두 통합해야 합니다.');
if (!text.reviewHistoryService.includes(".sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))")) throw new Error('통합 검토 이력은 최신순으로 정렬되어야 합니다.');

if (!text.releasePanel.includes("import ReleaseShareWorkspace from './ReleaseShareWorkspace'") || !text.releasePanel.includes('<ReleaseShareWorkspace')) throw new Error('Building Release 화면은 외부 공유·원격 검토 Workspace를 연결해야 합니다.');
if (!text.releaseShareWorkspace.includes('SHARE READY') || !text.releaseShareWorkspace.includes('SHARE BLOCKED') || !text.releaseShareWorkspace.includes('ACCESS POLICY') || !text.releaseShareWorkspace.includes('SHARE HISTORY') || !text.releaseShareWorkspace.includes('REVIEW LOOP')) throw new Error('외부 공유 Workspace는 준비상태, 접근정책, 공유이력, 검토루프를 모두 제공해야 합니다.');
if (!text.releaseShareWorkspace.includes("lifecycleStatus === 'current'") || !text.releaseShareWorkspace.includes('integrityValid === true')) throw new Error('새 외부 공유는 CURRENT + integrity verified Snapshot에서만 허용해야 합니다.');
if (!text.releaseShareWorkspace.includes('revokeShare') || !text.releaseShareWorkspace.includes('resolveNote')) throw new Error('외부 공유는 회수와 검토 코멘트 해결 처리를 제공해야 합니다.');
if (!text.releaseShareWorkspace.includes('releaseSharePackageService.toHtml') || !text.releaseShareWorkspace.includes('공유 HTML')) throw new Error('공유 이력에서 standalone 원격검토 HTML 패키지를 생성할 수 있어야 합니다.');
if (!text.releaseCollaboration.includes("status: 'active' | 'revoked' | 'expired'") || !text.releaseCollaboration.includes("access: 'read_only'")) throw new Error('공유 lifecycle 및 read-only 접근정책을 유지해야 합니다.');
if (!text.releaseCollaboration.includes('expiresAt') || !text.releaseCollaboration.includes('allowDownload') || !text.releaseCollaboration.includes('token')) throw new Error('공유 manifest는 token/expiry/download policy를 유지해야 합니다.');
if (!text.releaseCollaboration.includes('listAllShares') || !text.releaseCollaboration.includes('listAllReviewNotes')) throw new Error('외부 공유 센터는 전체 공유/검토 감사대장을 조회할 수 있어야 합니다.');
if (!text.releaseSharePackage.includes('READ ONLY SHARE') || !text.releaseSharePackage.includes('RELEASE_SHARE_PACKAGE_VERSION')) throw new Error('standalone 공유 HTML은 읽기전용 정책과 package version을 표시해야 합니다.');
if (!text.releaseSharePackage.includes("SHARE.status!=='active'") || !text.releaseSharePackage.includes('Date.now()>=new Date(SHARE.expiresAt).getTime()')) throw new Error('standalone 공유 HTML은 회수/만료 상태에서 열람을 차단해야 합니다.');
if (!text.releaseSharePackage.includes('constructionReady=false / legalBimReady=false')) throw new Error('standalone 공유 HTML은 비시공·비법정 BIM 안전 경계를 유지해야 합니다.');

if (!text.externalShareProvider.includes("'local_offline' | 'remote_public'")) throw new Error('외부공유 Provider는 local/offline과 remote/public을 명시적으로 분리해야 합니다.');
if ((text.externalShareProvider.match(/availability: 'ready'/g) ?? []).length < 2) throw new Error('LOCAL/OFFLINE과 REMOTE/PUBLIC Provider 모두 production READY여야 합니다.');
for (const capability of ['publicUrl', 'remoteRevoke', 'serverExpiry', 'authenticatedAccess', 'syncedReview']) if (!text.externalShareProvider.includes(capability)) throw new Error(`외부공유 Provider capability 누락: ${capability}`);
if (!text.externalShareProvider.includes('Supabase REMOTE / PUBLIC server와 self-hosted read-only viewer가 연결되어 있습니다.')) throw new Error('Remote Provider production 연결상태를 명시해야 합니다.');

if (!text.app.includes('path="external-shares"') || !text.layout.includes('to="/external-shares"')) throw new Error('외부 공유 센터 route/navigation 연결이 필요합니다.');
if (!text.externalShareCenter.includes('외부 공유 센터') || !text.externalShareCenter.includes('ACTIVE') || !text.externalShareCenter.includes('EXPIRED') || !text.externalShareCenter.includes('REVOKED')) throw new Error('외부 공유 센터는 전체/활성/만료/회수 상태를 요약해야 합니다.');
if (!text.externalShareCenter.includes('LOCAL / OFFLINE') || !text.externalShareCenter.includes('REMOTE / PUBLIC') || !text.externalShareCenter.includes('REMOTE / PUBLIC Provider는 READY입니다.')) throw new Error('외부 공유 센터는 Local/Remote Provider 상태를 구분해 표시해야 합니다.');
if (!text.externalShareCenter.includes('REMOTE / PUBLIC으로 발급한 URL은 서버에서 실제 revoke할 수 있습니다.')) throw new Error('LOCAL standalone과 REMOTE revoke 경계를 구분해야 합니다.');
if (!text.externalShareCenter.includes('releaseSharePackageService.toHtml') || !text.externalShareCenter.includes('revokeShare')) throw new Error('외부 공유 센터에서 standalone HTML 재생성과 공유 회수가 가능해야 합니다.');
if (!text.externalShareCenter.includes('감사대장 CSV') || !text.externalShareCenter.includes('감사대장 JSON') || !text.externalShareCenter.includes('daon-external-share-audit-v1')) throw new Error('외부 공유 센터는 감사대장 CSV/JSON 내보내기를 제공해야 합니다.');
if (!text.externalShareCenter.includes('이미 외부에 전달된 standalone HTML 파일은 삭제하거나 원격 차단할 수 없습니다')) throw new Error('로컬 standalone HTML의 원격 회수 불가 안전경계를 명시해야 합니다.');

console.log('Platform workflow integrity: PASS');