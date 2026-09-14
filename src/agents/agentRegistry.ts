import type { AgentType } from '../domain/propertyDataRoom/types';

export type PlatformAgentId = 'integrator' | 'intake' | 'document' | 'verification' | 'interior_vision' | 'space' | 'floor_plan_geometry' | 'digital_twin' | 'renovation' | 'risk_compliance' | 'collaboration_viewer' | 'report';

export interface PlatformAgentDefinition {
  id: PlatformAgentId;
  code: `A${number}`;
  name: string;
  shortName: string;
  purpose: string;
  owns: string[];
  upstream: PlatformAgentId[];
  downstream: PlatformAgentId[];
  runtimeAgentType?: AgentType;
  workspacePath: string;
  launchPath?: string;
  status: 'active' | 'deferred';
  humanReviewRequired: boolean;
}

export const PLATFORM_AGENT_REGISTRY: PlatformAgentDefinition[] = [
  { id: 'integrator', code: 'A0', name: 'Integrator / Control Center', shortName: 'Control Center', purpose: 'Property 단위로 Agent 상태·검토 대기·데이터 연결 상태를 통합 관제합니다.', owns: ['Agent registry', 'Property orchestration', 'Cross-agent status', 'Navigation'], upstream: [], downstream: ['intake','document','verification','interior_vision','space','floor_plan_geometry','digital_twin','renovation','risk_compliance','collaboration_viewer','report'], workspacePath: '/control-center', status: 'active', humanReviewRequired: false },
  { id: 'intake', code: 'A1', name: 'Intake Agent', shortName: 'Intake', purpose: '문서·사진·도면 원본을 수집하고 파일 유형과 기본 provenance를 등록합니다.', owns: ['Bulk intake', 'Media intake', 'Document intake', 'CAD intake'], upstream: [], downstream: ['document','interior_vision','floor_plan_geometry'], runtimeAgentType: 'intake', workspacePath: '/agents/intake', launchPath: '/bulk-intake', status: 'active', humanReviewRequired: true },
  { id: 'document', code: 'A2', name: 'Document Agent', shortName: 'Document', purpose: '공적자료와 문서에서 필드 후보값을 추출하고 출처를 보존합니다.', owns: ['Document extraction', 'OCR/text extraction', 'Field candidates'], upstream: ['intake'], downstream: ['verification'], runtimeAgentType: 'document', workspacePath: '/agents/document', launchPath: '/bulk-intake', status: 'active', humanReviewRequired: true },
  { id: 'verification', code: 'A3', name: 'Verification Agent', shortName: 'Verification', purpose: '후보값과 기존값을 비교하고 Human Review를 거쳐 확정 데이터로 승격합니다.', owns: ['Verification queue', 'Candidate approval', 'Data-source provenance'], upstream: ['document'], downstream: ['space','renovation','risk_compliance','report'], workspacePath: '/agents/verification', launchPath: '/bulk-intake', status: 'active', humanReviewRequired: true },
  { id: 'interior_vision', code: 'A4', name: 'Interior Vision Agent', shortName: 'Interior Vision', purpose: '실내 이미지에서 보조 시각 신호와 공간·설비 후보를 생성합니다.', owns: ['Interior pixel analysis', 'Media classification candidates', 'Vision evidence'], upstream: ['intake'], downstream: ['space','renovation'], runtimeAgentType: 'interior_vision', workspacePath: '/agents/interior-vision', launchPath: '/interior', status: 'active', humanReviewRequired: true },
  { id: 'space', code: 'A5', name: 'Space Agent', shortName: 'Space', purpose: 'Interior Space, 사진, 설비, 3D Room 연결을 관리합니다.', owns: ['PropertySpace', 'SpaceMediaLink', 'SpaceRoomLink', 'Room evidence positions'], upstream: ['interior_vision','verification'], downstream: ['renovation','digital_twin','collaboration_viewer'], runtimeAgentType: 'space', workspacePath: '/agents/space', launchPath: '/interior', status: 'active', humanReviewRequired: true },
  { id: 'floor_plan_geometry', code: 'A6', name: 'Floor Plan / Geometry Agent', shortName: 'Floor Plan / Geometry', purpose: 'DXF/DWG·도면 geometry, 축척, 공간경계, 벽·개구부 후보를 처리합니다.', owns: ['Floor plan intake', 'DXF geometry', 'Scale', 'Topology', 'Wall/opening/slab/core review'], upstream: ['intake'], downstream: ['digital_twin'], runtimeAgentType: 'floor_plan', workspacePath: '/agents/floor-plan-geometry', launchPath: '/digital-twin', status: 'active', humanReviewRequired: true },
  { id: 'digital_twin', code: 'A7', name: 'Digital Twin Agent', shortName: 'Digital Twin', purpose: '검토된 geometry를 다층 모델·mutation·production candidate로 통합합니다.', owns: ['Building stack', 'Geometry mutation', 'Production candidate', 'Release gate'], upstream: ['floor_plan_geometry','space'], downstream: ['collaboration_viewer','report'], runtimeAgentType: 'digital_twin', workspacePath: '/agents/digital-twin', launchPath: '/digital-twin', status: 'active', humanReviewRequired: true },
  { id: 'renovation', code: 'A8', name: 'Renovation Agent', shortName: 'Renovation', purpose: 'Property 및 Room 단위 리노베이션 후보와 이력을 관리합니다.', owns: ['Property renovation', 'Room renovation', 'Condition history', 'Renovation history'], upstream: ['space','verification','interior_vision'], downstream: ['risk_compliance','report'], runtimeAgentType: 'renovation', workspacePath: '/agents/renovation', launchPath: '/room-ops', status: 'active', humanReviewRequired: true },
  { id: 'risk_compliance', code: 'A9', name: 'Risk / Compliance Agent', shortName: 'Risk / Compliance', purpose: '누락자료와 사전 리스크 체크를 수행하되 법률·구조·인허가 확정을 하지 않습니다.', owns: ['Risk checklist', 'Missing evidence', 'Compliance precheck'], upstream: ['verification','renovation','digital_twin'], downstream: ['report'], runtimeAgentType: 'risk_compliance', workspacePath: '/agents/risk-compliance', launchPath: '/risk', status: 'active', humanReviewRequired: true },
  { id: 'collaboration_viewer', code: 'A10', name: 'Collaboration / Viewer Agent', shortName: 'Collaboration / Viewer', purpose: 'Release Snapshot, Remote Viewer, Room Viewer와 외부 검토 handoff를 담당합니다.', owns: ['Release snapshot', 'Remote viewer', 'Room viewer', 'External review handoff'], upstream: ['digital_twin','space'], downstream: ['report'], workspacePath: '/agents/collaboration-viewer', launchPath: '/room-ops', status: 'active', humanReviewRequired: true },
  { id: 'report', code: 'A11', name: 'Report Agent', shortName: 'Report', purpose: '검증된 Data Room과 승인된 분석 결과를 MASTER 보고서에 주입합니다. 현재는 최종 편집 단계까지 보류합니다.', owns: ['DAON_1P_MASTER', 'DAON_DETAIL_7P_MASTER', 'Snapshot rendering'], upstream: ['verification','digital_twin','renovation','risk_compliance','collaboration_viewer'], downstream: [], runtimeAgentType: 'report', workspacePath: '/agents/report', status: 'deferred', humanReviewRequired: true },
];

export const PLATFORM_AGENT_BY_ID = new Map(PLATFORM_AGENT_REGISTRY.map((agent) => [agent.id, agent]));

export function getPlatformAgent(id: string) {
  return PLATFORM_AGENT_REGISTRY.find((agent) => agent.id === id);
}
