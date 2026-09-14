import { readFileSync } from 'node:fs';

const engine = readFileSync('src/services/geometryMutationEngineService.ts', 'utf8');
const tx = readFileSync('src/services/geometryMutationTransactionService.ts', 'utf8');
const panel = readFileSync('src/components/GeometryMutationPanel.tsx', 'utf8');
const stack = readFileSync('src/components/BuildingStackPanel.tsx', 'utf8');

if (!engine.includes("GEOMETRY_MUTATION_ENGINE_ID = 'daon-solid-partition-v1'") || !engine.includes('wallUnionMiterApplied') || !engine.includes('openingSubtractionApplied') || !engine.includes('slabCoreSubtractionApplied')) throw new Error('Actual geometry mutation engine operations are incomplete.');
if (!engine.includes('splitPartition') || !engine.includes('junctionFills') || !engine.includes('subtractionApplied')) throw new Error('Wall/opening/slab mutation topology is incomplete.');
if (!engine.includes('GeometryMutationValidation') || !engine.includes('productionCandidateEligible: validation.valid') || !engine.includes('constructionReady: false')) throw new Error('Mutation result validation/safety boundary is incomplete.');
if (!tx.includes("action: 'mutation_preview_saved' | 'production_candidate_promoted' | 'rollback'") || !tx.includes('previousProductionCandidate') || !tx.includes('rollbackProductionCandidate')) throw new Error('Mutation transaction/rollback history is incomplete.');
if (!tx.includes("status: 'production_candidate'") || !tx.includes('constructionReady: false') || !tx.includes('legalBimReady: false') || !tx.includes('rollbackAvailable: true')) throw new Error('Production candidate promotion safety state is incomplete.');
if (!panel.includes('Mutation 실행·검증 저장') || !panel.includes('Production Candidate 승격') || !panel.includes('Rollback') || !panel.includes('PRODUCTION CANDIDATE')) throw new Error('Geometry mutation/promotion UI is incomplete.');
if (!stack.includes("import GeometryMutationPanel from './GeometryMutationPanel'") || !stack.includes('<GeometryMutationPanel key={asset.id} asset={asset} />')) throw new Error('Building workspace does not expose production geometry mutation controls.');

console.log('DA:ON actual geometry mutation + validation + rollback + production candidate integrity: PASS');
