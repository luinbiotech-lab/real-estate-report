import type { PlatformAgentId } from './agentRegistry';

export interface AgentContractDefinition {
  agentId: PlatformAgentId;
  accepts: string[];
  emits: string[];
  directWriteOwns: string[];
  forbiddenDirectWrites: string[];
  promotionRule: string;
  safetyBoundary: string;
}

const C = (agentId: PlatformAgentId, accepts: string[], emits: string[], directWriteOwns: string[], forbiddenDirectWrites: string[], promotionRule: string, safetyBoundary: string): AgentContractDefinition => ({ agentId, accepts, emits, directWriteOwns, forbiddenDirectWrites, promotionRule, safetyBoundary });

export const AGENT_CONTRACTS: Record<PlatformAgentId, AgentContractDefinition> = {
  integrator: C('integrator', ['Agent status snapshots', 'Review bottlenecks', 'Property-level readiness'], ['Navigation intents', 'Cross-agent status only'], ['Integrator state'], ['Domain facts', 'Verification values', 'Geometry', 'Report content'], 'A0는 다른 Agent의 결과를 확정값으로 승격하지 않습니다.', '관제·라우팅 전용. 도메인 데이터 직접 수정 금지.'),
  intake: C('intake', ['User uploads', 'Original documents', 'Original media', 'CAD/plan files'], ['Classified resources', 'Provenance records', 'Intake jobs'], ['Raw intake metadata'], ['Confirmed Property fields', 'Risk decisions', 'Report snapshots'], '원본은 분류·등록만 하며 의미 해석은 후속 Agent로 전달합니다.', '원본 보존. 업로드 자체가 사실 검증을 의미하지 않음.'),
  document: C('document', ['Classified documents', 'OCR/text layers'], ['Field candidates', 'Extraction evidence'], ['Document extraction candidates'], ['Confirmed Property fields', 'Human verification records'], '추출 결과는 항상 candidate로만 전달합니다.', 'OCR/추출값은 공적 사실 확정값이 아님.'),
  verification: C('verification', ['Field candidates', 'Existing confirmed values', 'Source provenance'], ['Approved verification records', 'Confirmed Property updates'], ['Verification queue', 'Verification records'], ['Geometry', 'Room evidence positions', 'Report layout'], 'Human Review 승인 후에만 Property 확정값으로 승격합니다.', '후보값과 확정값을 분리하고 출처를 보존.'),
  interior_vision: C('interior_vision', ['Interior images', 'Image metadata'], ['Vision evidence', 'Media classification candidates', 'Facility/space hints'], ['Vision candidates'], ['Confirmed facilities', 'Room topology', 'Renovation approval'], '시각 분석 결과는 candidate/evidence로만 전달합니다.', '브라우저 픽셀 신호 기반이며 하자·구조·설비 성능을 자동 확정하지 않음.'),
  space: C('space', ['Approved vision evidence', 'Verified property context', 'Reviewed room topology'], ['PropertySpace', 'SpaceMediaLink', 'SpaceRoomLink', 'Room evidence candidates'], ['Space model', 'Space-room links', 'Room evidence positions'], ['Geometry mutation', 'Risk approval', 'Report snapshot'], 'Room/space 연결 및 위치는 Human Review 후 승인 상태로 저장합니다.', 'Room-local 좌표는 측량/BIM 법정좌표가 아님.'),
  floor_plan_geometry: C('floor_plan_geometry', ['CAD/plan originals', 'Human scale calibration', 'Semantic layer reviews'], ['Reviewed topology', 'Walls/openings/slabs/cores', 'Geometry readiness'], ['Reviewed geometry candidates'], ['Production release', 'Legal BIM status'], '도면 geometry는 단계별 Human Review를 통과해야 Digital Twin 입력으로 사용됩니다.', '구조·내력·인허가 의미를 자동 추론하지 않음.'),
  digital_twin: C('digital_twin', ['Reviewed geometry', 'Approved space links', 'Verified scale/height'], ['Building stack', 'Mutation result', 'Production candidate', 'Release readiness'], ['Digital Twin assets', 'Production candidates'], ['Legal BIM approval', 'Construction approval', 'Verified property facts'], 'Validation을 통과한 geometry만 production candidate로 승격합니다.', 'production candidate ≠ construction-ready ≠ legal BIM.'),
  renovation: C('renovation', ['Verified property context', 'Approved rooms', 'Facilities', 'Condition evidence'], ['Property renovation candidate', 'Room renovation candidate', 'Decision history'], ['Renovation assessments', 'Renovation history'], ['Permit approval', 'Structural approval', 'Exact cost confirmation'], '자동 초안은 Human Review 전까지 draft/candidate 상태를 유지합니다.', '구조·전기·소방·인허가·정확 공사비는 전문가 검토 필요.'),
  risk_compliance: C('risk_compliance', ['Verified records', 'Renovation assessments', 'Digital Twin readiness'], ['Risk checklist', 'Missing evidence', 'Compliance precheck'], ['Risk assessments'], ['Legal conclusion', 'Permit approval', 'Structural/fire compliance approval'], '사전 체크 결과는 검토용 assessment로만 저장합니다.', '법률·건축·구조·소방·인허가 적합성 확정 판단 금지.'),
  collaboration_viewer: C('collaboration_viewer', ['Approved room evidence', 'Production candidates', 'Immutable release snapshots'], ['Remote viewers', 'Share manifests', 'External handoff packages'], ['Viewer/share metadata'], ['Source evidence', 'Verified facts', 'Production geometry source'], '외부 전달물은 승인된 snapshot/근거를 읽기 전용으로 패키징합니다.', 'Viewer/handoff는 원본 또는 승인 상태를 변경하지 않음.'),
  report: C('report', ['Verified Data Room', 'Approved analyses', 'Release snapshots'], ['DAON_1P_MASTER output', 'DAON_DETAIL_7P_MASTER output', 'Report snapshots'], ['Report snapshots'], ['Source verification records', 'Geometry source', 'Original evidence'], '검증 완료 데이터만 MASTER에 주입하며 현재 최종 편집 단계까지 deferred입니다.', '보고서는 원천 데이터의 진실성/승인 상태를 임의 변경하지 않음.'),
};

export function getAgentContract(agentId: PlatformAgentId) {
  return AGENT_CONTRACTS[agentId];
}
