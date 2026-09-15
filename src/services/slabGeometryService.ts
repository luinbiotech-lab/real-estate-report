import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { readFloorPlacement } from './floorPlacementService';
import { readScaleCalibration } from './measurementCalibrationService';
import { buildRoomBoundaryCandidates, readRoomTopologyReviews } from './roomTopologyService';

export interface SlabPolygonCandidate {
  roomId: string;
  roomName: string;
  floorLabel: string;
  elevationM: number;
  thicknessM: number;
  polygon: Array<{ x: number; y: number; z: number }>;
  status: 'reviewed_room_footprint_slab_candidate';
}

export interface ReviewedSlabGeometry {
  status: 'ready' | 'blocked';
  polygons: SlabPolygonCandidate[];
  mergedFloorSlab: false;
  productionSlabReady: false;
  warnings: string[];
}

export function buildReviewedSlabGeometry(asset: DigitalTwinAsset): ReviewedSlabGeometry {
  const placement = readFloorPlacement(asset);
  const scale = readScaleCalibration(asset)?.metersPerDrawingUnit;
  if (!placement || !(scale && scale > 0)) {
    return {
      status: 'blocked', polygons: [], mergedFloorSlab: false, productionSlabReady: false,
      warnings: ['검증된 축척과 층 기준고/slab 두께가 있어야 slab polygon 후보를 만들 수 있습니다.'],
    };
  }
  const reviews = new Map(readRoomTopologyReviews(asset).filter((item) => item.decision === 'approved').map((item) => [item.candidateId, item]));
  const polygons = buildRoomBoundaryCandidates(asset).flatMap((room): SlabPolygonCandidate[] => {
    const review = reviews.get(room.id);
    if (!review || !Array.isArray(room.points) || room.points.length < 3) return [];
    const z = placement.elevationM - placement.slabThicknessM;
    return [{
      roomId: room.id,
      roomName: review.name || '공간명 미지정',
      floorLabel: placement.floorLabel,
      elevationM: placement.elevationM,
      thicknessM: placement.slabThicknessM,
      polygon: room.points.map((point) => ({ x: point.x * scale, y: point.y * scale, z })),
      status: 'reviewed_room_footprint_slab_candidate',
    }];
  });
  return {
    status: polygons.length ? 'ready' : 'blocked',
    polygons,
    mergedFloorSlab: false,
    productionSlabReady: false,
    warnings: [
      '현재 slab geometry는 승인된 room boundary를 이용한 room-footprint 후보입니다.',
      '공용부·벽체 하부·코어 개구부를 포함한 전체 floor slab union은 아직 수행하지 않습니다.',
      '구조 슬래브 경계, 단차, 보강, 개구부, 구조 안전성 및 실시설계 정합성을 확정하지 않습니다.',
    ],
  };
}

export const slabGeometryService = { build: buildReviewedSlabGeometry };
