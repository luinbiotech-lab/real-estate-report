import { readFileSync } from 'node:fs';

const registry = readFileSync('src/agents/agentRegistry.ts', 'utf8');
const control = readFileSync('src/pages/AgentControlCenterPage.tsx', 'utf8');
const workspace = readFileSync('src/pages/AgentWorkspacePage.tsx', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');
const layout = readFileSync('src/components/Layout.tsx', 'utf8');

const requiredCodes = Array.from({ length: 12 }, (_, index) => `code: 'A${index}'`);
for (const code of requiredCodes) if (!registry.includes(code)) throw new Error(`Agent registry missing ${code}`);
for (const id of ['integrator','intake','document','verification','interior_vision','space','floor_plan_geometry','digital_twin','renovation','risk_compliance','collaboration_viewer','report']) if (!registry.includes(`id: '${id}'`)) throw new Error(`Agent registry missing ${id}`);
if (!registry.includes("status: 'deferred'") || !registry.includes("id: 'report'")) throw new Error('Report Agent deferred boundary missing.');
if (!registry.includes('owns:') || !registry.includes('upstream:') || !registry.includes('downstream:') || !registry.includes('humanReviewRequired')) throw new Error('Agent contract fields incomplete.');
if (!control.includes('Agent Control Center') || !control.includes('PLATFORM_AGENT_REGISTRY') || !control.includes('Human Review')) throw new Error('A0 Integrator Control Center incomplete.');
if (!workspace.includes('ISOLATED AGENT WORKSPACE') || !workspace.includes('Agent Contract') || !workspace.includes('Owned Modules') || !workspace.includes('Upstream') || !workspace.includes('Downstream')) throw new Error('Isolated Agent Workspace incomplete.');
if (!app.includes('path="control-center"') || !app.includes('path="agents/:agentId"')) throw new Error('Agent routes missing.');
if (!layout.includes('A0 Control Center') || !layout.includes('AGENT MODULAR ARCHITECTURE')) throw new Error('Agent modular navigation missing.');

console.log('DA:ON A0-A11 modular agent registry + isolated workspaces + integrator routing: PASS');
