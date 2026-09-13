import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';

export type DxfSemanticKind = 'wall' | 'door' | 'window' | 'column' | 'stair' | 'elevator' | 'room_label' | 'unknown';

export interface DxfPreviewSegment {
  kind: 'line' | 'polyline';
  layer?: string;
  semantic: DxfSemanticKind;
  points: Array<{ x: number; y: number }>;
}

export interface DxfSemanticLayerCandidate {
  layer: string;
  semantic: Exclude<DxfSemanticKind, 'room_label'>;
  confidence: number;
  basis: 'layer_name';
  requiresReview: true;
}

export interface DxfGeometrySummary {
  parser: 'ascii_dxf_v1';
  sourceAssetId: string;
  lineCount: number;
  polylineCount: number;
  textCount: number;
  layers: string[];
  bounds?: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
  labelCandidates: string[];
  semanticLayerCandidates: DxfSemanticLayerCandidate[];
  previewSegments: DxfPreviewSegment[];
  unitStatus: 'drawing_units_unverified';
  warnings: string[];
}

type Pair = { code: number; value: string };

const SEMANTIC_LAYER_RULES: Array<{ semantic: Exclude<DxfSemanticKind, 'room_label' | 'unknown'>; pattern: RegExp }> = [
  { semantic: 'wall', pattern: /(?:^|[-_ ])(?:wall|walls|벽|벽체)(?:$|[-_ ])/i },
  { semantic: 'door', pattern: /(?:^|[-_ ])(?:door|doors|문|출입문)(?:$|[-_ ])/i },
  { semantic: 'window', pattern: /(?:^|[-_ ])(?:window|windows|창|창호)(?:$|[-_ ])/i },
  { semantic: 'column', pattern: /(?:^|[-_ ])(?:column|columns|col|기둥)(?:$|[-_ ])/i },
  { semantic: 'stair', pattern: /(?:^|[-_ ])(?:stair|stairs|staircase|계단)(?:$|[-_ ])/i },
  { semantic: 'elevator', pattern: /(?:^|[-_ ])(?:elev|elevator|lift|엘리베이터)(?:$|[-_ ])/i },
];

function pairsFromDxf(text: string): Pair[] {
  const lines = text.replace(/\r/g, '').split('\n');
  const pairs: Pair[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number(lines[i].trim());
    if (!Number.isFinite(code)) continue;
    pairs.push({ code, value: lines[i + 1].trim() });
  }
  return pairs;
}

function numeric(value: string | undefined): number | undefined {
  if (value == null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function roomLike(text: string) {
  return /(실|room|office|lobby|주방|거실|침실|화장실|욕실|복도|창고|기계실|전기실|주차|hall|kitchen|toilet|restroom|storage)/i.test(text);
}

function semanticForLayer(layer = ''): DxfSemanticLayerCandidate['semantic'] {
  return SEMANTIC_LAYER_RULES.find((rule) => rule.pattern.test(` ${layer} `))?.semantic ?? 'unknown';
}

function candidateForLayer(layer: string): DxfSemanticLayerCandidate {
  const semantic = semanticForLayer(layer);
  return { layer, semantic, confidence: semantic === 'unknown' ? 0.2 : 0.78, basis: 'layer_name', requiresReview: true };
}

export async function extractDxfGeometry(asset: DigitalTwinAsset): Promise<DxfGeometrySummary> {
  if (asset.assetType !== 'dxf' && asset.fileFormat.toLowerCase() !== 'dxf') throw new Error('DXF 자산만 로컬 geometry 추출이 가능합니다.');
  if (!(asset.fileData instanceof Blob)) throw new Error('DXF 원본 Blob이 없어 geometry를 추출할 수 없습니다.');
  const text = await asset.fileData.text();
  if (!text.includes('SECTION') || !text.includes('ENTITIES')) throw new Error('ASCII DXF 형식을 확인할 수 없습니다.');
  const pairs = pairsFromDxf(text);
  let lineCount = 0; let polylineCount = 0; let textCount = 0;
  const layers = new Set<string>(); const labels = new Set<string>(); const points: Array<[number, number]> = [];
  const previewSegments: DxfPreviewSegment[] = [];

  for (let i = 0; i < pairs.length; i += 1) {
    if (pairs[i].code !== 0) continue;
    const entity = pairs[i].value.toUpperCase();
    if (!['LINE', 'LWPOLYLINE', 'TEXT', 'MTEXT'].includes(entity)) continue;
    const values: Pair[] = [];
    for (let j = i + 1; j < pairs.length && pairs[j].code !== 0; j += 1) values.push(pairs[j]);
    const layer = values.find((pair) => pair.code === 8)?.value;
    if (layer) layers.add(layer);
    const semantic = semanticForLayer(layer);
    if (entity === 'LINE') {
      lineCount += 1;
      const x1 = numeric(values.find((pair) => pair.code === 10)?.value); const y1 = numeric(values.find((pair) => pair.code === 20)?.value);
      const x2 = numeric(values.find((pair) => pair.code === 11)?.value); const y2 = numeric(values.find((pair) => pair.code === 21)?.value);
      if (x1 != null && y1 != null) points.push([x1, y1]); if (x2 != null && y2 != null) points.push([x2, y2]);
      if (x1 != null && y1 != null && x2 != null && y2 != null && previewSegments.length < 2500) previewSegments.push({ kind: 'line', layer, semantic, points: [{ x: x1, y: y1 }, { x: x2, y: y2 }] });
    } else if (entity === 'LWPOLYLINE') {
      polylineCount += 1;
      const xs = values.filter((pair) => pair.code === 10).map((pair) => numeric(pair.value));
      const ys = values.filter((pair) => pair.code === 20).map((pair) => numeric(pair.value));
      const count = Math.min(xs.length, ys.length); const segmentPoints: Array<{ x: number; y: number }> = [];
      for (let k = 0; k < count; k += 1) if (xs[k] != null && ys[k] != null) { points.push([xs[k]!, ys[k]!]); segmentPoints.push({ x: xs[k]!, y: ys[k]! }); }
      if (segmentPoints.length > 1 && previewSegments.length < 2500) previewSegments.push({ kind: 'polyline', layer, semantic, points: segmentPoints });
    } else {
      textCount += 1;
      const content = values.filter((pair) => pair.code === 1 || pair.code === 3).map((pair) => pair.value).join(' ').trim();
      if (content && roomLike(content)) labels.add(content.slice(0, 120));
      const x = numeric(values.find((pair) => pair.code === 10)?.value); const y = numeric(values.find((pair) => pair.code === 20)?.value);
      if (x != null && y != null) points.push([x, y]);
    }
  }

  let bounds: DxfGeometrySummary['bounds'];
  if (points.length) {
    const xs = points.map(([x]) => x); const ys = points.map(([, y]) => y);
    const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
    bounds = { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }
  const sortedLayers = [...layers].sort();
  return {
    parser: 'ascii_dxf_v1', sourceAssetId: asset.id, lineCount, polylineCount, textCount,
    layers: sortedLayers, bounds, labelCandidates: [...labels].slice(0, 50),
    semanticLayerCandidates: sortedLayers.map(candidateForLayer), previewSegments,
    unitStatus: 'drawing_units_unverified',
    warnings: ['DXF 좌표 단위와 축척은 자동 확정하지 않습니다.', '벽·문·창·기둥·계단·엘리베이터 의미는 layer 이름 기반 후보이며 Human Review 전에는 확정 데이터가 아닙니다.'],
  };
}

export const floorPlanGeometryService = {
  canExtract(asset: DigitalTwinAsset) { return asset.assetType === 'dxf' || asset.fileFormat.toLowerCase() === 'dxf'; },
  extract: extractDxfGeometry,
};
