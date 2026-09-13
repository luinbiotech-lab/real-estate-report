import { readFileSync } from 'node:fs';

const wall = readFileSync('src/services/wallModelService.ts', 'utf8');
const openingCut = readFileSync('src/services/openingCutService.ts', 'utf8');
const floorPlacement = readFileSync('src/services/floorPlacementService.ts', 'utf8');
const buildingStack = readFileSync('src/services/buildingStackService.ts', 'utf8');
const twinPackage = readFileSync('src/services/digitalTwinPackageService.ts', 'utf8');
const twinPage = readFileSync('src/pages/DigitalTwinWorkspacePage.tsx', 'utf8');
const wallPanel = readFileSync('src/components/WallModelPanel.tsx', 'utf8');
const openingCutPanel = readFileSync('src/components/OpeningCutPanel.tsx', 'utf8');
const floorPanel = readFileSync('src/components/FloorPlacementPanel.tsx', 'utf8');
const stackPanel = readFileSync('src/components/BuildingStackPanel.tsx', 'utf8');

if (!wall.includes("review.decision === 'approved' && review.semantic === 'wall'") || !wall.includes('wallThicknessReviews') || !wall.includes('saveWallThicknessReview')) throw new Error('Reviewed wall thickness flow is incomplete.');
if (!openingCut.includes("status: 'reviewed_cut_candidate'") || !openingCut.includes('booleanApplied: false')) throw new Error('Opening cut candidate safety gate is incomplete.');
if (!floorPlacement.includes("status: 'verified'") || !floorPlacement.includes('slabThicknessM') || !floorPlacement.includes("resourceType: 'digital_twin_floor_placement'")) throw new Error('Floor placement/slab provenance is incomplete.');
if (!buildingStack.includes("BUILDING_STACK_VERSION = 'daon-building-stack-v1'") || !buildingStack.includes('productionModelReady: false') || !buildingStack.includes('buildingStackToObj')) throw new Error('Multi-floor building stack export is incomplete.');
if (!buildingStack.includes('NOT FOR CONSTRUCTION / NOT PRODUCTION BIM') || !buildingStack.includes('openingBooleanApplied=false')) throw new Error('Building stack export safety guard is missing.');
if (!twinPackage.includes('wallThicknessReviewed') || !twinPackage.includes('floorPlacementVerified') || !twinPackage.includes('openingCutsPrepared')) throw new Error('Twin handoff readiness is missing wall/floor/opening-cut signals.');
if (!twinPackage.includes('productionMeshReady: false')) throw new Error('Twin handoff must keep productionMeshReady=false.');
if (!wallPanel.includes('Wall Model / 벽 두께 검증') || !wallPanel.includes('자동 추정값만으로 벽 두께를 확정하지 않습니다')) throw new Error('Wall Human Review UI is incomplete.');
if (!openingCutPanel.includes('Opening Cut / 문·창 절삭 후보') || !openingCutPanel.includes('Boolean 미적용')) throw new Error('Opening cut review UI is incomplete.');
if (!floorPanel.includes('Floor Stack / 층 배치·슬래브') || !floorPanel.includes('자동 추정하지 않습니다')) throw new Error('Floor placement/slab Human Review UI is incomplete.');
if (!stackPanel.includes('Multi-floor Building Model / 층간 Stack') || !stackPanel.includes('Building OBJ') || !stackPanel.includes('Building JSON')) throw new Error('Multi-floor building stack viewer/export UI is incomplete.');
for (const component of ['WallModelPanel', 'OpeningCutPanel', 'FloorPlacementPanel', 'BuildingStackPanel']) if (!twinPage.includes(component)) throw new Error(`Digital Twin Workspace missing ${component}.`);

console.log('DA:ON wall + opening cut + slab + multi-floor building integrity: PASS');
