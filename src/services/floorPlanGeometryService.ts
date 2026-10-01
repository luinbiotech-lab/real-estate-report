import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';

export type DxfSemanticKind = 'wall' | 'door' | 'window' | 'column' | 'stair' | 'elevator' | 'room_label' | 'unknown';
export interface DxfPreviewSegment { kind: 'line' | 'polyline'; layer?: string; semantic: DxfSemanticKind; points: Array<{ x: number; y: number }>; }
export interface DxfSemanticLayerCandidate { layer: string; semantic: Exclude<DxfSemanticKind, 'room_label'>; confidence: number; basis: 'layer_name'; requiresReview: true; }
export interface DxfGeometrySummary {
  parser: 'ascii_dxf_v1' | 'svg_floorplan_v1'; sourceAssetId: string; lineCount: number; polylineCount: number; textCount: number;
  layers: string[]; bounds?: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
  labelCandidates: string[]; semanticLayerCandidates: DxfSemanticLayerCandidate[]; previewSegments: DxfPreviewSegment[];
  unitStatus: 'drawing_units_unverified'; warnings: string[];
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
const roomLike = (text: string) => /(실|room|office|lobby|주방|거실|침실|화장실|욕실|복도|창고|기계실|전기실|주차|hall|kitchen|toilet|restroom|storage|bed|bath|dining|living)/i.test(text);
const semanticForLayer = (layer = ''): DxfSemanticLayerCandidate['semantic'] => SEMANTIC_LAYER_RULES.find((rule) => rule.pattern.test(` ${layer} `))?.semantic ?? 'unknown';
const candidateForLayer = (layer: string): DxfSemanticLayerCandidate => { const semantic = semanticForLayer(layer); return { layer, semantic, confidence: semantic === 'unknown' ? 0.2 : 0.78, basis: 'layer_name', requiresReview: true }; };
const numeric = (value: string | undefined) => { if (value == null || value === '') return undefined; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : undefined; };
function boundsFromPoints(points: Array<[number, number]>) {
  if (!points.length) return undefined;
  const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}
function pairsFromDxf(text: string): Pair[] { const lines = text.replace(/\r/g, '').split('\n'); const pairs: Pair[] = []; for (let i = 0; i + 1 < lines.length; i += 2) { const code = Number(lines[i].trim()); if (Number.isFinite(code)) pairs.push({ code, value: lines[i + 1].trim() }); } return pairs; }

export async function extractDxfGeometry(asset: DigitalTwinAsset): Promise<DxfGeometrySummary> {
  if (asset.fileFormat.toLowerCase() !== 'dxf') throw new Error('DXF 자산만 DXF geometry 추출이 가능합니다.');
  if (!(asset.fileData instanceof Blob)) throw new Error('DXF 원본 Blob이 없어 geometry를 추출할 수 없습니다.');
  const text = await asset.fileData.text();
  if (!text.includes('SECTION') || !text.includes('ENTITIES')) throw new Error('ASCII DXF 형식을 확인할 수 없습니다.');
  const pairs = pairsFromDxf(text); let lineCount = 0, polylineCount = 0, textCount = 0;
  const layers = new Set<string>(), labels = new Set<string>(), points: Array<[number, number]> = [], previewSegments: DxfPreviewSegment[] = [];
  for (let i = 0; i < pairs.length; i += 1) {
    if (pairs[i].code !== 0) continue; const entity = pairs[i].value.toUpperCase(); if (!['LINE','LWPOLYLINE','TEXT','MTEXT'].includes(entity)) continue;
    const values: Pair[] = []; for (let j = i + 1; j < pairs.length && pairs[j].code !== 0; j += 1) values.push(pairs[j]);
    const layer = values.find((pair) => pair.code === 8)?.value; if (layer) layers.add(layer); const semantic = semanticForLayer(layer);
    if (entity === 'LINE') {
      lineCount++; const x1=numeric(values.find(p=>p.code===10)?.value), y1=numeric(values.find(p=>p.code===20)?.value), x2=numeric(values.find(p=>p.code===11)?.value), y2=numeric(values.find(p=>p.code===21)?.value);
      if (x1!=null&&y1!=null) points.push([x1,y1]); if (x2!=null&&y2!=null) points.push([x2,y2]); if (x1!=null&&y1!=null&&x2!=null&&y2!=null&&previewSegments.length<2500) previewSegments.push({kind:'line',layer,semantic,points:[{x:x1,y:y1},{x:x2,y:y2}]});
    } else if (entity === 'LWPOLYLINE') {
      polylineCount++; const xs=values.filter(p=>p.code===10).map(p=>numeric(p.value)), ys=values.filter(p=>p.code===20).map(p=>numeric(p.value)); const segmentPoints:Array<{x:number;y:number}>=[]; for(let k=0;k<Math.min(xs.length,ys.length);k++) if(xs[k]!=null&&ys[k]!=null){points.push([xs[k]!,ys[k]!]);segmentPoints.push({x:xs[k]!,y:ys[k]!});} if(segmentPoints.length>1&&previewSegments.length<2500) previewSegments.push({kind:'polyline',layer,semantic,points:segmentPoints});
    } else {
      textCount++; const content=values.filter(p=>p.code===1||p.code===3).map(p=>p.value).join(' ').trim(); if(content&&roomLike(content)) labels.add(content.slice(0,120));
    }
  }
  const sortedLayers=[...layers].sort();
  return { parser:'ascii_dxf_v1', sourceAssetId:asset.id, lineCount, polylineCount, textCount, layers:sortedLayers, bounds:boundsFromPoints(points), labelCandidates:[...labels].slice(0,50), semanticLayerCandidates:sortedLayers.map(candidateForLayer), previewSegments, unitStatus:'drawing_units_unverified', warnings:['DXF 좌표 단위와 축척은 자동 확정하지 않습니다.','벽·문·창·기둥·계단·엘리베이터 의미는 layer 이름 기반 후보이며 Human Review 전에는 확정 데이터가 아닙니다.'] };
}

function numberList(value = '') { return (value.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number).filter(Number.isFinite); }
type Matrix2D = [number, number, number, number, number, number];
const IDENTITY_MATRIX: Matrix2D = [1, 0, 0, 1, 0, 0];
function multiplyMatrix(left: Matrix2D, right: Matrix2D): Matrix2D {
  const [a1,b1,c1,d1,e1,f1]=left, [a2,b2,c2,d2,e2,f2]=right;
  return [a1*a2+c1*b2,b1*a2+d1*b2,a1*c2+c1*d2,b1*c2+d1*d2,a1*e2+c1*f2+e1,b1*e2+d1*f2+f1];
}
function matrixForTransform(value = ''): Matrix2D {
  let current: Matrix2D = [...IDENTITY_MATRIX];
  const re=/(matrix|translate|scale|rotate)\s*\(([^)]*)\)/gi; let match: RegExpExecArray | null;
  while((match=re.exec(value))){
    const nums=numberList(match[2]); let next: Matrix2D=[...IDENTITY_MATRIX];
    if(match[1].toLowerCase()==='matrix'&&nums.length>=6) next=[nums[0],nums[1],nums[2],nums[3],nums[4],nums[5]];
    else if(match[1].toLowerCase()==='translate'){next=[1,0,0,1,nums[0]||0,nums[1]||0];}
    else if(match[1].toLowerCase()==='scale'){const sx=nums[0]??1, sy=nums[1]??sx; next=[sx,0,0,sy,0,0];}
    else if(match[1].toLowerCase()==='rotate'){const rad=(nums[0]||0)*Math.PI/180, cos=Math.cos(rad), sin=Math.sin(rad); const rot:Matrix2D=[cos,sin,-sin,cos,0,0]; if(nums.length>=3){const [cx,cy]=[nums[1],nums[2]]; next=multiplyMatrix(multiplyMatrix([1,0,0,1,cx,cy],rot),[1,0,0,1,-cx,-cy]);}else next=rot;}
    current=multiplyMatrix(current,next);
  }
  return current;
}
function cumulativeTransform(el: Element): Matrix2D {
  const chain: Element[]=[]; let current: Element | null=el;
  while(current){chain.unshift(current);current=current.parentElement;}
  return chain.reduce((matrix,node)=>multiplyMatrix(matrix,matrixForTransform(node.getAttribute('transform')||'')),[...IDENTITY_MATRIX] as Matrix2D);
}
function transformPoints(el: Element, points: Array<{x:number;y:number}>) {
  const [a,b,c,d,e,f]=cumulativeTransform(el);
  return points.map(({x,y})=>({x:a*x+c*y+e,y:b*x+d*y+f}));
}
function pathPoints(d: string) {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || []; const result:Array<{x:number;y:number}>=[]; let i=0,x=0,y=0,sx=0,sy=0,cmd='';
  const read=()=>Number(tokens[i++]); while(i<tokens.length){ if(/[A-Za-z]/.test(tokens[i])) cmd=tokens[i++]; if(!cmd) break; const rel=cmd===cmd.toLowerCase(); const C=cmd.toUpperCase();
    if(C==='M'||C==='L'){ if(i+1>=tokens.length) break; let nx=read(), ny=read(); if(rel){nx+=x;ny+=y;} x=nx;y=ny;if(C==='M'){sx=x;sy=y;cmd=rel?'l':'L';} result.push({x,y}); }
    else if(C==='H'){ let nx=read(); if(rel) nx+=x; x=nx; result.push({x,y}); }
    else if(C==='V'){ let ny=read(); if(rel) ny+=y; y=ny; result.push({x,y}); }
    else if(C==='Z'){ x=sx;y=sy; result.push({x,y}); cmd=''; }
    else { const arity = C==='C'?6:C==='S'||C==='Q'?4:C==='A'?7:C==='T'?2:0; if(!arity||i+arity-1>=tokens.length) break; const vals=Array.from({length:arity},read); let nx=vals[arity-2], ny=vals[arity-1]; if(rel){nx+=x;ny+=y;} x=nx;y=ny; result.push({x,y}); }
  } return result;
}
function isRenderableSvgGeometry(el: Element) {
  return !el.closest('defs,pattern,clipPath,mask,symbol,marker');
}

export async function extractSvgGeometry(asset: DigitalTwinAsset): Promise<DxfGeometrySummary> {
  if (asset.fileFormat.toLowerCase() !== 'svg') throw new Error('SVG 자산만 SVG geometry 추출이 가능합니다.');
  if (!(asset.fileData instanceof Blob)) throw new Error('SVG 원본 Blob이 없어 geometry를 추출할 수 없습니다.');
  const text=await asset.fileData.text(); const doc=new DOMParser().parseFromString(text,'image/svg+xml'); if(doc.querySelector('parsererror')) throw new Error('SVG 형식을 확인할 수 없습니다.');
  const points:Array<[number,number]>=[], previewSegments:DxfPreviewSegment[]=[]; const layers=new Set<string>(), labels=new Set<string>(); let lineCount=0, polylineCount=0, textCount=0;
  const layerFor=(el:Element)=>el.getAttribute('data-layer')||el.id||el.getAttribute('class')||el.tagName.toLowerCase();
  const add=(el:Element,pts:Array<{x:number;y:number}>,layer:string,kind:'line'|'polyline')=>{ if(pts.length<2)return; const transformed=transformPoints(el,pts); layers.add(layer); transformed.forEach(p=>points.push([p.x,p.y])); if(previewSegments.length<2500) previewSegments.push({kind,layer,semantic:semanticForLayer(layer),points:transformed}); };
  doc.querySelectorAll('line').forEach(el=>{ if(!isRenderableSvgGeometry(el)) return; const p=[{x:Number(el.getAttribute('x1')||0),y:Number(el.getAttribute('y1')||0)},{x:Number(el.getAttribute('x2')||0),y:Number(el.getAttribute('y2')||0)}]; lineCount++; add(el,p,layerFor(el),'line'); });
  doc.querySelectorAll('polyline,polygon').forEach(el=>{ if(!isRenderableSvgGeometry(el)) return; const n=numberList(el.getAttribute('points')||''); const p:Array<{x:number;y:number}>=[]; for(let i=0;i+1<n.length;i+=2)p.push({x:n[i],y:n[i+1]}); if(el.tagName.toLowerCase()==='polygon'&&p.length)p.push({...p[0]}); polylineCount++; add(el,p,layerFor(el),'polyline'); });
  doc.querySelectorAll('rect').forEach(el=>{ if(!isRenderableSvgGeometry(el)) return; const x=Number(el.getAttribute('x')||0),y=Number(el.getAttribute('y')||0),w=Number(el.getAttribute('width')||0),h=Number(el.getAttribute('height')||0); polylineCount++; add(el,[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h},{x,y}],layerFor(el),'polyline'); });
  doc.querySelectorAll('path').forEach(el=>{ if(!isRenderableSvgGeometry(el)) return; const p=pathPoints(el.getAttribute('d')||''); if(p.length>1){polylineCount++;add(el,p,layerFor(el),'polyline');} });
  doc.querySelectorAll('text,tspan').forEach(el=>{ if(!isRenderableSvgGeometry(el)) return; const t=(el.textContent||'').trim(); if(t){textCount++;if(roomLike(t))labels.add(t.slice(0,120));} });
  const sortedLayers=[...layers].sort();
  return { parser:'svg_floorplan_v1', sourceAssetId:asset.id, lineCount, polylineCount, textCount, layers:sortedLayers, bounds:boundsFromPoints(points), labelCandidates:[...labels].slice(0,50), semanticLayerCandidates:sortedLayers.map(candidateForLayer), previewSegments, unitStatus:'drawing_units_unverified', warnings:['SVG viewBox/좌표 단위는 실제 미터 축척으로 자동 확정하지 않습니다.','defs/pattern/clipPath/mask/symbol 내부의 비가시 장식 geometry는 분석 대상에서 제외합니다.','SVG matrix/translate/scale/rotate transform은 좌표 후보에 반영하지만 곡선은 1차 preview에서 단순화될 수 있어 Human Review가 필요합니다.','벽·문·창 의미는 id/class/data-layer 이름 기반 후보이며 자동 확정하지 않습니다.'] };
}

export const floorPlanGeometryService = {
  canExtract(asset: DigitalTwinAsset) { return ['dxf','svg'].includes(asset.fileFormat.toLowerCase()); },
  extract(asset: DigitalTwinAsset) { return asset.fileFormat.toLowerCase()==='svg' ? extractSvgGeometry(asset) : extractDxfGeometry(asset); },
};
