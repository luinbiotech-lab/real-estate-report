import { readFileSync } from 'node:fs';

const engine = readFileSync('src/services/geometryMutationEngineService.ts', 'utf8');
const tx = readFileSync('src/services/geometryMutationTransactionService.ts', 'utf8');
const state = readFileSync('src/services/geometryProductionStateService.ts', 'utf8');
const audit = readFileSync('src/services/geometryProductionAuditService.ts', 'utf8');
const buildingGate = readFileSync('src/services/buildingProductionGateService.ts', 'utf8');
const panel = readFileSync('src/components/GeometryMutationPanel.tsx', 'utf8');
const buildingGatePanel = readFileSync('src/components/BuildingProductionGatePanel.tsx', 'utf8');
const stack = readFileSync('src/components/BuildingStackPanel.tsx', 'utf8');
const page = readFileSync('src/pages/DigitalTwinWorkspacePage.tsx', 'utf8');

if (!engine.includes("GEOMETRY_MUTATION_ENGINE_ID = 'daon-solid-partition-v1'") || !engine.includes('wallUnionMiterApplied') || !engine.includes('openingSubtractionApplied') || !engine.includes('slabCoreSubtractionApplied')) throw new Error('Actual geometry mutation engine operations are incomplete.');
if (!engine.includes('splitPartition') || !engine.includes('junctionFills') || !engine.includes('subtractionApplied')) throw new Error('Wall/opening/slab mutation topology is incomplete.');
if (!engine.includes('GeometryMutationValidation') || !engine.includes('productionCandidateEligible: validation.valid') || !engine.includes('constructionReady: false')) throw new Error('Mutation result validation/safety boundary is incomplete.');
if (!tx.includes("action: 'mutation_preview_saved' | 'production_candidate_promoted' | 'rollback'") || !tx.includes('previousProductionCandidate') || !tx.includes('rollbackProductionCandidate') || !tx.includes('targetPromotionId')) throw new Error('Mutation transaction/rollback history is incomplete.');
if (!tx.includes("status: 'production_candidate'") || !tx.includes('sourceFingerprint') || !tx.includes('constructionReady: false') || !tx.includes('legalBimReady: false') || !tx.includes('rollbackAvailable: true')) throw new Error('Production candidate promotion safety state is incomplete.');
if (!state.includes("ProductionCandidateState = 'none' | 'current' | 'stale' | 'invalid'") || !state.includes('buildGeometrySourceFingerprint') || !state.includes('candidateFingerprint !== sourceFingerprint')) throw new Error('Production candidate stale-source detection is incomplete.');
if (!audit.includes('GeometryPromotionAuditRow') || !audit.includes('rolledBack') || !audit.includes('sourceChanged') || !audit.includes('delta:')) throw new Error('Production candidate promotion audit/diff is incomplete.');
if (!buildingGate.includes("BUILDING_PRODUCTION_CANDIDATE_VERSION = 'daon-building-production-candidate-v1'") || !buildingGate.includes('productionCandidateReady') || !buildingGate.includes('staleCandidateCount') || !buildingGate.includes('constructionReady: false') || !buildingGate.includes('legalBimReady: false')) throw new Error('Building production release gate is incomplete.');
if (!panel.includes('Mutation 실행·검증 저장') || !panel.includes('Production Candidate 승격') || !panel.includes('Rollback') || !panel.includes('PRODUCTION ·')) throw new Error('Geometry mutation/promotion UI is incomplete.');
if (!panel.includes('최신 소스로 재승격') || !panel.includes('Building Production Gate') || !panel.includes('onSaved?.()')) throw new Error('Stale candidate refresh UX is incomplete.');
if (!panel.includes('Production Audit / 승격 이력') || !panel.includes('ROLLED BACK') || !panel.includes('최근 두 승격 비교')) throw new Error('Production candidate audit UI is incomplete.');
if (!buildingGatePanel.includes('Building Production Gate / 다층 Candidate Release') || !buildingGatePanel.includes('RELEASE READY') || !buildingGatePanel.includes('Production Package JSON')) throw new Error('Building production gate UI is incomplete.');
if (!stack.includes("import GeometryMutationPanel from './GeometryMutationPanel'") || !stack.includes('onSaved={onSaved}')) throw new Error('Building workspace does not expose refreshable production geometry mutation controls.');
if (!page.includes('BuildingProductionGatePanel') || !page.includes('<BuildingStackPanel assets={assets} onSaved={() => load()} />')) throw new Error('Digital Twin workspace does not connect mutation refresh to the building release gate.');

console.log('DA:ON actual geometry mutation + stale detection + audit + rollback + building production release integrity: PASS');
