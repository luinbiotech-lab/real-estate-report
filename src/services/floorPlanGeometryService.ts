import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';

export interface DxfGeometrySummary {
  parser: 'ascii_dxf_v1';
  sourceAssetId: string;
  lineCount: number;
  polylineCount: number;
  textCount: number;
  layers: string[];
  bounds?: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
  labelCandidates: string[];
  unitStatus: 'drawing_units_unverified';
  warnings: string[];
}

type Pair = { code: number; value: string };

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

export async function extractDxfGeometry(asset: DigitalTwinAsset): Promise<DxfGeometrySummary> {
  if (asset.assetType !== 'dxf' && asset.fileFormat.toLowerCase() !== 'dxf') throw new Error('DXF 자산만 로컬 geometry 추출이 가능합니다.');
  if (!(asset.fileData instanceof Blob)) throw new Error('DXF 원본 Blob이 없어 geometry를 추출할 수 없습니다.');
  const text = await asset.fileData.text();
  if (!text.includes('SECTION') || !text.includes('ENTITIES')) throw new Error('ASCII DXF 형식을 확인할 수 없습니다.');
  const pairs = pairsFromDxf(text);
  let lineCount = 0; let polylineCount = 0; let textCount = 0;
  const layers = new Set<string>(); const labels = new Set<string>(); const points: Array<[number, number]> = [];

  for (let i = 0; i < pairs.length; i += 1) {
    if (pairs[i].code !== 0) continue;
    const entity = pairs[i].value.toUpperCase();
    if (!['LINE', 'LWPOLYLINE', 'TEXT', 'MTEXT'].includes(entity)) continue;
    const values: Pair[] = [];
    for (let j = i + 1; j < pairs.length && pairs[j].code !== 0; j += 1) values.push(pairs[j]);
    const layer = values.find((pair) => pair.code === 8)?.value;
    if (layer) layers.add(layer);
    if (entity === 'LINE') {
      lineCount += 1;
      const x1 = numeric(values.find((pair) => pair.code === 10)?.value); const y1 = numeric(values.find((pair) => pair.code === 20)?.value);
      const x2 = numeric(values.find((pair) => pair.code === 11)?.value); const y2 = numeric(values.find((pair) => pair.code === 21)?.value);
      if (x1 != null && y1 != null) points.push([x1, y1]); if (x2 != null && y2 != null) points.push([x2, y2]);
    } else if (entity === 'LWPOLYLINE') {
      polylineCount += 1;
      const xs = values.filter((pair) => pair.code === 10).map((pair) => numeric(pair.value));
      const ys = values.filter((pair) => pair.code === 20).map((pair) => numeric(pair.value));
      const count = Math.min(xs.length, ys.length);
      for (let k = 0; k < count; k += 1) if (xs[k] != null && ys[k] != null) points.push([xs[k]!, ys[k]!]);
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

  return {
    parser: 'ascii_dxf_v1', sourceAssetId: asset.id, lineCount, polylineCount, textCount,
    layers: [...layers].sort(), bounds, labelCandidates: [...labels].slice(0, 50), unitStatus: 'drawing_units_unverified',
    warnings: ['DXF 좌표 단위와 축척은 자동 확정하지 않습니다.', '벽·문·창·구조체 의미는 layer/도면 기준의 추가 매핑과 Human Review가 필요합니다.'],
  };
}

export const floorPlanGeometryService = {
  canExtract(asset: DigitalTwinAsset) { return asset.assetType === 'dxf' || asset.fileFormat.toLowerCase() === 'dxf'; },
  extract: extractDxfGeometry,
};
