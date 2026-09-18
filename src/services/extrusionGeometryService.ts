import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { readScaleCalibration } from './measurementCalibrationService';
import { buildRoomBoundaryCandidates, readRoomTopologyReviews } from './roomTopologyService';
import { readVerticalDimensions } from './verticalDimensionService';

export interface ExtrusionRoomGeometry {
  id: string;
  name: string;
  floor?: string;
  heightM: number;
  bottom: Array<{ x: number; y: number; z: 0 }>;
  top: Array<{ x: number; y: number; z: number }>;
  walls: Array<{ a: number; b: number }>;
  areaSqmCandidate?: number;
  volumeM3Candidate?: number;
  status: 'candidate';
}

export interface ExtrusionGeometryResult {
  status: 'ready' | 'blocked';
  rooms: ExtrusionRoomGeometry[];
  reason?: string;
  warnings: string[];
}

export function buildExtrusionGeometry(asset: DigitalTwinAsset): ExtrusionGeometryResult {
  const calibration = readScaleCalibration(asset);
  if (!calibration) return { status: 'blocked', rooms: [], reason: 'scale_required', warnings: ['검증된 축척이 필요합니다.'] };
  const vertical = readVerticalDimensions(asset);
  const heightM = vertical?.ceilingHeightM ?? vertical?.floorHeightM;
  if (!heightM) return { status: 'blocked', rooms: [], reason: 'height_required', warnings: ['검증된 층고 또는 천장고가 필요합니다.'] };
  const reviews = readRoomTopologyReviews(asset).filter((item) => item.decision === 'approved');
  const approved = new Map(reviews.map((item) => [item.candidateId, item]));
  const candidates = buildRoomBoundaryCandidates(asset).filter((candidate) => approved.has(candidate.id));
  if (!candidates.length) return { status: 'blocked', rooms: [], reason: 'room_topology_required', warnings: ['승인된 공간 경계가 필요합니다.'] };
  const scale = calibration.metersPerDrawingUnit;
  const rooms = candidates.map((candidate): ExtrusionRoomGeometry => {
    const review = approved.get(candidate.id)!;
    const points = candidate.points.map((point) => ({ x: point.x * scale, y: point.y * scale }));
    return {
      id: candidate.id,
      name: review.name || '공간명 미지정',
      floor: candidate.floor,
      heightM,
      bottom: points.map((point) => ({ ...point, z: 0 as const })),
      top: points.map((point) => ({ ...point, z: heightM })),
      walls: points.slice(0, -1).map((_, index) => ({ a: index, b: index + 1 })),
      areaSqmCandidate: candidate.areaSqmCandidate,
      volumeM3Candidate: candidate.areaSqmCandidate != null ? candidate.areaSqmCandidate * heightM : undefined,
      status: 'candidate',
    };
  });
  return {
    status: 'ready', rooms,
    warnings: [
      '3D extrusion은 검증 축척·승인 공간 경계·확인 높이를 사용한 시각화 후보입니다.',
      '벽 두께·슬래브·구조체·개구부·설비·법정 면적을 확정하지 않습니다.',
      '실시설계·공사·감정·법적 판단에 직접 사용할 수 없습니다.',
    ],
  };
}

export const extrusionGeometryService = { build: buildExtrusionGeometry };
