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
  releasePanel: 'src/components/BuildingReleasePanel.tsx',
  releaseShareWorkspace: 'src/components/ReleaseShareWorkspace.tsx',
  releaseCollaboration: 'src/services/buildingReleaseCollaborationService.ts',
  releaseSharePackage: 'src/services/releaseSharePackageService.ts',
  externalShareCenter: 'src/pages/ExternalShareCenterPage.tsx',
};

for (const file of Object.values(files)) {
  if (!existsSync(file)) throw new Error(`플랫폼 workflow 필수 파일 누락: ${file}`);
}

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readFileSync(file, 'utf8')]));

if (!text.app.includes('path="report-history"') || !text.layout.includes('to="/report-history"')) throw new Error('보고서 Snapshot 이력 화면의 route/navigation 연결이 필요합니다.');
if (!text.reportHistoryService.includes('isLatestReady') || !text.reportHistoryService.includes('archiveSupersededDrafts')) throw new Error('보고서 이력 서비스는 최신 확정본 식별과 이전 draft 보관 기능을 유지해야 합니다.');
if (!text.reportHistoryService.includes("snapshot.status === 'ready'") || !text.reportHistoryService.includes('확정된 Snapshot')) throw new Error('확정 Snapshot 임의 archive 차단 규칙을 유지해야 합니다.');
if (!text.reportHistoryPage.includes('최신 확정본') || !text.reportHistoryPage.includes('/professional-report/snapshot/')) throw new Error('보고서 이력 화면은 최신 확정본 표시와 Snapshot 미리보기를 제공해야 합니다.');

if (!text.app.includes('path="digital-twin-intake"') || !text.layout.includes('to="/digital-twin-intake"')) throw new Error('Digital Twin Intake route/navigation 연결이 필요합니다.');
if (!text.twinIntakeService.includes('MAX_ASSET_BYTES = 80 * 1024 * 1024') || !text.twinIntakeService.includes("dxf: 'dxf'") || !text.twinIntakeService.includes("dwg: 'dwg'") || !text.twinIntakeService.includes("glb: 'glb'")) throw new Error('Digital Twin Intake의 파일 제한과 핵심 형식 매핑을 유지해야 합니다.');
if (!text.twinIntakeService.includes('saveDigitalTwinAsset(asset)') || !text.twinIntakeService.includes("resourceType: 'digital_twin_asset'")) throw new Error('Digital Twin 원본과 DataSource provenance를 함께 저장해야 합니다.');
if (!text.twinIntakeService.includes("queueDigitalTwin(saved, 'upload')") || !text.orchestrator.includes('async queueDigitalTwin')) throw new Error('Digital Twin 업로드는 Agent Human Review 흐름에 연결되어야 합니다.');
if (!text.twinIntakePage.includes('파일 선택 및 등록') || !text.twinIntakePage.includes("navigate('/digital-twin')")) throw new Error('Digital Twin Intake 화면은 업로드와 Workspace handoff를 제공해야 합니다.');
if (!text.repository.includes('getDigitalTwinAssets') || !text.repository.includes('saveDigitalTwinAsset')) throw new Error('Digital Twin asset repository read/write 경로를 유지해야 합니다.');

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

if (!text.app.includes('path="external-shares"') || !text.layout.includes('to="/external-shares"')) throw new Error('외부 공유 센터 route/navigation 연결이 필요합니다.');
if (!text.externalShareCenter.includes('외부 공유 센터') || !text.externalShareCenter.includes('ACTIVE') || !text.externalShareCenter.includes('EXPIRED') || !text.externalShareCenter.includes('REVOKED')) throw new Error('외부 공유 센터는 전체/활성/만료/회수 상태를 요약해야 합니다.');
if (!text.externalShareCenter.includes('releaseSharePackageService.toHtml') || !text.externalShareCenter.includes('revokeShare')) throw new Error('외부 공유 센터에서 standalone HTML 재생성과 공유 회수가 가능해야 합니다.');

console.log('Platform workflow integrity: PASS');
