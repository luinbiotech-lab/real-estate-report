import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { readFloorPlacement } from './floorPlacementService';
import { buildReviewedMeshCandidate } from './reviewedMeshCandidateService';
import { wallModelService } from './wallModelService';
import { openingCutService } from './openingCutService';

export interface BuildingStackFloorCandidate {
  assetId: string;
  floorLabel: string;
  elevationM: number;
  slabThicknessM: number;
  roomCount: number;
  wallSegmentCount: number;
  openingCutCount: number;
  vertices: Array<{ x: number; y: number; z: number }>;
  status: 'reviewed_floor_candidate';
}

export interface BuildingStackCandidate {
  status: 'ready' | 'partial' | 'blocked';
  propertyId?: string;
  floors: BuildingStackFloorCandidate[];
  totalHeightM?: number;
  productionModelReady: false;
  warnings: string[];
}

export function buildBuildingStackCandidate(assets: DigitalTwinAsset[]): BuildingStackCandidate {
  if (!assets.length) return { status: 'blocked', floors: [], productionModelReady: false, warnings: ['Digital Twin 자산이 없습니다.'] };
  const floors: BuildingStackFloorCandidate[] = [];
  const unplaced: string[] = [];

  for (const asset of assets) {
    const placement = readFloorPlacement(asset);
    const mesh = buildReviewedMeshCandidate(asset);
    if (!placement || mesh.status !== 'ready') {
      unplaced.push(asset.fileName || asset.id);
      continue;
    }
    const vertices = mesh.rooms.flatMap((room) => room.vertices.map((vertex) => ({ ...vertex, z: vertex.z + placement.elevationM })));
    floors.push({
      assetId: asset.id,
      floorLabel: placement.floorLabel,
      elevationM: placement.elevationM,
      slabThicknessM: placement.slabThicknessM,
      roomCount: mesh.rooms.length,
      wallSegmentCount: wallModelService.build(asset).length,
      openingCutCount: openingCutService.build(asset).length,
      vertices,
      status: 'reviewed_floor_candidate',
    });
  }

  floors.sort((a, b) => a.elevationM - b.elevationM);
  const top = floors.flatMap((floor) => floor.vertices.map((vertex) => vertex.z));
  const bottom = floors.map((floor) => floor.elevationM - floor.slabThicknessM);
  const totalHeightM = top.length ? Math.max(...top) - Math.min(...bottom) : undefined;

  return {
    status: floors.length === assets.length ? 'ready' : floors.length ? 'partial' : 'blocked',
    propertyId: assets[0]?.propertyId,
    floors,
    totalHeightM,
    productionModelReady: false,
    warnings: [
      ...(unplaced.length ? [`층 배치 또는 검토용 mesh가 미완료된 자산: ${unplaced.join(', ')}`] : []),
      '층별 elevation과 slab 두께는 Human Review 값만 사용합니다.',
      '층간 코어·계단·엘리베이터 연속성, 구조체 정합성, 외벽 접합, 실제 boolean 절삭은 아직 검증하지 않습니다.',
      '본 다층 모델은 원격 검토용 후보이며 실시설계·구조검토·시공용 BIM이 아닙니다.',
    ],
  };
}

export const buildingStackService = { build: buildBuildingStackCandidate };
