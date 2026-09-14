import { readFileSync } from 'node:fs';

const registry = readFileSync('src/agents/agentRegistry.ts', 'utf8');
const contracts = readFileSync('src/agents/agentContracts.ts', 'utf8');
const status = readFileSync('src/agents/agentStatusService.ts', 'utf8');
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
if (!control.includes('Agent Control Center') || !control.includes('buildAgentHealthSnapshots') || !control.includes('Blocked Agent') || !control.includes('검토 필요 Agent')) throw new Error('A0 readiness Control Center incomplete.');
if (!workspace.includes('ISOLATED AGENT WORKSPACE') || !workspace.includes('Agent Isolation Rule') || !workspace.includes('Contract Input → Output') || !workspace.includes('Direct Write Owns') || !workspace.includes('Forbidden Direct Writes') || !workspace.includes('Promotion Rule') || !workspace.includes('Safety Boundary')) throw new Error('Isolated Agent IO/write-boundary workspace incomplete.');
if (!app.includes('path="control-center"') || !app.includes('path="agents/:agentId"')) throw new Error('Agent routes missing.');
if (!layout.includes('A0 Control Center') || !layout.includes('AGENT MODULAR ARCHITECTURE')) throw new Error('Agent modular navigation missing.');

console.log('DA:ON A0-A11 modular registry + IO contracts + write isolation + readiness status + integrator routing: PASS');
