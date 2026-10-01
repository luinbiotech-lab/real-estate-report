import { chromium } from 'playwright';

const BASE_URL=process.env.REPORT_QA_BASE_URL||'http://127.0.0.1:4174';
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const browserErrors=[];
page.on('pageerror',(error)=>browserErrors.push(`PAGEERROR: ${error.message}`));
page.on('console',(message)=>{ if(message.type()==='error') browserErrors.push(`CONSOLE: ${message.text()}`); });
try{
  await page.goto(BASE_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.body.innerText.includes('물건 · Data Room')||document.body.innerText.includes('플랫폼 초기화 실패'),undefined,{timeout:30000});
  const homeText=await page.locator('body').innerText();
  console.log('HOME_TEXT',homeText.slice(0,2000));
  console.log('BROWSER_ERRORS',JSON.stringify(browserErrors));
  assert(homeText.includes('물건 · Data Room'),'Property list did not render');
  assert(homeText.includes('데이터 유형'),'Sample data filter is missing');

  await page.goto(`${BASE_URL}/digital-twin/demo`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.body.innerText.includes('Digital Twin 3D 테스트 데모'),undefined,{timeout:30000});
  await page.waitForFunction(()=>document.body.innerText.includes('7개 TEST'),undefined,{timeout:30000});
  const text=await page.locator('body').innerText();
  assert(text.includes('3D Extrusion Preview'),'Extrusion preview is missing');
  assert(text.includes('Reviewed Mesh Viewer'),'Reviewed mesh viewer is missing');
  assert(!text.includes('3D 테스트 데모를 준비하지 못했습니다'),'Demo entered error state');

  const svgCount=await page.locator('svg').count();
  assert(svgCount>=3,`Expected at least 3 SVG visualizations, got ${svgCount}`);
  console.log('Sample management + 3D demo browser QA: PASS');
}finally{
  await browser.close();
}
