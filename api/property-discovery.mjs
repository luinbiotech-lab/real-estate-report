import { allowedOrigin, fail, securityHeaders, sendJson } from './_lib/providerProxy.mjs';

const KAKAO_ADDRESS = 'https://dapi.kakao.com/v2/local/search/address.json';
const BLD_BASE = 'https://apis.data.go.kr/1613000/BldRgstHubService';
const NRG_BASE = 'https://apis.data.go.kr/1613000/RTMSDataSvcNrgTrade';
const LAND_BASE = 'https://apis.data.go.kr/1613000/RTMSDataSvcLandTrade';

const asArray = (value) => value == null ? [] : Array.isArray(value) ? value : [value];
const num = (value) => { const n = Number(String(value ?? '').replaceAll(',', '').trim()); return Number.isFinite(n) ? n : undefined; };
const ymd = (value) => { const s=String(value??'').replace(/\D/g,''); return s.length===8 ? `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}` : ''; };
const pyeong = (sqm) => sqm == null ? undefined : Math.round((sqm / 3.3058) * 100) / 100;

function decodeXml(value='') {
  return String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&').replaceAll('&quot;','"').trim();
}
function xmlItems(xml) {
  const blocks = [...String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m=>m[1]);
  return blocks.map(block => {
    const out={};
    for (const m of block.matchAll(/<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g)) out[m[1]]=decodeXml(m[2]);
    return out;
  });
}
async function kakaoResolve(query) {
  const key=process.env.KAKAO_REST_API_KEY;
  if (!key) throw new Error('Kakao REST API 설정이 없습니다.');
  const res=await fetch(`${KAKAO_ADDRESS}?${new URLSearchParams({query,size:'5'})}`,{headers:{Authorization:`KakaoAK ${key}`}});
  if (!res.ok) throw new Error(`Kakao 주소검색 실패 (${res.status})`);
  const data=await res.json();
  const doc=data.documents?.[0];
  if (!doc) return null;
  const a=doc.address;
  const road=doc.road_address;
  const bCode=String(a?.b_code||'');
  return {
    query,
    officialAddress: road?.address_name || a?.address_name || query,
    roadAddress: road?.address_name || '',
    lotAddress: a?.address_name || '',
    latitude: Number(doc.y),
    longitude: Number(doc.x),
    region1: a?.region_1depth_name || '',
    region2: a?.region_2depth_name || '',
    region3: a?.region_3depth_name || '',
    bCode,
    sigunguCd: bCode.slice(0,5),
    bjdongCd: bCode.slice(5,10),
    mountainYn: a?.mountain_yn || 'N',
    bun: String(a?.main_address_no||'').padStart(4,'0'),
    ji: String(a?.sub_address_no||'0').padStart(4,'0'),
  };
}
async function building(path, resolved, key) {
  const params=new URLSearchParams({
    serviceKey:key,sigunguCd:resolved.sigunguCd,bjdongCd:resolved.bjdongCd,
    platGbCd: resolved.mountainYn==='Y' ? '1':'0', bun:resolved.bun, ji:resolved.ji,
    numOfRows:'100',pageNo:'1',_type:'json'
  });
  const res=await fetch(`${BLD_BASE}/${path}?${params}`);
  if(!res.ok) throw new Error(`건축HUB 요청 실패 (${res.status})`);
  const body=await res.json();
  return asArray(body?.response?.body?.items?.item);
}
function normalizeTitle(row={}) {
  const landArea=num(row.platArea), total=num(row.totArea), build=num(row.archArea);
  const parking=(num(row.indrMechUtcnt)||0)+(num(row.oudrMechUtcnt)||0)+(num(row.indrAutoUtcnt)||0)+(num(row.oudrAutoUtcnt)||0);
  return {
    buildingName: row.bldNm || '',
    lotAddress: row.platPlc || '',
    roadAddress: row.newPlatPlc || '',
    landAreaSqm: landArea, landAreaPyeong:pyeong(landArea),
    buildingAreaSqm: build, buildingAreaPyeong:pyeong(build),
    totalFloorAreaSqm: total, totalFloorAreaPyeong:pyeong(total),
    buildingCoverageRate:num(row.bcRat), floorAreaRatio:num(row.vlRat),
    structure:row.strctCdNm||row.etcStrct||'', mainUse:row.mainPurpsCdNm||row.etcPurps||'',
    groundFloors:num(row.grndFlrCnt)||0, basementFloors:num(row.ugrndFlrCnt)||0,
    householdCount:num(row.hhldCnt), familyCount:num(row.fmlyCnt), heightM:num(row.heit),
    elevatorCount:(num(row.rideUseElvtCnt)||0)+(num(row.emgenUseElvtCnt)||0),
    parkingOfficial:parking, completionDate:ymd(row.useAprDay),
    rawPk:row.mgmBldrgstPk||''
  };
}
function normalizeFloor(row={}) {
  return { floorType:row.flrGbCdNm||'', floor:row.flrNoNm||'', areaSqm:num(row.area), mainUse:row.mainPurpsCdNm||row.etcPurps||'', structure:row.strctCdNm||row.etcStrct||'' };
}
function monthsBack(count=6){
  const d=new Date(); const out=[];
  for(let i=0;i<count;i++){const x=new Date(d.getFullYear(),d.getMonth()-i,1);out.push(`${x.getFullYear()}${String(x.getMonth()+1).padStart(2,'0')}`);}
  return out;
}
async function tradeRows(base,path,lawdCd,key,months) {
  const results=[];
  for(const ym of months){
    try{
      const params=new URLSearchParams({serviceKey:key,LAWD_CD:lawdCd,DEAL_YMD:ym,numOfRows:'1000',pageNo:'1'});
      const res=await fetch(`${base}/${path}?${params}`);
      if(!res.ok) continue;
      for(const item of xmlItems(await res.text())) results.push({...item,_dealYmd:ym});
    } catch {}
  }
  return results;
}
function normalizeTrade(row,type){
  const amount=num(row.dealAmount||row.거래금액);
  return {
    type,
    dealAmount:amount,
    dealDate:[row.dealYear||row.년,row.dealMonth||row.월,row.dealDay||row.일].filter(Boolean).join('-'),
    legalDong:row.umdNm||row.법정동||'',
    jibun:row.jibun||row.지번||'',
    buildingName:row.buildingName||row.건물명||'',
    buildingAreaSqm:num(row.buildingArea||row.건물면적),
    landAreaSqm:num(row.landArea||row.대지면적),
    floor:row.floor||row.층||'',
    buildingUse:row.buildingUse||row.건물용도||'',
    raw:row
  };
}

export default async function handler(request,response){
  const origin=allowedOrigin(request);
  if(origin===null) return fail(response,403,'ORIGIN_NOT_ALLOWED','허용되지 않은 origin입니다.');
  if(request.method!=='GET') return fail(response,405,'METHOD_NOT_ALLOWED','GET 요청만 지원합니다.',origin);
  const query=new URL(request.url||'/', 'https://vercel.invalid').searchParams.get('query')?.trim();
  if(!query) return fail(response,400,'INVALID_REQUEST','주소 또는 지번을 입력해 주세요.',origin);
  try{
    const address=await kakaoResolve(query);
    if(!address) return sendJson(response,200,{status:'not_found',query,publicDataConfigured:Boolean(process.env.DATA_GO_KR_SERVICE_KEY)},origin);
    const key=String(process.env.DATA_GO_KR_SERVICE_KEY||'').trim();
    if(!key) return sendJson(response,200,{status:'partial',publicDataConfigured:false,address,building:null,floors:[],market:{commercial:[],land:[]}},origin);

    const [titles,floors,commercialRaw,landRaw]=await Promise.all([
      building('getBrTitleInfo',address,key),
      building('getBrFlrOulnInfo',address,key),
      tradeRows(NRG_BASE,'getRTMSDataSvcNrgTrade',address.sigunguCd,key,monthsBack(6)),
      tradeRows(LAND_BASE,'getRTMSDataSvcLandTrade',address.sigunguCd,key,monthsBack(6))
    ]);
    const buildingTitle=titles[0] ? normalizeTitle(titles[0]) : null;
    const commercial=commercialRaw.map(r=>normalizeTrade(r,'commercial')).filter(r=>!r.legalDong || r.legalDong.includes(address.region3));
    const land=landRaw.map(r=>normalizeTrade(r,'land')).filter(r=>!r.legalDong || r.legalDong.includes(address.region3));
    return sendJson(response,200,{
      status:'ok',publicDataConfigured:true,address,building:buildingTitle,
      buildingCandidates:titles.map(normalizeTitle),floors:floors.map(normalizeFloor),
      market:{commercial:commercial.slice(0,40),land:land.slice(0,40)},
      sources:{
        address:'Kakao Local Address API',
        building:'국토교통부 건축HUB 건축물대장정보',
        commercial:'국토교통부 상업업무용 부동산 매매 실거래가',
        land:'국토교통부 토지 매매 실거래가'
      },
      collectedAt:new Date().toISOString()
    },origin);
  }catch(error){
    return fail(response,502,'DISCOVERY_FAILED',error instanceof Error?error.message:'부동산 공공데이터 조회에 실패했습니다.',origin);
  }
}
