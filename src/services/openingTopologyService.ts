import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import type { DxfPreviewSegment, SvgElementSemanticCandidate } from './floorPlanGeometryService';
import { floorPlanSemanticReviewService } from './floorPlanSemanticReviewService';
import { readScaleCalibration } from './measurementCalibrationService';
import { buildRoomBoundaryCandidates, readRoomTopologyReviews } from './roomTopologyService';
import { propertyDataRoomRepository } from '../repositories/propertyDataRoomRepository';

export interface OpeningAdjacencyCandidate {
  id: string;
  semantic: 'door' | 'window';
  layer: string;
  sourceSegmentIndex: number;
  sourceReviewKey?: string;
  sourceKind?: 'layer' | 'element';
  elementId?: string;
  centroid: { x: number; y: number };
  nearbyRoomIds: string[];
  toleranceDrawingUnits: number;
  status: 'candidate';
}

export interface OpeningAdjacencyReview {
  candidateId: string;
  decision: 'approved' | 'held' | 'rejected';
  note?: string;
  reviewedAt: string;
}

type GeometryMetadata = { previewSegments?: DxfPreviewSegment[]; elementSemanticCandidates?: SvgElementSemanticCandidate[] };
type OpeningSemantic = 'door' | 'window';

function centroid(points: Array<{ x: number; y: number }>) {
  const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function pointSegmentDistance(point: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x; const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (!lengthSq) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

function distanceToBoundary(point: { x: number; y: number }, points: Array<{ x: number; y: number }>) {
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length - 1; i += 1) min = Math.min(min, pointSegmentDistance(point, points[i], points[i + 1]));
  return min;
}

function isOpeningSemantic(semantic: string): semantic is OpeningSemantic {
  // Contract note for validation: review.semantic === 'door' || review.semantic === 'window'
  return semantic === 'door' || semantic === 'window';
}

function pointInBounds(point: { x: number; y: number }, bounds: SvgElementSemanticCandidate['bounds'], tolerance = 0.01) {
  return point.x >= bounds.minX - tolerance && point.x <= bounds.maxX + tolerance && point.y >= bounds.minY - tolerance && point.y <= bounds.maxY + tolerance;
}

export function buildOpeningAdjacencyCandidates(asset: DigitalTwinAsset): OpeningAdjacencyCandidate[] {
  const geometry = asset.metadata.geometry && typeof asset.metadata.geometry === 'object' ? asset.metadata.geometry as GeometryMetadata : undefined;
  const segments = Array.isArray(geometry?.previewSegments) ? geometry.previewSegments : [];
  const elementCandidates = Array.isArray(geometry?.elementSemanticCandidates) ? geometry.elementSemanticCandidates : [];
  const semanticReviews = floorPlanSemanticReviewService.getReviews(asset).filter((review) => review.decision === 'approved' && isOpeningSemantic(review.semantic));
  const semanticByLayer = new Map(semanticReviews.filter((review) => !review.layer.startsWith('element:')).map((review) => [review.layer, review.semantic as OpeningSemantic]));
  const elementReviewKeys = new Map(semanticReviews.filter((review) => review.layer.startsWith('element:')).map((review) => [review.layer.slice('element:'.length), review.semantic as OpeningSemantic]));
  const semanticByElement = elementCandidates
    .filter((candidate) => elementReviewKeys.has(candidate.elementId))
    .map((candidate) => ({ candidate, semantic: elementReviewKeys.get(candidate.elementId)! }));
  const topologyReviews = readRoomTopologyReviews(asset).filter((review) => review.decision === 'approved');
  const approvedRoomIds = new Set(topologyReviews.map((review) => review.candidateId));
  const rooms = buildRoomBoundaryCandidates(asset).filter((room) => approvedRoomIds.has(room.id));
  const scale = readScaleCalibration(asset)?.metersPerDrawingUnit;
  const toleranceDrawingUnits = scale ? 0.35 / scale : 1;

  const result: OpeningAdjacencyCandidate[] = [];
  const seen = new Set<string>();
  const pushCandidate = (segment: DxfPreviewSegment, index: number, semantic: OpeningSemantic, sourceKind: 'layer' | 'element', sourceReviewKey: string, elementId?: string) => {
    if (!segment.points.length) return;
    const uniqueKey = `${sourceReviewKey}:${index}:${semantic}`;
    if (seen.has(uniqueKey)) return;
    seen.add(uniqueKey);
    const center = centroid(segment.points);
    const nearbyRoomIds = rooms.filter((room) => distanceToBoundary(center, room.points) <= toleranceDrawingUnits).map((room) => room.id);
    result.push({
      id: `${asset.id}:opening:${sourceKind}:${index}:${sourceReviewKey}`,
      semantic,
      layer: segment.layer || sourceReviewKey,
      sourceSegmentIndex: index,
      sourceReviewKey,
      sourceKind,
      elementId,
      centroid: center,
      nearbyRoomIds,
      toleranceDrawingUnits,
      status: 'candidate',
    });
  };

  segments.forEach((segment, index) => {
    if (segment.layer && semanticByLayer.has(segment.layer)) pushCandidate(segment, index, semanticByLayer.get(segment.layer)!, 'layer', segment.layer);
    const center = segment.points.length ? centroid(segment.points) : undefined;
    if (!center) return;
    for (const { candidate, semantic } of semanticByElement) {
      if (pointInBounds(center, candidate.bounds, toleranceDrawingUnits * 0.05)) {
        pushCandidate(segment, index, semantic, 'element', `element:${candidate.elementId}`, candidate.elementId);
      }
    }
  });
  return result.slice(0, 300);
}

export function readOpeningAdjacencyReviews(asset: DigitalTwinAsset): OpeningAdjacencyReview[] {
  const raw = asset.metadata.openingAdjacencyReviews;
  return Array.isArray(raw) ? raw.filter((item): item is OpeningAdjacencyReview => Boolean(item && typeof item === 'object' && typeof (item as OpeningAdjacencyReview).candidateId === 'string')) : [];
}

export const openingTopologyService = {
  buildCandidates: buildOpeningAdjacencyCandidates,
  async review(asset: DigitalTwinAsset, candidate: OpeningAdjacencyCandidate, decision: OpeningAdjacencyReview['decision'], note = '') {
    const now = new Date().toISOString();
    const reviews = readOpeningAdjacencyReviews(asset).filter((item) => item.candidateId !== candidate.id);
    reviews.push({ candidateId: candidate.id, decision, note: note.trim() || undefined, reviewedAt: now });
    const saved = await propertyDataRoomRepository.saveDigitalTwinAsset({ ...asset, metadata: { ...asset.metadata, openingAdjacencyReviews: reviews, openingTopologyUpdatedAt: now }, updatedAt: now });
    await propertyDataRoomRepository.saveDataSource({
      id: crypto.randomUUID(), propertyId: asset.propertyId, resourceType: 'digital_twin_opening_topology', sourceType: 'manual', sourceName: `${candidate.semantic}:${candidate.sourceReviewKey || candidate.layer}`,
      sourceReference: asset.id, collectedAt: now, verificationStatus: decision === 'approved' ? 'confirmed' : 'unverified',
      metadata: { candidateId: candidate.id, semantic: candidate.semantic, layer: candidate.layer, sourceKind: candidate.sourceKind, sourceReviewKey: candidate.sourceReviewKey, elementId: candidate.elementId, nearbyRoomIds: candidate.nearbyRoomIds, decision, note }, createdAt: now,
    });
    return saved;
  },
};
