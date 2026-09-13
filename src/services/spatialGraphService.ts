import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { buildOpeningAdjacencyCandidates, readOpeningAdjacencyReviews } from './openingTopologyService';
import { buildRoomBoundaryCandidates, readRoomTopologyReviews } from './roomTopologyService';

export interface SpatialGraphNode {
  id: string;
  name: string;
  floor?: string;
  layer?: string;
  areaSqmCandidate?: number;
  status: 'reviewed_room_candidate';
}

export interface SpatialGraphEdge {
  id: string;
  semantic: 'door' | 'window';
  roomIds: string[];
  layer: string;
  connectivity: 'between_rooms' | 'room_to_unresolved' | 'unresolved';
  status: 'reviewed_opening_candidate';
}

export interface SpatialConnectivityGraph {
  status: 'ready' | 'partial' | 'empty';
  nodes: SpatialGraphNode[];
  edges: SpatialGraphEdge[];
  warnings: string[];
}

export function buildSpatialConnectivityGraph(asset: DigitalTwinAsset): SpatialConnectivityGraph {
  const roomReviews = readRoomTopologyReviews(asset).filter((review) => review.decision === 'approved');
  const approvedRoomIds = new Set(roomReviews.map((review) => review.candidateId));
  const nodes = buildRoomBoundaryCandidates(asset)
    .filter((candidate) => approvedRoomIds.has(candidate.id))
    .map((candidate): SpatialGraphNode => {
      const review = roomReviews.find((item) => item.candidateId === candidate.id);
      return {
        id: candidate.id,
        name: review?.name || '공간명 미지정',
        floor: candidate.floor,
        layer: candidate.layer,
        areaSqmCandidate: candidate.areaSqmCandidate,
        status: 'reviewed_room_candidate',
      };
    });

  const openingReviews = readOpeningAdjacencyReviews(asset).filter((review) => review.decision === 'approved');
  const approvedOpeningIds = new Set(openingReviews.map((review) => review.candidateId));
  const validRoomIds = new Set(nodes.map((node) => node.id));
  const edges = buildOpeningAdjacencyCandidates(asset)
    .filter((candidate) => approvedOpeningIds.has(candidate.id))
    .map((candidate): SpatialGraphEdge => {
      const roomIds = candidate.nearbyRoomIds.filter((id) => validRoomIds.has(id));
      return {
        id: candidate.id,
        semantic: candidate.semantic,
        roomIds,
        layer: candidate.layer,
        connectivity: roomIds.length >= 2 ? 'between_rooms' : roomIds.length === 1 ? 'room_to_unresolved' : 'unresolved',
        status: 'reviewed_opening_candidate',
      };
    });

  const unresolved = edges.filter((edge) => edge.connectivity !== 'between_rooms').length;
  return {
    status: !nodes.length ? 'empty' : unresolved ? 'partial' : 'ready',
    nodes,
    edges,
    warnings: [
      '그래프 노드는 승인된 공간 경계 후보만 사용합니다.',
      '그래프 엣지는 승인된 door/window 근접관계 후보이며 실제 통행 가능성·개구부 치수·피난·접근성 적합성을 확정하지 않습니다.',
      ...(unresolved ? [`${unresolved}개 개구부 연결은 한쪽 또는 양쪽 공간이 미해결 상태입니다.`] : []),
    ],
  };
}

export const spatialGraphService = { build: buildSpatialConnectivityGraph };
