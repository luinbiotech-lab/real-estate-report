import { chromium } from 'playwright';

const BASE_URL=process.env.REPORT_QA_BASE_URL||'http://127.0.0.1:4174';
const SOURCE_URL='https://upload.wikimedia.org/wikipedia/commons/7/74/Little_White_House_floor_plan.svg';
const REAL_LENGTH_M=54*0.3048;
const DRAWING_LENGTH=258.138;
const SCALE=REAL_LENGTH_M/DRAWING_LENGTH;
const TEST_HEIGHT_M=2.7;
const assert=(c,m)=>{if(!c)throw new Error(m)};

const res=await fetch(SOURCE_URL);
assert(res.ok,'SVG fetch failed '+res.status);
const svgText=await res.text();

const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
try{
  await page.goto(BASE_URL,{waitUntil:'networkidle'});
  const result=await page.evaluate(async ({svgText,scale,realLengthM,drawingLength,heightM})=>{
    const geomMod=await import('/src/services/floorPlanGeometryService.ts');
    const topologyMod=await import('/src/services/roomTopologyService.ts');
    const extrusionMod=await import('/src/services/extrusionGeometryService.ts');
    const file=new File([svgText],'Little_White_House_floor_plan.svg',{type:'image/svg+xml'});
    const now=new Date().toISOString();
    const base={id:'svg-e2e-extrusion',propertyId:'qa',assetType:'floor_plan',fileFormat:'svg',storagePath:'qa/svg',fileName:file.name,mimeType:file.type,fileData:file,floor:'1F',version:1,processingStatus:'processing',metadata:{},createdAt:now,updatedAt:now};
    const geometry=await geomMod.floorPlanGeometryService.extract(base);
    const calibrated={...base,metadata:{geometry,scaleCalibration:{status:'verified',method:'known_distance',drawingLength,realLengthM,metersPerDrawingUnit:scale,referenceLabel:'Sun Deck 54 ft QA candidate',note:'TEST ONLY',verifiedAt:now}}};
    const candidates=topologyMod.roomTopologyService.buildCandidates(calibrated);
    const priority=candidates.filter(c=>(c.areaSqmCandidate||0)>=2&&(c.areaSqmCandidate||0)<=80);
    const roomTopologyReviews=priority.map((candidate,index)=>({candidateId:candidate.id,decision:'approved',name:`TEST ROOM ${index+1}`,note:'TEST ONLY',reviewedAt:now}));
    const ready={...calibrated,metadata:{...calibrated.metadata,roomTopologyReviews,verticalDimensions:{status:'verified',ceilingHeightM:heightM,sourceLabel:'TEST ONLY 2.7m',note:'실제 건물 높이 아님',verifiedAt:now}}};
    const extrusion=extrusionMod.extrusionGeometryService.build(ready);
    return {priorityCount:priority.length,extrusionStatus:extrusion.status,roomCount:extrusion.rooms.length,rooms:extrusion.rooms.map(r=>({name:r.name,heightM:r.heightM,areaSqmCandidate:r.areaSqmCandidate,volumeM3Candidate:r.volumeM3Candidate,points:r.bottom.length})),warnings:extrusion.warnings};
  },{svgText,scale:SCALE,realLengthM:REAL_LENGTH_M,drawingLength:DRAWING_LENGTH,heightM:TEST_HEIGHT_M});
  assert(result.priorityCount===7,`Expected 7 priority candidates, got ${result.priorityCount}`);
  assert(result.extrusionStatus==='ready',`Extrusion not ready: ${JSON.stringify(result)}`);
  assert(result.roomCount===7,`Expected 7 test extrusions, got ${result.roomCount}`);
  assert(result.rooms.every(r=>r.heightM===2.7&&r.points>=4),'Extrusion room geometry mismatch');
  console.log('SVG test-only extrusion chain: PASS');
  console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
