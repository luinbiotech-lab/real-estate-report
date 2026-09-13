import { readFileSync } from 'node:fs';

const types = readFileSync('src/domain/propertyDataRoom/types.ts', 'utf8');
const database = readFileSync('src/repositories/database.ts', 'utf8');
const repository = readFileSync('src/repositories/propertyDataRoomRepository.ts', 'utf8');
const orchestrator = readFileSync('src/services/agentOrchestratorService.ts', 'utf8');
const dataRoomService = readFileSync('src/services/propertyDataRoomService.ts', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');
const layout = readFileSync('src/components/Layout.tsx', 'utf8');

const requiredAgentTypes = ['intake', 'document', 'interior_vision', 'floor_plan', 'space', 'renovation', 'risk_compliance', 'report', 'digital_twin'];
for (const agentType of requiredAgentTypes) {
  if (!types.includes(`'${agentType}'`)) throw new Error(`Agent type missing: ${agentType}`);
}

for (const store of ['agentJobs', 'agentResults', 'agentReviews']) {
  if (!database.includes(`'${store}'`)) throw new Error(`IndexedDB Agent store missing: ${store}`);
  if (!repository.includes(store)) throw new Error(`Agent repository binding missing: ${store}`);
}

if (!database.includes('DATABASE_VERSION = 5')) throw new Error('Agent Foundation requires IndexedDB version 5.');
if (!orchestrator.includes('queueDocument') || !orchestrator.includes('queueMedia') || !orchestrator.includes('queuePropertyAgent')) {
  throw new Error('Agent routing entry points are incomplete.');
}
if (!orchestrator.includes("floor_plan: 'floor_plan'")) throw new Error('Floor-plan document routing is missing.');
if (!orchestrator.includes("media.category === 'floor_plan' ? 'floor_plan' : 'interior_vision'")) {
  throw new Error('Media routing between Floor Plan and Interior Vision agents is missing.');
}
if (!dataRoomService.includes("queueDocument(saved, 'upload')")) throw new Error('Uploaded documents are not automatically queued to the orchestrator.');
if (!app.includes('path="agents"') || !app.includes('AgentOpsPage')) throw new Error('Agent Operations route is missing.');
if (!layout.includes('Agent Operations')) throw new Error('Agent Operations navigation is missing.');
if (!types.includes("AgentReviewDecision = 'pending' | 'approved' | 'held' | 'rejected'")) {
  throw new Error('Human review gate must remain part of Agent Foundation.');
}

console.log('DA:ON Agent Foundation integrity: PASS');
