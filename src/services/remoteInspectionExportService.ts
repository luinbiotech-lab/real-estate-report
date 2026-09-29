import type { DigitalTwinAsset } from '../domain/propertyDataRoom/types';
import { buildDigitalTwinPackage } from './digitalTwinPackageService';
import { buildReviewedMeshCandidate } from './reviewedMeshCandidateService';

export const REMOTE_INSPECTION_EXPORT_VERSION = 'daon-remote-inspection-v1';

function safeEmbeddedJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

export function buildStandaloneRemoteInspectionHtml(asset: DigitalTwinAsset) {
  const pkg = buildDigitalTwinPackage(asset);
  const mesh = buildReviewedMeshCandidate(asset);
  if (mesh.status !== 'ready') throw new Error('검토용 mesh 후보가 준비되어야 원격 검토 파일을 만들 수 있습니다.');

  const payload = safeEmbeddedJson({
    version: REMOTE_INSPECTION_EXPORT_VERSION,
    generatedAt: new Date().toISOString(),
    sourceAsset: pkg.sourceAsset,
    mesh,
    graph: pkg.graph,
    openings: pkg.openings,
    safety: pkg.safety,
  });

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>DA:ON Remote Digital Twin Review</title>
<style>
:root{font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#14213d;background:#eef2f6}*{box-sizing:border-box}body{margin:0}.top{background:#10243f;color:#fff;padding:22px 28px;border-bottom:4px solid #b89b63}.top small{color:#d7c8a7;letter-spacing:.12em}.wrap{max-width:1280px;margin:0 auto;padding:22px}.grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:18px}.card{background:#fff;border:1px solid #d9e0e8;border-radius:12px;padding:16px;box-shadow:0 8px 24px rgba(16,36,63,.06)}#viewer{width:100%;height:620px;background:#f8fafc;border:1px solid #dfe5ec;border-radius:8px}.controls{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:12px}input[type=range]{width:100%}.badge{display:inline-block;border:1px solid #cbd5e1;border-radius:999px;padding:5px 9px;font-size:12px;margin:0 5px 5px 0}.warn{background:#fff7e6;border:1px solid #ead39a;padding:12px;border-radius:8px;color:#674d10;font-size:13px;line-height:1.55}h1,h2,h3{margin-top:0}.list{font-size:13px;line-height:1.6;color:#475467}.muted{color:#667085}@media(max-width:900px){.grid{grid-template-columns:1fr}#viewer{height:480px}}
</style>
</head>
<body>
<header class="top"><small>DA:ON ASSET · REMOTE DIGITAL TWIN REVIEW</small><h1 style="margin:6px 0 0">검토용 3D 공간 모델</h1></header>
<main class="wrap">
  <div class="grid">
    <section class="card">
      <div class="controls">
        <label>회전 <span id="yawLabel">35°</span><input id="yaw" type="range" min="-180" max="180" value="35" /></label>
        <label>기울기 <span id="pitchLabel">-28°</span><input id="pitch" type="range" min="-75" max="15" value="-28" /></label>
      </div>
      <svg id="viewer" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-label="DA:ON reviewed 3D mesh"></svg>
      <p class="muted" style="font-size:12px">마우스 드래그 대신 상단 슬라이더로 방향을 조절합니다. 이 파일은 별도 서버 연결 없이 단독 열람할 수 있습니다.</p>
    </section>
    <aside class="card">
      <h2 id="assetName">Digital Twin</h2>
      <div id="badges"></div>
      <h3 style="margin-top:18px">공간</h3><div id="rooms" class="list"></div>
      <h3 style="margin-top:18px">문·창 연결</h3><div id="openings" class="list"></div>
      <h3 style="margin-top:18px">공간 그래프</h3><div id="graph" class="list"></div>
      <div class="warn" style="margin-top:18px">검토용 후보입니다. 공적 장부 면적, 구조 안전성, 피난·접근성, 인허가, 실시설계 적합성을 확정하지 않으며 문·창 절삭/벽 두께/슬래브/구조체가 반영된 production mesh가 아닙니다.</div>
    </aside>
  </div>
</main>
<script id="daon-data" type="application/json">${payload}</script>
<script>
(() => {
  const data = JSON.parse(document.getElementById('daon-data').textContent);
  const svg = document.getElementById('viewer');
  const yawInput = document.getElementById('yaw');
  const pitchInput = document.getElementById('pitch');
  const ns = 'http://www.w3.org/2000/svg';
  document.getElementById('assetName').textContent = data.sourceAsset.fileName || data.sourceAsset.id;
  const badgeValues = [data.version, 'rooms '+data.mesh.rooms.length, 'graph '+data.graph.status, 'productionMeshReady=false'];
  document.getElementById('badges').replaceChildren(...badgeValues.map(value => { const span=document.createElement('span'); span.className='badge'; span.textContent=value; return span; }));
  document.getElementById('rooms').replaceChildren(...data.mesh.rooms.map(room => { const div=document.createElement('div'); div.textContent=room.name+' · 높이 '+room.heightM.toFixed(2)+'m'; return div; }));
  document.getElementById('openings').replaceChildren(...(data.openings.length ? data.openings.map(opening => { const div=document.createElement('div'); const d=opening.dimensions; div.textContent=(opening.semantic||'opening')+' · '+(d ? d.widthM.toFixed(2)+'×'+d.heightM.toFixed(2)+'m' : '치수 미확인'); return div; }) : [(() => { const div=document.createElement('div'); div.textContent='승인된 문·창 연결 없음'; return div; })()]));
  document.getElementById('graph').textContent = 'nodes '+data.graph.nodes.length+' · edges '+data.graph.edges.length+' · '+data.graph.status;

  function project(v, yawDeg, pitchDeg) {
    const yaw=yawDeg*Math.PI/180, pitch=pitchDeg*Math.PI/180;
    const x=v.x*Math.cos(yaw)-v.y*Math.sin(yaw);
    const y1=v.x*Math.sin(yaw)+v.y*Math.cos(yaw);
    const y=y1*Math.cos(pitch)-v.z*Math.sin(pitch);
    return {x,y};
  }
  function render() {
    const yaw=Number(yawInput.value), pitch=Number(pitchInput.value);
    document.getElementById('yawLabel').textContent=yaw+'°'; document.getElementById('pitchLabel').textContent=pitch+'°';
    const roomData=data.mesh.rooms.map(room => ({room, points:room.vertices.map(v=>project(v,yaw,pitch))}));
    const all=roomData.flatMap(x=>x.points); if(!all.length) return;
    const minX=Math.min(...all.map(p=>p.x)), maxX=Math.max(...all.map(p=>p.x)), minY=Math.min(...all.map(p=>p.y)), maxY=Math.max(...all.map(p=>p.y));
    const width=Math.max(.1,maxX-minX), height=Math.max(.1,maxY-minY), pad=Math.max(width,height)*.12;
    svg.setAttribute('viewBox',[minX-pad,-(maxY+pad),width+pad*2,height+pad*2].join(' '));
    svg.replaceChildren();
    const g=document.createElementNS(ns,'g'); g.setAttribute('transform','scale(1,-1)'); svg.appendChild(g);
    roomData.forEach(({room,points}) => room.faces.forEach(face => { const polygon=document.createElementNS(ns,'polygon'); polygon.setAttribute('points',face.map(i => { const p=points[i-1]; return p.x.toFixed(3)+','+p.y.toFixed(3); }).join(' ')); polygon.setAttribute('fill','rgba(30,58,95,.08)'); polygon.setAttribute('stroke','#1e3a5f'); polygon.setAttribute('stroke-width','.025'); polygon.setAttribute('vector-effect','non-scaling-stroke'); g.appendChild(polygon); }));
  }
  yawInput.addEventListener('input',render); pitchInput.addEventListener('input',render); render();
})();
</script>
</body>
</html>`;
}

export const remoteInspectionExportService = { buildHtml: buildStandaloneRemoteInspectionHtml };
