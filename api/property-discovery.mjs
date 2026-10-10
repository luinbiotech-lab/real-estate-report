import { allowedOrigin, fail, securityHeaders, sendJson } from './_lib/providerProxy.mjs';

const KAKAO_ADDRESS = 'https://dapi.kakao.com/v2/local/search/address.json';
const BLD_BASE = 'https://apis.data.go.kr/1613000/BldRgstHubService';
const NRG_BASE = 'https://apis.data.go.kr/1613000/RTMSDataSvcNrgTrade';
const LAND_BASE = 'https://apis.data.go.kr/1613000/RTMSDataSvcLandTrade';
const ENERGY_BASE = 'https://apis.data.go.kr/1613000/BldEngyHubService';
const SBIZ_RADIUS_URL = 'https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius';

const asArray = (value) => value == null ? [] : Array.isArray(value) ? value : [value];
const num = (value) => { const n = Number(String(value ?? '').replaceAll(',', '').trim()); return Number.isFinite(n) ? n : undefined; };
const ymd = (value) => { const s=String(value??'').replace(/\D/g,''); return s.length===8 ? `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}` : ''; };
const pyeong = (sqm) => sqm == null ? undefined : Math.round((sqm / 3.3058) * 100) / 100;
const normalizedServiceKey = (value='') => { try { return decodeURIComponent(String(value).trim()); } catch { return String(value).trim(); } };

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
  const baseParams={
    serviceKey:key,sigunguCd:resolved.sigunguCd,bjdongCd:resolved.bjdongCd,
    platGbCd: resolved.mountainYn==='Y' ? '1':'0', bun:resolved.bun, ji:resolved.ji,
    numOfRows:'100',pageNo:'1'
  };
  const jsonParams=new URLSearchParams({...baseParams,_type:'json'});
  const jsonResponse=await fetch(`${BLD_BASE}/${path}?${jsonParams}`);
  if(jsonResponse.ok){
    try{
      const body=await jsonResponse.json();
      const rows=asArray(body?.response?.body?.items?.item);
      if(rows.length) return rows;
    }catch{}
  }
  const xmlResponse=await fetch(`${BLD_BASE}/${path}?${new URLSearchParams(baseParams)}`);
  if(!xmlResponse.ok) throw new Error(`건축HUB 요청 실패 (${xmlResponse.status})`);
  return xmlItems(await xmlResponse.text());
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
function normalizeZone(row={}) {
  return {
    type: String(row.jijiguGbCdNm||row.jijiguGbCd||''),
    code: String(row.jijiguCd||''),
    name: String(row.jijiguCdNm||row.etcJijigu||''),
    representativeYn: String(row.reprYn||row.representativeYn||'')
  };
}
function monthsBack(count=6){
  const d=new Date(); const out=[];
  for(let i=0;i<count;i++){const x=new Date(d.getFullYear(),d.getMonth()-i,1);out.push(`${x.getFullYear()}${String(x.getMonth()+1).padStart(2,'0')}`);}
  return out;
}
async function safeProvider(label, task){
  try { return { label, ok:true, value:await task(), error:undefined }; }
  catch(error){ return { label, ok:false, value:[], error:error instanceof Error?error.message:String(error) }; }
}
async function energyRows(path,resolved,key,months){
  const rows=[];
  for(const useYm of months){
    try{
      const params=new URLSearchParams({
        serviceKey:key,sigunguCd:resolved.sigunguCd,bjdongCd:resolved.bjdongCd,
        bun:resolved.bun,ji:resolved.ji,useYm,numOfRows:'100',pageNo:'1'
      });
      const response=await fetch(`${ENERGY_BASE}/${path}?${params}`);
      if(!response.ok) continue;
      for(const item of xmlItems(await response.text())) rows.push({...item,_useYm:useYm});
    }catch{}
  }
  return rows;
}
function energyValue(row,type){
  const candidates=type==='electricity'
    ? ['useQty','elctyUsgQty','elctyUsg','usage','kwh','useKwh']
    : ['useQty','gasUsgQty','gasUsg','usage','kwh','useKwh'];
  for(const key of candidates){const value=num(row?.[key]); if(value!=null) return value;}
  for(const [key,value] of Object.entries(row||{})){
    if(type==='electricity' && /elct|electric/i.test(key)){const parsed=num(value); if(parsed!=null) return parsed;}
    if(type==='gas' && /gas/i.test(key)){const parsed=num(value); if(parsed!=null) return parsed;}
  }
  return undefined;
}
function normalizeEnergy(electricityRows,gasRows,months){
  const byMonth=new Map(months.map(useYm=>[useYm,{useYm,electricityKwh:undefined,gasKwh:undefined}]));
  for(const row of electricityRows){
    const useYm=String(row.useYm||row._useYm||'');
    const current=byMonth.get(useYm)||{useYm};
    current.electricityKwh=energyValue(row,'electricity');
    byMonth.set(useYm,current);
  }
  for(const row of gasRows){
    const useYm=String(row.useYm||row._useYm||'');
    const current=byMonth.get(useYm)||{useYm};
    current.gasKwh=energyValue(row,'gas');
    byMonth.set(useYm,current);
  }
  const monthly=[...byMonth.values()].sort((a,b)=>b.useYm.localeCompare(a.useYm));
  const positiveMonths=monthly.filter(item=>(item.electricityKwh||0)>0 || (item.gasKwh||0)>0).length;
  return {
    state: positiveMonths>0 ? 'energy_usage_observed' : 'no_public_record',
    interpretation: positiveMonths>0
      ? '공개 에너지 사용 흔적이 있으나 실제 점유/영업을 확정하지 않음'
      : '공개 사용량이 없거나 제외 대상일 수 있어 공실로 판단하지 않음',
    positiveMonths,
    latestObservedMonth: monthly.find(item=>(item.electricityKwh||0)>0 || (item.gasKwh||0)>0)?.useYm,
    monthly
  };
}
function normalizeAddressText(value=''){
  return String(value).replace(/\s+/g,'').replace(/[()]/g,'').toLowerCase();
}
async function operatingBusinesses(resolved,key){
  try{
    const params=new URLSearchParams({
      serviceKey:key,
      radius:'40',
      cx:String(resolved.longitude),
      cy:String(resolved.latitude),
      numOfRows:'100',
      pageNo:'1',
      type:'json'
    });
    const response=await fetch(`${SBIZ_RADIUS_URL}?${params}`);
    if(!response.ok) return {state:'provider_unavailable',interpretation:`상가업소 공개 API 요청 실패 (${response.status})`,nearby:[],sameAddress:[]};
    const body=await response.json();
    const rawItems=asArray(body?.body?.items || body?.response?.body?.items?.item || body?.response?.body?.items);
    const nearby=rawItems.map(row=>({
      businessId:String(row.bizesId||''),
      businessName:String(row.bizesNm||''),
      branchName:String(row.brchNm||''),
      industryLarge:String(row.indsLclsNm||''),
      industryMiddle:String(row.indsMclsNm||''),
      industrySmall:String(row.indsSclsNm||''),
      lotAddress:String(row.lnoAdr||''),
      roadAddress:String(row.rdnmAdr||''),
      buildingName:String(row.bldNm||''),
      floor:String(row.flrNo||''),
      unit:String(row.hoNo||''),
      longitude:num(row.lon),
      latitude:num(row.lat)
    }));
    const targetLot=normalizeAddressText(resolved.lotAddress);
    const targetRoad=normalizeAddressText(resolved.roadAddress);
    const sameAddress=nearby.filter(item=>{
      const lot=normalizeAddressText(item.lotAddress);
      const road=normalizeAddressText(item.roadAddress);
      return Boolean((targetLot && lot===targetLot) || (targetRoad && road===targetRoad));
    });
    return {
      state:sameAddress.length ? 'operating_business_observed' : nearby.length ? 'nearby_business_observed' : 'no_public_record',
      interpretation:sameAddress.length
        ? `동일 주소에서 영업 중 상가업소 ${sameAddress.length}건이 관측되지만 건물 전체 점유를 확정하지 않음`
        : nearby.length
          ? '인근 영업 업소는 관측되지만 동일 주소 업소는 확인되지 않음'
          : '공개 상가업소 기록이 없으며 공실을 의미하지 않음',
      sameAddress:sameAddress.slice(0,30),
      nearby:nearby.slice(0,50)
    };
  }catch(error){
    return {state:'provider_unavailable',interpretation:error instanceof Error?error.message:'상가업소 공개 API 조회 실패',nearby:[],sameAddress:[]};
  }
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
function normalizeTrade(row,type,resolved){
  const sourceDealAmountTenThousandWon=num(row.dealAmount||row.거래금액);
  const amount=sourceDealAmountTenThousandWon!=null ? sourceDealAmountTenThousandWon*10000 : undefined;
  const legalDong=String(row.umdNm||row.법정동||'').trim();
  const jibun=String(row.jibun||row.지번||'').trim();
  const buildingName=String(row.buildingName||row.건물명||'').trim();
  const buildingAreaSqm=num(row.buildingArea||row.buildingAr||row.excluUseAr||row.totalFloorAr||row.건물면적);
  const landAreaSqm=num(row.landArea||row.landAr||row.dealArea||row.대지면적||row.거래면적);
  const targetJibun=`${Number(resolved.bun)}${Number(resolved.ji)>0?'-'+Number(resolved.ji):''}`;
  const masked=/\*|X|x/.test(jibun);
  const matchLevel=!masked && jibun===targetJibun
    ? 'exact_lot'
    : masked
      ? 'masked_address_candidate'
      : legalDong && legalDong.includes(resolved.region3)
        ? 'same_dong_candidate'
        : 'regional_candidate';
  const basisArea=type==='land' ? landAreaSqm : buildingAreaSqm || landAreaSqm;
  const year=String(row.dealYear||row.년||'').trim();
  const month=String(row.dealMonth||row.월||'').trim().padStart(2,'0');
  const day=String(row.dealDay||row.일||'').trim().padStart(2,'0');
  return {
    type,
    dealAmount:amount,
    sourceDealAmountTenThousandWon,
    dealAmountSourceUnit:'만원',
    currency:'KRW',
    dealDate:year ? `${year}-${month}-${day}` : '',
    legalDong,
    jibun,
    buildingName,
    buildingAreaSqm,
    landAreaSqm,
    floor:row.floor||row.층||'',
    buildingUse:row.buildingUse||row.건물용도||'',
    matchLevel,
    pricePerSqm: amount && basisArea ? Math.round(amount / basisArea) : undefined,
    pricePerPyeong: amount && basisArea ? Math.round(amount / (basisArea / 3.3058)) : undefined,
    raw:row
  };
}
function marketSummary(rows){
  const exact=rows.filter(row=>row.matchLevel==='exact_lot');
  const prices=rows.map(row=>row.dealAmount).filter(value=>Number.isFinite(value)).sort((a,b)=>a-b);
  const unitPrices=rows.map(row=>row.pricePerPyeong).filter(value=>Number.isFinite(value)).sort((a,b)=>a-b);
  const median=(values)=>values.length ? values[Math.floor((values.length-1)/2)] : undefined;
  return {
    totalCandidates: rows.length,
    exactLotCount: exact.length,
    latestDealDate: rows.map(row=>row.dealDate).filter(Boolean).sort().at(-1),
    medianDealAmount: median(prices),
    medianPricePerPyeong: median(unitPrices)
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
    const key=normalizedServiceKey(process.env.DATA_GO_KR_SERVICE_KEY||'');
    if(!key) return sendJson(response,200,{status:'partial',publicDataConfigured:false,address,building:null,floors:[],market:{commercial:[],land:[]},usageEvidence:{state:'not_configured',interpretation:'공공데이터포털 서비스키 등록 후 조회',positiveMonths:0,monthly:[]},operatingBusinessEvidence:{state:'not_configured',interpretation:'공공데이터포털 서비스키 등록 후 조회',sameAddress:[],nearby:[]}},origin);

    const months=monthsBack(6);
    const [titleResult,floorResult,zoneResult,commercialResult,landResult,electricityResult,gasResult,businessResult]=await Promise.all([
      safeProvider('buildingTitle',()=>building('getBrTitleInfo',address,key)),
      safeProvider('buildingFloors',()=>building('getBrFlrOulnInfo',address,key)),
      safeProvider('landUseZones',()=>building('getBrJijiguInfo',address,key)),
      safeProvider('commercialTrades',()=>tradeRows(NRG_BASE,'getRTMSDataSvcNrgTrade',address.sigunguCd,key,months)),
      safeProvider('landTrades',()=>tradeRows(LAND_BASE,'getRTMSDataSvcLandTrade',address.sigunguCd,key,months)),
      safeProvider('electricityUsage',()=>energyRows('getBeElctyUsgInfo',address,key,months)),
      safeProvider('gasUsage',()=>energyRows('getBeGasUsgInfo',address,key,months)),
      safeProvider('operatingBusinesses',()=>operatingBusinesses(address,key))
    ]);
    const titles=titleResult.value, floors=floorResult.value, zones=zoneResult.value;
    const commercialRaw=commercialResult.value, landRaw=landResult.value;
    const electricityRaw=electricityResult.value, gasRaw=gasResult.value;
    const businessEvidence=businessResult.ok
      ? businessResult.value
      : {state:'provider_unavailable',interpretation:businessResult.error||'상가업소 공급원 조회 실패',nearby:[],sameAddress:[]};
    const providerStatus=Object.fromEntries([
      titleResult,floorResult,zoneResult,commercialResult,landResult,electricityResult,gasResult,businessResult
    ].map(result=>[result.label,{ok:result.ok,error:result.error}]));
    const buildingTitle=titles[0] ? normalizeTitle(titles[0]) : null;
    const commercial=commercialRaw.map(r=>normalizeTrade(r,'commercial',address)).filter(r=>!r.legalDong || r.legalDong.includes(address.region3));
    const land=landRaw.map(r=>normalizeTrade(r,'land',address)).filter(r=>!r.legalDong || r.legalDong.includes(address.region3));
    const marketRows=[...commercial,...land].sort((a,b)=>b.dealDate.localeCompare(a.dealDate));
    const landUseZones=zones.map(normalizeZone).filter(zone=>zone.name);
    const usageEvidence=normalizeEnergy(electricityRaw,gasRaw,months);
    return sendJson(response,200,{
      status:Object.values(providerStatus).every((item)=>item.ok) ? 'ok' : 'partial',publicDataConfigured:true,address,building:buildingTitle,providerStatus,
      buildingCandidates:titles.map(normalizeTitle),floors:floors.map(normalizeFloor),landUseZones,
      market:{commercial:commercial.slice(0,40),land:land.slice(0,40),summary:marketSummary(marketRows),exactLot:marketRows.filter(row=>row.matchLevel==='exact_lot').slice(0,20)},
      usageEvidence,
      operatingBusinessEvidence:businessEvidence,
      sources:{
        address:'Kakao Local Address API',
        building:'국토교통부 건축HUB 건축물대장정보',
        commercial:'국토교통부 상업업무용 부동산 매매 실거래가',
        land:'국토교통부 토지 매매 실거래가',
        energy:'국토교통부 건축HUB 건물에너지정보',
        operatingBusinesses:'소상공인시장진흥공단 상가(상권)정보'
      },
      collectedAt:new Date().toISOString()
    },origin);
  }catch(error){
    return fail(response,502,'DISCOVERY_FAILED',error instanceof Error?error.message:'부동산 공공데이터 조회에 실패했습니다.',origin);
  }
}
