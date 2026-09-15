import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import type { DxfPreviewSegment } from './floorPlanGeometryService';
import { readScaleCalibration } from './measurementCalibrationService';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';

export interface RoomBoundaryCandidate {
  id: string;
  sourceSegmentIndex: number;
  floor?: string;
  layer?: string;
  points: Array<{ x: number; y: number }>;
  drawingArea: number;
  areaSqmCandidate?: number;
  perimeterMCandidate?: number;
  status: 'candidate';
  warnings: string[];
}

export interface RoomTopologyReview {
  candidateId: string;
  decision: 'approved' | 'held' | 'rejected';
  name?: string;
  note?: string;
  reviewedAt: string;
}

type GeometryMetadata = {
  previewSegments?: DxfPreviewSegment[];
};

function almostEqual(a: number, b: number, epsilon = 1e-6) {
  return Math.abs(a - b) <= epsilon;
}

function isClosed(points: Array<{ x: number; y: number }>) {
  if (points.length < 4) return false;
  const first = points[0]; const last = points[points.length - 1];
  return almostEqual(first.x, last.x) && almostEqual(first.y, last.y);
}

function polygonArea(points: Array<{ x: number; y: number }>) {
  let sum = 0;
  for (let i = 0; i < points.length - 1; i += 1) sum += points[i].x * points[i + 1].y - points[i + 1].x * points[i].y;
  return Math.abs(sum) / 2;
}

function perimeter(points: Array<{ x: number; y: number }>) {
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) total += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  return total;
}

export function buildRoomBoundaryCandidates(asset: DigitalTwinAsset): RoomBoundaryCandidate[] {
  const geometry = asset.metadata.geometry && typeof asset.metadata.geometry === 'object' ? asset.metadata.geometry as GeometryMetadata : undefined;
  const segments = Array.isArray(geometry?.previewSegments) ? geometry.previewSegments : [];
  const calibration = readScaleCalibration(asset);
  const scale = calibration?.metersPerDrawingUnit;
  const result: RoomBoundaryCandidate[] = [];
  segments.forEach((segment, index) => {
    if (segment.kind !== 'polyline' || !isClosed(segment.points)) return;
    const drawingArea = polygonArea(segment.points);
    if (!(drawingArea > 0)) return;
    const drawingPerimeter = perimeter(segment.points);
    result.push({
      id: `${asset.id}:polyline:${index}`,
      sourceSegmentIndex: index,
      floor: asset.floor,
      layer: segment.layer,
      points: segment.points,
      drawingArea,
      areaSqmCandidate: scale ? drawingArea * scale * scale : undefined,
      perimeterMCandidate: scale ? drawingPerimeter * scale : undefined,
      status: 'candidate',
      warnings: [
        '폐합 폴리라인을 공간 경계 후보로만 해석합니다.',
        scale ? '면적은 사람이 검증한 축척을 적용한 후보값이며 공간 경계 승인 전에는 확정 면적이 아닙니다.' : '축척 미검증 상태이므로 실제 면적을 산출하지 않습니다.',
        '벽 중심선·마감선·기둥·샤프트·가구 폴리라인일 수 있으므로 Human Review가 필요합니다.',
      ],
    });
  });
  return result.slice(0, 200);
}

export function readRoomTopologyReviews(asset: DigitalTwinAsset): RoomTopologyReview[] {
  const raw = asset.metadata.roomTopologyReviews;
  return Array.isArray(raw) ? raw.filter((item): item is RoomTopologyReview => Boolean(item && typeof item === 'object' && typeof (item as RoomTopologyReview).candidateId === 'string')) : [];
}

export const roomTopologyService = {
  buildCandidates: buildRoomBoundaryCandidates,
  async review(asset: DigitalTwinAsset, candidate: RoomBoundaryCandidate, decision: RoomTopologyReview['decision'], name = '', note = '') {
    const now = new Date().toISOString();
    const current = readRoomTopologyReviews(asset).filter((item) => item.candidateId !== candidate.id);
    const review: RoomTopologyReview = { candidateId: candidate.id, decision, name: name.trim() || undefined, note: note.trim() || undefined, reviewedAt: now };
    const reviews = [...current, review];
    const approved = reviews.filter((item) => item.decision === 'approved');
    const saved = await propertyDataRoomRepository.saveDigitalTwinAsset({
      ...asset,
      metadata: { ...asset.metadata, roomTopologyReviews: reviews, roomTopologyStatus: approved.length ? 'reviewed_candidates' : 'review_required' },
      updatedAt: now,
    });
    await propertyDataRoomRepository.saveDataSource({
      id: crypto.randomUUID(), propertyId: asset.propertyId, resourceType: 'digital_twin_topology', sourceType: 'manual', sourceName: name.trim() || candidate.layer || 'room boundary candidate',
      sourceReference: asset.id, collectedAt: now, verificationStatus: decision === 'approved' ? 'confirmed' : 'unverified',
      metadata: { candidateId: candidate.id, decision, drawingArea: candidate.drawingArea, areaSqmCandidate: candidate.areaSqmCandidate, note: review.note }, createdAt: now,
    });
    return saved;
  },
};
