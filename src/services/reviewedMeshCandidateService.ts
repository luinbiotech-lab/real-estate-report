import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { buildDigitalTwinPackage } from './digitalTwinPackageService';

export const REVIEWED_MESH_CANDIDATE_VERSION = 'daon-reviewed-mesh-v1';

type Point2D = { x: number; y: number };
type Point3D = { x: number; y: number; z: number };

export interface ReviewedMeshRoomCandidate {
  roomId: string;
  name: string;
  floor?: string;
  heightM: number;
  vertices: Point3D[];
  faces: number[][];
  status: 'reviewed_prism_candidate';
}

export interface ReviewedMeshCandidate {
  schemaVersion: typeof REVIEWED_MESH_CANDIDATE_VERSION;
  status: 'ready' | 'blocked';
  sourceAssetId: string;
  rooms: ReviewedMeshRoomCandidate[];
  openingCutsApplied: false;
  productionMeshReady: false;
  warnings: string[];
}

function finitePoint(value: unknown): value is Point2D {
  if (!value || typeof value !== 'object') return false;
  const point = value as Partial<Point2D>;
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function removeClosingDuplicate(points: Point2D[]) {
  if (points.length < 2) return points;
  const first = points[0];
  const last = points[points.length - 1];
  return first.x === last.x && first.y === last.y ? points.slice(0, -1) : points;
}

export function buildReviewedMeshCandidate(asset: DigitalTwinAsset): ReviewedMeshCandidate {
  const pkg = buildDigitalTwinPackage(asset);
  const metersPerDrawingUnit = pkg.measurement.scale?.metersPerDrawingUnit;
  const heightM = pkg.measurement.vertical?.ceilingHeightM ?? pkg.measurement.vertical?.floorHeightM;

  if (!(metersPerDrawingUnit && metersPerDrawingUnit > 0) || !(heightM && heightM > 0) || !pkg.rooms.length) {
    return {
      schemaVersion: REVIEWED_MESH_CANDIDATE_VERSION,
      status: 'blocked',
      sourceAssetId: asset.id,
      rooms: [],
      openingCutsApplied: false,
      productionMeshReady: false,
      warnings: [
        '검증된 축척, 승인된 공간 경계, 확인된 층고/천장고가 모두 있어야 mesh 후보를 생성할 수 있습니다.',
        '문·창 절삭과 벽 두께·슬래브·구조체는 아직 적용하지 않습니다.',
      ],
    };
  }

  const rooms = pkg.rooms.flatMap((room): ReviewedMeshRoomCandidate[] => {
    const rawPoints = Array.isArray(room.boundaryDrawingUnits) ? room.boundaryDrawingUnits.filter(finitePoint) : [];
    const points = removeClosingDuplicate(rawPoints);
    if (points.length < 3) return [];

    const bottom = points.map((point) => ({ x: point.x * metersPerDrawingUnit, y: point.y * metersPerDrawingUnit, z: 0 }));
    const top = points.map((point) => ({ x: point.x * metersPerDrawingUnit, y: point.y * metersPerDrawingUnit, z: heightM }));
    const vertices = [...bottom, ...top];
    const count = points.length;
    const faces: number[][] = [];

    // OBJ-style 1-based local face indices. N-gons are intentionally preserved rather than
    // pretending a concave polygon has been safely triangulated.
    faces.push(Array.from({ length: count }, (_, index) => index + 1).reverse());
    faces.push(Array.from({ length: count }, (_, index) => count + index + 1));
    for (let index = 0; index < count; index += 1) {
      const next = (index + 1) % count;
      faces.push([index + 1, next + 1, count + next + 1, count + index + 1]);
    }

    return [{
      roomId: room.id,
      name: room.name,
      floor: room.floor,
      heightM,
      vertices,
      faces,
      status: 'reviewed_prism_candidate',
    }];
  });

  return {
    schemaVersion: REVIEWED_MESH_CANDIDATE_VERSION,
    status: rooms.length ? 'ready' : 'blocked',
    sourceAssetId: asset.id,
    rooms,
    openingCutsApplied: false,
    productionMeshReady: false,
    warnings: [
      '이 mesh는 Human Review를 통과한 공간 경계를 높이 방향으로 단순 extrusion한 검토용 prism 후보입니다.',
      '상·하부 면은 N-gon으로 유지하며 concave polygon을 임의 triangulation하지 않습니다.',
      '문·창 절삭, 벽 두께, 슬래브, 기둥/보, 구조 안전성, 재료, 법정면적 및 실시설계 정합성은 반영하지 않습니다.',
      '실시설계·시공·감정·법적 판단 또는 production BIM/mesh로 직접 사용할 수 없습니다.',
    ],
  };
}

export function reviewedMeshCandidateToObj(mesh: ReviewedMeshCandidate) {
  if (mesh.status !== 'ready') throw new Error('검토용 mesh 후보가 준비되지 않았습니다.');
  const lines: string[] = [
    '# DA:ON reviewed mesh candidate',
    `# schema ${mesh.schemaVersion}`,
    '# NOT FOR CONSTRUCTION / NOT PRODUCTION MESH',
  ];
  let vertexOffset = 0;

  for (const room of mesh.rooms) {
    lines.push('', `o ${room.name.replace(/\s+/g, '_') || room.roomId}`);
    for (const vertex of room.vertices) lines.push(`v ${vertex.x.toFixed(6)} ${vertex.y.toFixed(6)} ${vertex.z.toFixed(6)}`);
    for (const face of room.faces) lines.push(`f ${face.map((index) => index + vertexOffset).join(' ')}`);
    vertexOffset += room.vertices.length;
  }

  lines.push('', '# openingCutsApplied=false', '# productionMeshReady=false');
  return `${lines.join('\n')}\n`;
}

export const reviewedMeshCandidateService = {
  build: buildReviewedMeshCandidate,
  toObj: reviewedMeshCandidateToObj,
};
