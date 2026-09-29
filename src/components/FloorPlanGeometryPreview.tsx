import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';

type PreviewPoint = { x: number; y: number };
type PreviewSegment = { kind?: string; layer?: string; semantic?: string; points?: PreviewPoint[] };
type GeometryMetadata = {
  bounds?: { minX?: number; minY?: number; maxX?: number; maxY?: number; width?: number; height?: number };
  previewSegments?: PreviewSegment[];
  semanticLayerCandidates?: Array<{ layer?: string; semantic?: string; confidence?: number; requiresReview?: boolean }>;
  unitStatus?: string;
};

const SEMANTIC_STROKE_WIDTH: Record<string, number> = {
  wall: 2.3,
  door: 1.5,
  window: 1.2,
  column: 2,
  stair: 1.2,
  elevator: 1.4,
  unknown: 0.8,
};

function geometryFrom(asset: DigitalTwinAsset): GeometryMetadata | undefined {
  const raw = asset.metadata.geometry;
  return raw && typeof raw === 'object' ? raw as GeometryMetadata : undefined;
}

function normalizedPoints(points: PreviewPoint[], bounds: NonNullable<GeometryMetadata['bounds']>) {
  const minX = Number(bounds.minX ?? 0); const maxY = Number(bounds.maxY ?? 0);
  const width = Math.max(1e-6, Number(bounds.width ?? 1)); const height = Math.max(1e-6, Number(bounds.height ?? 1));
  return points.map((point) => ({ x: ((point.x - minX) / width) * 1000, y: ((maxY - point.y) / height) * 700 }));
}

export default function FloorPlanGeometryPreview({ asset }: { asset: DigitalTwinAsset }) {
  const geometry = geometryFrom(asset);
  const bounds = geometry?.bounds;
  const segments = Array.isArray(geometry?.previewSegments) ? geometry!.previewSegments!.filter((segment) => Array.isArray(segment.points) && segment.points.length > 1) : [];
  const semanticLayers = Array.isArray(geometry?.semanticLayerCandidates) ? geometry!.semanticLayerCandidates! : [];

  if (!geometry || !bounds || !segments.length) return <div style={{ minHeight: 220, display: 'grid', placeItems: 'center', background: '#f7f9fb', border: '1px dashed #cbd5df', borderRadius: 10, color: '#7b8794' }}>승인된 DXF geometry preview가 없습니다.</div>;

  return <div style={{ display: 'grid', gap: 12 }}>
    <div style={{ background: '#fff', border: '1px solid #d9e0e8', borderRadius: 10, overflow: 'hidden' }}>
      <svg viewBox="0 0 1000 700" role="img" aria-label={`${asset.fileName || 'DXF'} geometry preview`} style={{ width: '100%', minHeight: 280, maxHeight: 520, background: '#fbfcfd' }}>
        {segments.map((segment, index) => {
          const points = normalizedPoints(segment.points ?? [], bounds).map((point) => `${point.x},${point.y}`).join(' ');
          const semantic = segment.semantic || 'unknown';
          return <polyline key={`${index}-${segment.layer || ''}`} points={points} fill="none" stroke="currentColor" strokeWidth={SEMANTIC_STROKE_WIDTH[semantic] ?? 0.8} opacity={semantic === 'unknown' ? 0.35 : 0.8} vectorEffect="non-scaling-stroke" />;
        })}
      </svg>
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {semanticLayers.filter((item) => item.semantic && item.semantic !== 'unknown').slice(0, 20).map((item) => <span key={`${item.layer}-${item.semantic}`} style={{ border: '1px solid #d9e0e8', borderRadius: 999, padding: '4px 9px', fontSize: 12, color: '#475467' }}>{item.layer}: {item.semantic} 후보</span>)}
      <span style={{ border: '1px solid #ead8b7', background: '#fffdf8', borderRadius: 999, padding: '4px 9px', fontSize: 12, color: '#8a5b13' }}>{geometry.unitStatus === 'drawing_units_unverified' ? '축척/단위 미검증' : '단위 상태 미확인'}</span>
    </div>
    <small style={{ color: '#667085' }}>이 도면은 DXF 좌표를 비례 표시한 검토용 2D preview입니다. 실제 거리·면적·구조체 의미는 축척 및 layer 매핑 승인 전까지 확정하지 않습니다.</small>
  </div>;
}
