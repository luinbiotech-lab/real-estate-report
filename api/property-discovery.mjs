import { allowedOrigin, fail, securityHeaders, sendJson } from './_lib/providerProxy.mjs';

const KAKAO_ADDRESS = 'https://dapi.kakao.com/v2/local/search/address.json';
const KAKAO_CATEGORY = 'https://dapi.kakao.com/v2/local/search/category.json';
const BLD_BASE = 'https://apis.data.go.kr/1613000/BldRgstHubService';
const NRG_BASE = 'https://apis.data.go.kr/1613000/RTMSDataSvcNrgTrade';
const LAND_BASE = 'https://apis.data.go.kr/1613000/RTMSDataSvcLandTrade';
const ENERGY_BASE = 'https://apis.data.go.kr/1613000/BldEngyHubService';
const SBIZ_RADIUS_URL = 'https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius';
const VWORLD_BASE = 'https://api.vworld.kr/ned/data';

const asArray = (value) => value == null ? [] : Array.isArray(value) ? value : [value];
const num = (value) => { const n = Number(String(value ?? '').replaceAll(',', '').trim()); return Number.isFinite(n) ? n : undefined; };
const ymd = (value) => { const s=String(value??'').replace(/\D/g,''); return s.length===8 ? `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}` : ''; };
const pyeong = (sqm) => sqm == null ? undefined : Math.round((sqm / 3.3058) * 100) / 100;
function fetchWithTimeout(url, init={}, timeoutMs=8000) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}
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
  const res=await fetchWithTimeout(`${KAKAO_ADDRESS}?${new URLSearchParams({query,size:'5'})}`,{headers:{Authorization:`KakaoAK ${key}`}});
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
async function kakaoPoiEvidence(resolved) {
  const key=process.env.KAKAO_REST_API_KEY;
  if (!key) return {state:'not_configured',interpretation:'Kakao REST API 설정 없음',sameAddress:[],nearby:[]};
  const categories=['FD6','CE7','CS2','BK9','HP8','PM9','AG2'];
  const batches=await Promise.all(categories.map(async (categoryGroupCode)=>{
    try{
      const params=new URLSearchParams({
        category_group_code:categoryGroupCode,
        x:String(resolved.longitude),
        y:String(resolved.latitude),
        radius:'80',
        size:'15',
        sort:'distance'
      });
      const response=await fetchWithTimeout(`${KAKAO_CATEGORY}?${params}`,{headers:{Authorization:`KakaoAK ${key}`}});
      if(!response.ok) return [];
      const body=await response.json();
      return (body.documents||[]).map(doc=>({
        placeId:String(doc.id||''),
        placeName:String(doc.place_name||''),
        categoryName:String(doc.category_name||''),
        categoryGroupCode:String(doc.category_group_code||categoryGroupCode),
        categoryGroupName:String(doc.category_group_name||''),
        phone:String(doc.phone||''),
        lotAddress:String(doc.address_name||''),
        roadAddress:String(doc.road_address_name||''),
        distanceMeters:num(doc.distance),
        longitude:num(doc.x),
        latitude:num(doc.y),
        placeUrl:String(doc.place_url||'')
      }));
    }catch{return [];}
  }));
  const all=batches.flat();
  const unique=[...new Map(all.map(item=>[item.placeId||`${item.placeName}:${item.roadAddress}`,item])).values()];
  const targetLot=normalizeAddressText(resolved.lotAddress);
  const targetRoad=normalizeAddressText(resolved.roadAddress);
  const sameAddress=unique.filter(item=>{
    const lot=normalizeAddressText(item.lotAddress);
    const road=normalizeAddressText(item.roadAddress);
    return Boolean((targetLot && lot===targetLot) || (targetRoad && road===targetRoad));
  });
  return {
    state:sameAddress.length ? 'same_address_poi_observed' : unique.length ? 'nearby_poi_observed' : 'no_public_record',
    interpretation:sameAddress.length
      ? `Kakao Local에서 동일 주소 사업체/시설 ${sameAddress.length}건이 관측되지만 실제 점유·영업 지속 여부를 확정하지 않음`
      : unique.length
        ? '인근 사업체/시설 POI는 관측되지만 동일 주소 활동은 확인되지 않음'
        : 'Kakao Local 반경 검색에서 관련 POI가 관측되지 않음',
    sameAddress:sameAddress.slice(0,30),
    nearby:unique.slice(0,50)
  };
}
async function building(path, resolved, key) {
  const baseParams={
    serviceKey:key,sigunguCd:resolved.sigunguCd,bjdongCd:resolved.bjdongCd,
    platGbCd: resolved.mountainYn==='Y' ? '1':'0', bun:resolved.bun, ji:resolved.ji,
    numOfRows:'100',pageNo:'1'
  };
  const jsonParams=new URLSearchParams({...baseParams,_type:'json'});
  const jsonResponse=await fetchWithTimeout(`${BLD_BASE}/${path}?${jsonParams}`);
  if(jsonResponse.ok){
    try{
      const body=await jsonResponse.json();
      const rows=asArray(body?.response?.body?.items?.item);
      if(rows.length) return rows;
    }catch{}
  }
  const xmlResponse=await fetchWithTimeout(`${BLD_BASE}/${path}?${new URLSearchParams(baseParams)}`);
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
    rawPk:row.mgmBldrgstPk||'',
    // Classification inputs (Issue #37): register kind (일반/집합), detailed use text, dong name.
    registerKind:String(row.regstrKindCdNm||'').trim(),
    detailUse:String(row.etcPurps||'').trim(),
    dongName:String(row.dongNm||'').trim(),
    // A 0 in the register means "not recorded", not a measured zero (e.g. 방배동 765-32 platArea=0 while VWorld has 146.2㎡).
    unrecordedFields:[['landAreaSqm',landArea],['totalFloorAreaSqm',total],['buildingAreaSqm',build],['buildingCoverageRate',num(row.bcRat)],['floorAreaRatio',num(row.vlRat)]]
      .filter(([,value])=>!(value>0)).map(([key])=>key)
  };
}

/*
 * Property type from public records (Issue #37). Never guesses a unit (호실): several register titles on one lot are reported
 * as multipleBuildings so the UI can ask the user to choose. basis lists the evidence actually used; when the building
 * register has no title the result is 'unconfirmed' (not "no building").
 */
export const PROPERTY_TYPE_LABELS={
  land:'토지', apartment:'아파트', row_house:'연립·다세대', officetel:'오피스텔', detached:'단독·다가구',
  commercial_office:'상가·업무', factory_warehouse:'공장·창고', mixed:'복합(여러 건물)', unconfirmed:'미확인'
};
function typeFromTitle(title){
  const main=String(title?.mainUse||''), detail=String(title?.detailUse||''), kind=String(title?.registerKind||'');
  const text=`${main} ${detail}`;
  if(/오피스텔/.test(text)) return 'officetel';
  if(/아파트/.test(text)) return 'apartment';
  if(/연립|다세대/.test(text)) return 'row_house';
  if(/공동주택/.test(main)) return kind.includes('집합') && (title?.householdCount||0)>=20 ? 'apartment' : 'row_house';
  if(/단독주택|다가구|다중주택/.test(text)) return 'detached';
  if(/공장|창고/.test(text)) return 'factory_warehouse';
  if(/근린생활|업무|판매|숙박|의료|교육|문화|위락|노유자|운동/.test(main)) return 'commercial_office';
  return null;
}
export function classifyPropertyType({titles=[],landProfile=null}={}){
  const basis=[];
  const types=titles.map(typeFromTitle);
  if(titles.length){
    titles.forEach((title,index)=>basis.push(`건축물대장 표제부${titles.length>1?` ${index+1}`:''}: ${[title.mainUse,title.detailUse,title.registerKind].filter(Boolean).join(' · ')||'용도 미기재'}`));
    const distinct=[...new Set(types.filter(Boolean))];
    const multipleBuildings=titles.length>1;
    if(distinct.length===1) return { type:distinct[0], label:PROPERTY_TYPE_LABELS[distinct[0]], confidence:types.every(Boolean)?'register':'partial', basis, multipleBuildings };
    if(distinct.length>1) return { type:'mixed', label:PROPERTY_TYPE_LABELS.mixed, confidence:'register', basis, multipleBuildings:true, candidates:distinct };
    return { type:'unconfirmed', label:PROPERTY_TYPE_LABELS.unconfirmed, confidence:'none', basis:[...basis,'표제부 용도로 유형을 판정할 수 없음'], multipleBuildings };
  }
  basis.push('건축물대장 표제부 없음 — 건물 부재가 아니라 미확인');
  const situation=String(landProfile?.landUseSituation||''), category=String(landProfile?.landCategory||'');
  if(landProfile) basis.push(`VWorld 토지특성: 지목 ${category||'미기재'} · 이용상황 ${situation||'미기재'}`);
  // Land only when the parcel evidence itself says there is no building use; otherwise stay unconfirmed.
  if(/나지/.test(situation) || (category && !['대','공장용지','창고용지','주차장','주유소용지'].includes(category) && !/주거|상업|업무|공업/.test(situation))) {
    return { type:'land', label:PROPERTY_TYPE_LABELS.land, confidence:'parcel_evidence', basis, multipleBuildings:false };
  }
  return { type:'unconfirmed', label:PROPERTY_TYPE_LABELS.unconfirmed, confidence:'none', basis, multipleBuildings:false };
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
function parcelPnu(resolved){
  return `${resolved.bCode}${resolved.mountainYn==='Y'?'2':'1'}${resolved.bun}${resolved.ji}`;
}
function vworldDomain(){
  const raw=String(process.env.VWORLD_API_DOMAIN||process.env.VERCEL_PROJECT_PRODUCTION_URL||'localhost').trim();
  return raw.replace(/^https?:\/\//,'').split('/')[0]||'localhost';
}
function findFieldRows(value){
  if(!value || typeof value!=='object') return [];
  if(Array.isArray(value)) {
    for(const item of value){const rows=findFieldRows(item); if(rows.length) return rows;}
    return [];
  }
  if(Object.prototype.hasOwnProperty.call(value,'field')) return asArray(value.field).filter((item)=>item && typeof item==='object');
  for(const item of Object.values(value)){const rows=findFieldRows(item); if(rows.length) return rows;}
  return [];
}
async function vworldRows(path,resolved,key,{year}={}){
  const params=new URLSearchParams({
    key,
    domain:vworldDomain(),
    pnu:parcelPnu(resolved),
    format:'json',
    numOfRows:'1000',
    pageNo:'1'
  });
  if(year) params.set('stdrYear',String(year));
  const response=await fetchWithTimeout(`${VWORLD_BASE}/${path}?${params}`);
  if(!response.ok) throw new Error(`VWorld ${path} 요청 실패 (${response.status})`);
  const body=await response.json();
  return findFieldRows(body);
}
async function vworldLatestYearRows(path,resolved,key){
  const year=new Date().getFullYear();
  for(let offset=0;offset<4;offset+=1){
    const candidateYear=year-offset;
    const rows=await vworldRows(path,resolved,key,{year:candidateYear});
    if(rows.length) return {year:String(candidateYear),rows};
  }
  return {year:String(year),rows:[]};
}
function normalizeLandProfile(priceResult,characteristicResult,useRows,resolved){
  const price=priceResult.rows?.[0]||{};
  const characteristic=characteristicResult.rows?.[0]||{};
  const officialLandPricePerSqm=num(price.pblntfPclnd||price.pblntfPcInd||price.indvdLandPrice);
  const landAreaSqm=num(characteristic.lndpclAr||characteristic.ladAr||characteristic.area);
  const zones=useRows.map((row)=>String(
    row.prposAreaDstrcCodeNm||row.prposAreaDstrcNm||row.jijiguNm||row.zoneName||''
  ).trim()).filter(Boolean);
  return {
    pnu:parcelPnu(resolved),
    standardYear:String(price.stdrYear||priceResult.year||characteristic.stdrYear||characteristicResult.year||''),
    officialLandPricePerSqm,
    estimatedOfficialLandValue:officialLandPricePerSqm && landAreaSqm ? Math.round(officialLandPricePerSqm*landAreaSqm) : undefined,
    landAreaSqm,
    landCategory:String(characteristic.lndcgrCodeNm||characteristic.lndcgrNm||characteristic.jimokNm||''),
    landUseSituation:String(characteristic.ladUseSittnNm||characteristic.landUseSittnNm||''),
    terrainHeight:String(characteristic.tpgrphHgCodeNm||''),
    terrainShape:String(characteristic.tpgrphFrmCodeNm||''),
    roadSide:String(characteristic.roadSideCodeNm||''),
    primaryUseZone:String(characteristic.prposArea1Nm||characteristic.prposAreaDstrc1Nm||zones[0]||''),
    useZones:[...new Set(zones)],
    raw:{price,characteristic,useRows}
  };
}
async function vworldLandProfile(resolved,key){
  const [priceResult,characteristicResult,useRows]=await Promise.all([
    vworldLatestYearRows('getIndvdLandPriceAttr',resolved,key),
    vworldLatestYearRows('getLandCharacteristics',resolved,key),
    vworldRows('getLandUseAttr',resolved,key)
  ]);
  return normalizeLandProfile(priceResult,characteristicResult,useRows,resolved);
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
  const batches=await Promise.all(months.map(async (useYm)=>{
    try{
      const params=new URLSearchParams({
        serviceKey:key,sigunguCd:resolved.sigunguCd,bjdongCd:resolved.bjdongCd,
        bun:resolved.bun,ji:resolved.ji,useYm,numOfRows:'100',pageNo:'1'
      });
      const response=await fetchWithTimeout(`${ENERGY_BASE}/${path}?${params}`);
      if(!response.ok) return [];
      return xmlItems(await response.text()).map(item=>({...item,_useYm:useYm}));
    }catch{return [];}
  }));
  return batches.flat();
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
    const response=await fetchWithTimeout(`${SBIZ_RADIUS_URL}?${params}`);
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
  const batches=await Promise.all(months.map(async (ym)=>{
    try{
      const params=new URLSearchParams({serviceKey:key,LAWD_CD:lawdCd,DEAL_YMD:ym,numOfRows:'1000',pageNo:'1'});
      const res=await fetchWithTimeout(`${base}/${path}?${params}`);
      if(!res.ok) return [];
      return xmlItems(await res.text()).map(item=>({...item,_dealYmd:ym}));
    } catch { return []; }
  }));
  return batches.flat();
}
// MOLIT dealAmount is supplied in 만원 (10,000 KRW). Blank/whitespace/non-numeric upstream values stay missing (never 0 KRW).
const sourceDealAmount = (value) => String(value ?? '').replaceAll(',', '').trim() === '' ? undefined : num(value);
export function normalizeTrade(row,type,resolved){
  const sourceDealAmountTenThousandWon=sourceDealAmount(row.dealAmount||row.거래금액);
  const amount=sourceDealAmountTenThousandWon!=null ? sourceDealAmountTenThousandWon*10000 : undefined;
  const legalDong=String(row.umdNm||row.법정동||'').trim();
  const jibun=String(row.jibun||row.지번||'').trim();
  const buildingName=String(row.buildingName||row.건물명||'').trim();
  const buildingAreaSqm=num(row.buildingArea||row.buildingAr||row.excluUseAr||row.totalFloorAr||row.건물면적);
  // Commercial (상업업무용) rows carry the lot area as plottageAr; without it no land unit price can be compared.
  const landAreaSqm=num(row.landArea||row.landAr||row.dealArea||row.plottageAr||row.대지면적||row.거래면적);
  // Rows that must not feed price comparisons (2026-10-30 live diagnosis: 강남구 land candidates were all 1–8㎡ share
  // deals, giving a 20,000,000 KRW median; cancelled deals were included).
  const cancelled=String(row.cdealType||row.해제여부||'').trim()!=='';
  const shareDeal=/지분/.test(String(row.shareDealingType||row.지분거래구분||''));
  const buildingType=String(row.buildingType||row.건물유형||'').trim();
  const comparableExclusion=cancelled ? 'cancelled' : shareDeal ? 'share_deal' : type==='commercial' && buildingType==='집합' ? 'collective_unit' : undefined;
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
    buildingType,
    comparableExclusion,
    landPricePerPyeong: amount && landAreaSqm ? Math.round(amount / (landAreaSqm / 3.3058)) : undefined,
    pricePerSqm: amount && basisArea ? Math.round(amount / basisArea) : undefined,
    pricePerPyeong: amount && basisArea ? Math.round(amount / (basisArea / 3.3058)) : undefined,
    raw:row
  };
}
export function marketSummary(rows){
  const exact=rows.filter(row=>row.matchLevel==='exact_lot');
  // Medians use comparable rows only: cancelled deals, share (지분) deals and collective-building units (집합) describe a
  // different asset than a whole lot/building and distort the price level.
  const comparable=rows.filter(row=>!row.comparableExclusion);
  const sorted=(key)=>comparable.map(row=>row[key]).filter(value=>Number.isFinite(value)).sort((a,b)=>a-b);
  const median=(values)=>values.length ? values[Math.floor((values.length-1)/2)] : undefined;
  const excluded={cancelled:0,share_deal:0,collective_unit:0};
  for(const row of rows) if(row.comparableExclusion) excluded[row.comparableExclusion]=(excluded[row.comparableExclusion]||0)+1;
  return {
    totalCandidates: rows.length,
    comparableCount: comparable.length,
    excluded,
    exactLotCount: exact.length,
    latestDealDate: rows.map(row=>row.dealDate).filter(Boolean).sort().at(-1),
    medianDealAmount: median(sorted('dealAmount')),
    medianPricePerPyeong: median(sorted('pricePerPyeong')),
    medianLandPricePerPyeong: median(sorted('landPricePerPyeong'))
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
    const kakaoEvidence=await kakaoPoiEvidence(address);
    const key=normalizedServiceKey(process.env.DATA_GO_KR_SERVICE_KEY||'');
    const vworldKey=String(process.env.VWORLD_API_KEY||'').trim();
    const vworldResult=vworldKey
      ? await safeProvider('vworldLandProfile',()=>vworldLandProfile(address,vworldKey))
      : {label:'vworldLandProfile',ok:false,value:null,error:'VWORLD_API_KEY 미설정'};
    const landProfile=vworldResult.ok ? vworldResult.value : null;
    if(!key) return sendJson(response,200,{
      status:'partial',publicDataConfigured:false,vworldConfigured:Boolean(vworldKey),address,building:null,floors:[],
      landProfile,
      providerStatus:{vworldLandProfile:{ok:vworldResult.ok,error:vworldResult.error}},
      market:{commercial:[],land:[]},
      usageEvidence:{state:'not_configured',interpretation:'공공데이터포털 서비스키 등록 후 조회',positiveMonths:0,monthly:[]},
      operatingBusinessEvidence:{state:'not_configured',interpretation:'공공데이터포털 서비스키 등록 후 조회',sameAddress:[],nearby:[]},
      kakaoPoiEvidence:kakaoEvidence,
      sources:{address:'Kakao Local Address API',kakaoPoi:'Kakao Local Category Search',landProfile:'국토교통부 VWorld NED 토지정보'}
    },origin);

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
      titleResult,floorResult,zoneResult,commercialResult,landResult,electricityResult,gasResult,businessResult,vworldResult
    ].map(result=>[result.label,{ok:result.ok,error:result.error}]));
    const buildingTitle=titles[0] ? normalizeTitle(titles[0]) : null;
    const commercial=commercialRaw.map(r=>normalizeTrade(r,'commercial',address)).filter(r=>!r.legalDong || r.legalDong.includes(address.region3));
    const land=landRaw.map(r=>normalizeTrade(r,'land',address)).filter(r=>!r.legalDong || r.legalDong.includes(address.region3));
    const marketRows=[...commercial,...land].sort((a,b)=>b.dealDate.localeCompare(a.dealDate));
    const landUseZones=zones.map(normalizeZone).filter(zone=>zone.name);
    const usageEvidence=normalizeEnergy(electricityRaw,gasRaw,months);
    return sendJson(response,200,{
      status:Object.values(providerStatus).every((item)=>item.ok) ? 'ok' : 'partial',publicDataConfigured:true,vworldConfigured:Boolean(vworldKey),address,building:buildingTitle,providerStatus,landProfile,
      propertyType:titleResult.ok ? classifyPropertyType({titles:titles.map(normalizeTitle),landProfile}) : {type:'unconfirmed',label:PROPERTY_TYPE_LABELS.unconfirmed,confidence:'none',basis:['건축물대장 조회 실패 — 유형 미확인'],multipleBuildings:false},
      buildingCandidates:titles.map(normalizeTitle),floors:floors.map(normalizeFloor),landUseZones,
      market:{commercial:commercial.slice(0,40),land:land.slice(0,40),summary:marketSummary(marketRows),exactLot:marketRows.filter(row=>row.matchLevel==='exact_lot').slice(0,20)},
      usageEvidence,
      operatingBusinessEvidence:businessEvidence,
      kakaoPoiEvidence:kakaoEvidence,
      sources:{
        address:'Kakao Local Address API',
        building:'국토교통부 건축HUB 건축물대장정보',
        commercial:'국토교통부 상업업무용 부동산 매매 실거래가',
        land:'국토교통부 토지 매매 실거래가',
        energy:'국토교통부 건축HUB 건물에너지정보',
        operatingBusinesses:'소상공인시장진흥공단 상가(상권)정보',
        kakaoPoi:'Kakao Local Category Search',
        landProfile:'국토교통부 VWorld NED 토지정보'
      },
      collectedAt:new Date().toISOString()
    },origin);
  }catch(error){
    return fail(response,502,'DISCOVERY_FAILED',error instanceof Error?error.message:'부동산 공공데이터 조회에 실패했습니다.',origin);
  }
}
