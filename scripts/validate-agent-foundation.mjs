import { readFileSync } from 'node:fs';

const types = readFileSync('src/domain/propertyDataRoom/types.ts', 'utf8');
const database = readFileSync('src/repositories/database.ts', 'utf8');
const repository = readFileSync('src/repositories/propertyDataRoomRepository.ts', 'utf8');
const orchestrator = readFileSync('src/services/agentOrchestratorService.ts', 'utf8');
const executor = readFileSync('src/services/agentExecutionService.ts', 'utf8');
const spatialIntake = readFileSync('src/services/spatialIntakeService.ts', 'utf8');
const dataRoomService = readFileSync('src/services/propertyDataRoomService.ts', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');
const layout = readFileSync('src/components/Layout.tsx', 'utf8');
const agentPage = readFileSync('src/pages/AgentOpsPage.tsx', 'utf8');
const spatialPage = readFileSync('src/pages/SpatialWorkspacePage.tsx', 'utf8');

const requiredAgentTypes = ['intake', 'document', 'interior_vision', 'floor_plan', 'space', 'renovation', 'risk_compliance', 'report', 'digital_twin'];
for (const agentType of requiredAgentTypes) {
  if (!types.includes(`'${agentType}'`)) throw new Error(`Agent type missing: ${agentType}`);
}

for (const store of ['agentJobs', 'agentResults', 'agentReviews', 'propertySpaces', 'spaceMediaLinks']) {
  if (!database.includes(`'${store}'`)) throw new Error(`IndexedDB Agent/Spatial store missing: ${store}`);
  if (!repository.includes(store)) throw new Error(`Agent/Spatial repository binding missing: ${store}`);
}

if (!database.includes('DATABASE_VERSION = 6')) throw new Error('Spatial Agent Foundation requires IndexedDB version 6.');
if (!orchestrator.includes('queueDocument') || !orchestrator.includes('queueMedia') || !orchestrator.includes('queuePropertyAgent')) {
  throw new Error('Agent routing entry points are incomplete.');
}
if (!orchestrator.includes("floor_plan: 'floor_plan'")) throw new Error('Floor-plan document routing is missing.');
if (!orchestrator.includes("media.category === 'floor_plan' ? 'floor_plan' : 'interior_vision'")) {
  throw new Error('Media routing between Floor Plan and Interior Vision agents is missing.');
}
if (!dataRoomService.includes("queueDocument(saved, 'upload')")) throw new Error('Uploaded documents are not automatically queued to the orchestrator.');
if (!spatialIntake.includes("queueMedia(saved, 'upload')")) throw new Error('Uploaded spatial media is not automatically queued to the orchestrator.');
if (!executor.includes("resultType: 'media_classification_candidate'") || !executor.includes("resultType: 'space_model_candidate'") || !executor.includes("resultType: 'floor_plan_intake_candidate'")) {
  throw new Error('Interior/Floor Plan/Space execution adapters are incomplete.');
}
if (!executor.includes('reviewAndApply') || !agentPage.includes('Human Review Gate') || !agentPage.includes('승인·반영')) {
  throw new Error('Human review and application flow is incomplete.');
}
if (!types.includes('export interface PropertySpace') || !types.includes('export interface SpaceMediaLink')) {
  throw new Error('Spatial data model is missing.');
}
if (!app.includes('path="agents"') || !app.includes('AgentOpsPage')) throw new Error('Agent Operations route is missing.');
if (!app.includes('path="spatial"') || !app.includes('SpatialWorkspacePage')) throw new Error('Spatial Workspace route is missing.');
if (!layout.includes('Agent Operations') || !layout.includes('Spatial Workspace')) throw new Error('Agent/Spatial navigation is missing.');
if (!spatialPage.includes('공간 자료 Intake') || !spatialPage.includes('Digital Twin 준비 자산')) throw new Error('Spatial Workspace core sections are missing.');
if (!types.includes("AgentReviewDecision = 'pending' | 'approved' | 'held' | 'rejected'")) {
  throw new Error('Human review gate must remain part of Agent Foundation.');
}

console.log('DA:ON Agent + Spatial Foundation integrity: PASS');
