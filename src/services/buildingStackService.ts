import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { readFloorPlacement } from './floorPlacementService';
import { buildReviewedMeshCandidate } from './reviewedMeshCandidateService';
import { wallModelService } from './wallModelService';
import { openingCutService } from './openingCutService';

export const BUILDING_STACK_VERSION = 'daon-building-stack-v1';

export interface BuildingStackRoomCandidate {
  roomId: string;
  name: string;
  vertices: Array<{ x: number; y: number; z: number }>;
  faces: number[][];
}

export interface BuildingStackFloorCandidate {
  assetId: string;
  floorLabel: string;
  elevationM: number;
  slabThicknessM: number;
  roomCount: number;
  wallSegmentCount: number;
  openingCutCount: number;
  rooms: BuildingStackRoomCandidate[];
  status: 'reviewed_floor_candidate';
}

export interface BuildingStackCandidate {
  schemaVersion: typeof BUILDING_STACK_VERSION;
  status: 'ready' | 'partial' | 'blocked';
  propertyId?: string;
  floors: BuildingStackFloorCandidate[];
  totalHeightM?: number;
  productionModelReady: false;
  warnings: string[];
}

export function buildBuildingStackCandidate(assets: DigitalTwinAsset[]): BuildingStackCandidate {
  if (!assets.length) return { schemaVersion: BUILDING_STACK_VERSION, status: 'blocked', floors: [], productionModelReady: false, warnings: ['Digital Twin 자산이 없습니다.'] };
  const floors: BuildingStackFloorCandidate[] = [];
  const unplaced: string[] = [];

  for (const asset of assets) {
    const placement = readFloorPlacement(asset);
    const mesh = buildReviewedMeshCandidate(asset);
    if (!placement || mesh.status !== 'ready') {
      unplaced.push(asset.fileName || asset.id);
      continue;
    }
    const rooms = mesh.rooms.map((room) => ({
      roomId: room.roomId,
      name: room.name,
      vertices: room.vertices.map((vertex) => ({ ...vertex, z: vertex.z + placement.elevationM })),
      faces: room.faces,
    }));
    floors.push({
      assetId: asset.id,
      floorLabel: placement.floorLabel,
      elevationM: placement.elevationM,
      slabThicknessM: placement.slabThicknessM,
      roomCount: rooms.length,
      wallSegmentCount: wallModelService.build(asset).length,
      openingCutCount: openingCutService.build(asset).length,
      rooms,
      status: 'reviewed_floor_candidate',
    });
  }

  floors.sort((a, b) => a.elevationM - b.elevationM);
  const top = floors.flatMap((floor) => floor.rooms.flatMap((room) => room.vertices.map((vertex) => vertex.z)));
  const bottom = floors.map((floor) => floor.elevationM - floor.slabThicknessM);
  const totalHeightM = top.length ? Math.max(...top) - Math.min(...bottom) : undefined;

  return {
    schemaVersion: BUILDING_STACK_VERSION,
    status: floors.length === assets.length ? 'ready' : floors.length ? 'partial' : 'blocked',
    propertyId: assets[0]?.propertyId,
    floors,
    totalHeightM,
    productionModelReady: false,
    warnings: [
      ...(unplaced.length ? [`층 배치 또는 검토용 mesh가 미완료된 자산: ${unplaced.join(', ')}`] : []),
      '층별 elevation과 slab 두께는 Human Review 값만 사용합니다.',
      'slab 두께는 층 배치 metadata로 보존되며 현재 room prism mesh에 구조 슬래브 boolean을 적용하지 않습니다.',
      '층간 코어·계단·엘리베이터 연속성, 구조체 정합성, 외벽 접합, 실제 opening boolean은 아직 검증하지 않습니다.',
      '본 다층 모델은 원격 검토용 후보이며 실시설계·구조검토·시공용 BIM이 아닙니다.',
    ],
  };
}

export function buildingStackToObj(stack: BuildingStackCandidate) {
  if (!stack.floors.length) throw new Error('내보낼 다층 Building Model 후보가 없습니다.');
  const lines = ['# DA:ON multi-floor building stack candidate', `# schema ${stack.schemaVersion}`, '# NOT FOR CONSTRUCTION / NOT PRODUCTION BIM'];
  let offset = 0;
  for (const floor of stack.floors) {
    lines.push('', `g FLOOR_${floor.floorLabel.replace(/\s+/g, '_')}`, `# elevationM=${floor.elevationM}`, `# slabThicknessM=${floor.slabThicknessM}`);
    for (const room of floor.rooms) {
      lines.push(`o ${floor.floorLabel}_${room.name}`.replace(/\s+/g, '_'));
      for (const vertex of room.vertices) lines.push(`v ${vertex.x.toFixed(6)} ${vertex.y.toFixed(6)} ${vertex.z.toFixed(6)}`);
      for (const face of room.faces) lines.push(`f ${face.map((index) => index + offset).join(' ')}`);
      offset += room.vertices.length;
    }
  }
  lines.push('', '# slabsMetadataIncluded=true', '# openingBooleanApplied=false', '# productionModelReady=false');
  return `${lines.join('\n')}\n`;
}

export const buildingStackService = { build: buildBuildingStackCandidate, toObj: buildingStackToObj };
