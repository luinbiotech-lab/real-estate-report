import { readFileSync } from 'node:fs';

const registry = readFileSync('src/agents/agentRegistry.ts', 'utf8');
const contracts = readFileSync('src/agents/agentContracts.ts', 'utf8');
const status = readFileSync('src/agents/agentStatusService.ts', 'utf8');
const ports = readFileSync('src/agents/agentDataPorts.ts', 'utf8');
const orchestrator = readFileSync('src/services/agentOrchestratorService.ts', 'utf8');
const runtime = readFileSync('src/services/agentRuntimeService.ts', 'utf8');
const execution = readFileSync('src/services/agentExecutionService.ts', 'utf8');
const interiorVision = readFileSync('src/services/interiorVisionExecutionService.ts', 'utf8');
const floorPlan = readFileSync('src/services/floorPlanExecutionService.ts', 'utf8');
const digitalTwin = readFileSync('src/services/digitalTwinExecutionService.ts', 'utf8');
const control = readFileSync('src/pages/AgentControlCenterPage.tsx', 'utf8');
const workspace = readFileSync('src/pages/AgentWorkspacePage.tsx', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');
const layout = readFileSync('src/components/Layout.tsx', 'utf8');

const ids = ['integrator','intake','document','verification','interior_vision','space','floor_plan_geometry','digital_twin','renovation','risk_compliance','collaboration_viewer','report'];
const requiredCodes = Array.from({ length: 12 }, (_, index) => `code: 'A${index}'`);
for (const code of requiredCodes) if (!registry.includes(code)) throw new Error(`Agent registry missing ${code}`);
for (const id of ids) if (!registry.includes(`id: '${id}'`)) throw new Error(`Agent registry missing ${id}`);
if (!registry.includes("status: 'deferred'") || !registry.includes("id: 'report'")) throw new Error('Report Agent deferred boundary missing.');
if (!registry.includes('owns:') || !registry.includes('upstream:') || !registry.includes('downstream:') || !registry.includes('humanReviewRequired')) throw new Error('Agent registry boundary fields incomplete.');
for (const id of ids) if (!contracts.includes(`${id}: C('${id}'`)) throw new Error(`Cross-agent contract missing ${id}`);
for (const field of ['accepts', 'emits', 'directWriteOwns', 'forbiddenDirectWrites', 'promotionRule', 'safetyBoundary']) if (!contracts.includes(field)) throw new Error(`Agent contract field missing ${field}`);
if (!contracts.includes('A0는 다른 Agent의 결과를 확정값으로 승격하지 않습니다.') || !contracts.includes('production candidate ≠ construction-ready ≠ legal BIM.')) throw new Error('Critical isolation/safety rules missing.');
if (!status.includes("AgentHealthState = 'idle' | 'ready' | 'attention' | 'blocked' | 'deferred'") || !status.includes('buildAgentHealthSnapshots') || !status.includes('pendingReviewCount') || !status.includes('failedJobCount') || !status.includes('blockers')) throw new Error('Agent readiness status service incomplete.');

for (const name of ['IntegratorReadPort', 'AgentRuntimePort', 'InteriorVisionAgentPort', 'SpaceAgentPort', 'FloorPlanGeometryAgentPort', 'DigitalTwinAgentPort', 'RenovationAgentPort', 'RiskComplianceAgentPort', 'integratorReadPort', 'agentRuntimePort', 'interiorVisionAgentPort', 'spaceAgentPort', 'floorPlanGeometryAgentPort', 'digitalTwinAgentPort', 'renovationAgentPort', 'riskComplianceAgentPort']) if (!ports.includes(name)) throw new Error(`Narrow agent data port missing ${name}`);

for (const [name, source] of [['orchestrator', orchestrator], ['runtime', runtime], ['execution', execution], ['interiorVision', interiorVision], ['floorPlan', floorPlan], ['digitalTwin', digitalTwin]]) {
  if (source.includes("../repositories/propertyDataRoomRepository")) throw new Error(`${name} must not directly import the shared repository.`);
}
if (!orchestrator.includes("../agents/agentDataPorts") || !runtime.includes("../agents/agentDataPorts") || !execution.includes("../agents/agentDataPorts") || !interiorVision.includes("../agents/agentDataPorts") || !floorPlan.includes("../agents/agentDataPorts") || !digitalTwin.includes("../agents/agentDataPorts")) throw new Error('A4-A7/runtime/orchestrator services must use agent data ports.');
if (!runtime.includes('renovationAgentPort.saveRenovationAssessment') || !runtime.includes('riskComplianceAgentPort.saveRiskAssessment')) throw new Error('Domain writes are not routed through owning agent ports.');
if (!execution.includes('spaceAgentPort.saveSpace') || !execution.includes('spaceAgentPort.saveSpaceMediaLink')) throw new Error('A5 Space writes must use the Space Agent port.');
if (!floorPlan.includes('floorPlanGeometryAgentPort.saveDigitalTwinAsset') || !digitalTwin.includes('digitalTwinAgentPort.saveDigitalTwinAsset')) throw new Error('A6/A7 geometry writes must use owning ports.');
if (!interiorVision.includes('interiorVisionAgentPort.updateMedia')) throw new Error('A4 Interior Vision writes must use the Interior Vision port.');

if (control.includes('../repositories/propertyDataRoomRepository') || control.includes('../repositories/propertyRepository')) throw new Error('A0 Control Center must not directly import repositories.');
if (!control.includes('integratorReadPort.getProperties') || !control.includes('integratorReadPort.getBundle')) throw new Error('A0 Control Center must use the read-only integrator port.');

if (!control.includes('Agent Control Center') || !control.includes('buildAgentHealthSnapshots') || !control.includes('Blocked Agent') || !control.includes('검토 필요 Agent')) throw new Error('A0 readiness Control Center incomplete.');
if (!workspace.includes('ISOLATED AGENT WORKSPACE') || !workspace.includes('Agent Isolation Rule') || !workspace.includes('Contract Input → Output') || !workspace.includes('Direct Write Owns') || !workspace.includes('Forbidden Direct Writes') || !workspace.includes('Promotion Rule') || !workspace.includes('Safety Boundary')) throw new Error('Isolated Agent IO/write-boundary workspace incomplete.');
if (!app.includes('path="control-center"') || !app.includes('path="agents/:agentId"')) throw new Error('Agent routes missing.');
if (!layout.includes('A0 Control Center') || !layout.includes('AGENT MODULAR ARCHITECTURE')) throw new Error('Agent modular navigation missing.');

console.log('DA:ON A0-A11 modular registry + contracts + A4-A7 isolated ports + A0 read isolation + write isolation + readiness status + integrator routing: PASS');
