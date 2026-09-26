import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { buildingStackService } from './buildingStackService';
import { geometryOperationPlanService } from './geometryOperationPlanService';
import { openingBooleanEligibilityService } from './openingBooleanEligibilityService';
import { slabCoreAlignmentService } from './slabCoreAlignmentService';
import { verticalCoreService } from './verticalCoreService';
import { wallGeometryMergeService } from './wallGeometryMergeService';

export const REMOTE_INSPECTION_VERSION = 'daon-remote-inspection-v1';

export function buildRemoteInspectionPackage(assets: DigitalTwinAsset[]) {
  const stack = buildingStackService.build(assets);
  const operationPlan = geometryOperationPlanService.build(assets);
  const wallMerge = assets.map((asset) => ({ assetId: asset.id, floor: asset.floor, junctions: wallGeometryMergeService.build(asset) }));
  const openingBoolean = assets.map((asset) => ({ assetId: asset.id, floor: asset.floor, openings: openingBooleanEligibilityService.build(asset) }));
  const slabCore = assets.map((asset) => ({ assetId: asset.id, floor: asset.floor, cores: slabCoreAlignmentService.build(asset) }));
  const verticalCores = verticalCoreService.buildConnections(assets);
  const blockers = [
    ...wallMerge.flatMap((item) => item.junctions.filter((junction) => !junction.eligible).map((junction) => `${item.floor || item.assetId}: wall junction ${junction.junctionId}`)),
    ...openingBoolean.flatMap((item) => item.openings.filter((opening) => !opening.eligible).map((opening) => `${item.floor || item.assetId}: opening ${opening.candidateId}`)),
    ...slabCore.flatMap((item) => item.cores.filter((core) => core.alignmentStatus !== 'aligned').map((core) => `${item.floor || item.assetId}: core ${core.coreId}`)),
    ...verticalCores.filter((core) => core.alignmentStatus !== 'aligned').map((core) => `vertical core ${core.coreId}`),
  ];
  return {
    schemaVersion: REMOTE_INSPECTION_VERSION,
    generatedAt: new Date().toISOString(),
    propertyId: assets[0]?.propertyId,
    stack,
    operationPlan,
    wallMerge,
    openingBoolean,
    slabCore,
    verticalCores,
    readiness: {
      reviewable: stack.floors.length > 0,
      floorCount: stack.floors.length,
      blockerCount: blockers.length,
      operationEligibleCount: operationPlan.summary.eligible,
      operationBlockedCount: operationPlan.summary.blocked,
      productionReady: false,
    },
    blockers,
    safety: [
      '원격검토 패키지는 검토 후보이며 시공·구조·법정 BIM이 아닙니다.',
      'wall merge, opening boolean, slab/core opening은 eligibility/alignment 단계이며 실제 geometry operation은 적용하지 않습니다.',
      'geometry operation plan의 eligible은 실행 조건 충족을 의미하며 applied=false 상태를 유지합니다.',
      'productionReady는 명시적으로 false입니다.',
    ],
  };
}

function esc(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

export function buildRemoteInspectionHtml(assets: DigitalTwinAsset[]) {
  const data = buildRemoteInspectionPackage(assets);
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DA:ON Remote Inspection</title><style>body{font-family:Arial,sans-serif;margin:0;background:#f3f5f8;color:#172033}header{background:#0b2745;color:white;padding:20px}main{padding:20px;max-width:1200px;margin:auto}.card{background:white;border:1px solid #d9e0e8;border-radius:12px;padding:16px;margin-bottom:16px}.toolbar{display:flex;gap:12px;flex-wrap:wrap;align-items:center}canvas{width:100%;height:560px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px}label{font-size:13px;color:#667085}.warn{background:#fff8e8;border:1px solid #ead8b7;padding:12px;border-radius:8px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #eee;text-align:left}.eligible{color:#176b45}.blocked{color:#b54708}.na{color:#667085}</style></head><body><header><h1>DA:ON Multi-floor Remote Inspection</h1><div>REVIEW CANDIDATE · NOT FOR CONSTRUCTION</div></header><main><section class="card"><div class="toolbar"><label>Yaw <input id="yaw" type="range" min="-180" max="180" value="35"></label><label>Pitch <input id="pitch" type="range" min="-75" max="15" value="-28"></label><label><input id="labels" type="checkbox" checked> Floor labels</label></div><canvas id="view" width="1100" height="560"></canvas></section><section class="card"><h2>Readiness</h2><div id="readiness"></div></section><section class="card"><h2>Floors</h2><table><thead><tr><th>Floor</th><th>Z</th><th>Rooms</th><th>Walls</th><th>Openings</th></tr></thead><tbody id="floors"></tbody></table></section><section class="card"><h2>Geometry Operation Plan</h2><table><thead><tr><th>Floor</th><th>Operation</th><th>Status</th><th>Blockers / Targets</th></tr></thead><tbody id="operations"></tbody></table></section><section class="card"><h2>Blockers</h2><div id="blockers"></div></section><div class="warn">원격검토용 후보입니다. 구조·피난·인허가·시공 적합성을 확정하지 않습니다. Geometry operation은 아직 applied=false입니다.</div></main><script>const DATA=${esc(data)};const c=document.getElementById('view'),x=c.getContext('2d');const yaw=document.getElementById('yaw'),pitch=document.getElementById('pitch'),labels=document.getElementById('labels');function P(p){const y=+yaw.value*Math.PI/180,t=+pitch.value*Math.PI/180;const a=p.x*Math.cos(y)-p.y*Math.sin(y),b=p.x*Math.sin(y)+p.y*Math.cos(y),d=b*Math.cos(t)-p.z*Math.sin(t);return{x:a,y:d}}function draw(){x.clearRect(0,0,c.width,c.height);const polys=[];for(const f of DATA.stack.floors)for(const r of f.rooms)for(const face of r.faces){const pts=face.map(i=>P(r.vertices[i-1])).filter(Boolean);if(pts.length)polys.push({pts,floor:f.floorLabel})}if(!polys.length)return;const all=polys.flatMap(q=>q.pts),minX=Math.min(...all.map(p=>p.x)),maxX=Math.max(...all.map(p=>p.x)),minY=Math.min(...all.map(p=>p.y)),maxY=Math.max(...all.map(p=>p.y)),w=Math.max(.1,maxX-minX),h=Math.max(.1,maxY-minY),s=Math.min((c.width-80)/w,(c.height-80)/h);for(const q of polys){x.beginPath();q.pts.forEach((p,i)=>{const px=40+(p.x-minX)*s,py=c.height-40-(p.y-minY)*s;i?x.lineTo(px,py):x.moveTo(px,py)});x.closePath();x.fillStyle='rgba(30,58,95,.05)';x.strokeStyle='#1e3a5f';x.fill();x.stroke()}if(labels.checked){x.fillStyle='#0b2745';DATA.stack.floors.forEach((f,i)=>x.fillText(f.floorLabel,12,22+i*18))}}yaw.oninput=pitch.oninput=labels.onchange=draw;document.getElementById('readiness').textContent=JSON.stringify(DATA.readiness);document.getElementById('floors').innerHTML=DATA.stack.floors.map(f=>'<tr><td>'+f.floorLabel+'</td><td>'+f.elevationM.toFixed(2)+'m</td><td>'+f.roomCount+'</td><td>'+f.wallSegmentCount+'</td><td>'+f.openingCutCount+'</td></tr>').join('');document.getElementById('operations').innerHTML=DATA.operationPlan.steps.map(s=>'<tr><td>'+(s.floorLabel||'BUILDING')+'</td><td>'+s.type+'</td><td class="'+(s.status==='eligible'?'eligible':s.status==='blocked'?'blocked':'na')+'">'+s.status+'</td><td>'+(s.blockers.length?s.blockers.join(' / '):s.targets.length+' target · applied=false')+'</td></tr>').join('');document.getElementById('blockers').innerHTML=DATA.blockers.length?'<ul>'+DATA.blockers.map(v=>'<li>'+v+'</li>').join('')+'</ul>':'검토 blocker 없음';draw();</script></body></html>`;
}

export const remoteInspectionService = { build: buildRemoteInspectionPackage, toHtml: buildRemoteInspectionHtml };
