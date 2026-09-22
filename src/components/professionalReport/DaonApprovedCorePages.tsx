import type { ProfessionalReportViewModel } from '../../domain/professionalReport/types';
import { reportMediaCategoryAllowed } from '../../domain/professionalReport/reportAccessPolicy';

const split = (value: string, limit = 6) => value
  .split(/\r?\n|[•]/)
  .map((item) => item.trim())
  .filter(Boolean)
  .slice(0, limit);

const value = (item: { value: unknown; display: string }, fallback = '') =>
  item.value === null || item.value === '' ? fallback : item.display;

const mediaFor = (model: ProfessionalReportViewModel) =>
  model.media.items.filter((item) => item.url && reportMediaCategoryAllowed(item.category, model.media.internalPhotoAllowed));

function CoreHeader({ page, title, model }: { page: number; title: string; model: ProfessionalReportViewModel }) {
  return <header className="dc-head">
    <div className="dc-page-no">{String(page).padStart(2, '0')}</div>
    <div className="dc-head-title"><h1>{title}</h1><span>REAL ESTATE PROFESSIONAL REPORT</span></div>
    <div className="dc-head-brand"><strong>DAON</strong><small>도심의 가치를 잇는 전문적인 부동산 솔루션</small></div>
  </header>;
}

function CoreFooter() {
  return <footer className="dc-foot"><b>DAON</b><span>REAL ESTATE PROFESSIONAL REPORT</span><em>고객의 가치를 먼저 생각하는 든든한 파트너, 다온입니다.</em></footer>;
}

function SectionTitle({ children, note }: { children: string; note?: string }) {
  return <div className="dc-section-title"><b>{children}</b>{note && <span>{note}</span>}</div>;
}

function NumberItem({ index, title, copy }: { index: number; title: string; copy: string }) {
  return <article className="dc-number-item"><span>{index}</span><div><b>{title}</b><p>{copy}</p></div></article>;
}

export function DaonPropertySummaryMasterPage({ model }: { model: ProfessionalReportViewModel }) {
  const media = mediaFor(model);
  const hero = model.media.mainImage.value || media.find((item) => item.category === 'main' || item.category === 'exterior')?.url || null;
  const map = model.media.mapImage.value || null;
  const features = [...split(model.investment.features.value || '', 6), ...split(model.investment.investmentPoints.value || '', 6)].slice(0, 6);
  const facts = [
    ['매매가', value(model.pricing.salePrice)],
    ['토지 평당', value(model.pricing.landUnitPrice)],
    ['소재지', value(model.identity.address)],
    ['대지면적', value(model.land.landAreaPyeong)],
    ['연면적', value(model.building.totalFloorAreaPyeong)],
    ['용도지역', value(model.land.zoning)],
    ['도로', value(model.land.roadCondition)],
    ['규모', [model.building.basementFloors.value ? `지하 ${model.building.basementFloors.display}층` : '', model.building.groundFloors.value ? `지상 ${model.building.groundFloors.display}층` : ''].filter(Boolean).join(' / ')],
    ['교통', value(model.location.nearbyStation)],
    ['준공', value(model.building.completionDate)],
    ['건폐율 / 용적률', [value(model.building.buildingCoverageRate), value(model.building.floorAreaRatio)].filter(Boolean).join(' / ')],
    ['승강기 / 주차', [value(model.building.elevator), value(model.building.parkingOfficial)].filter(Boolean).join(' / ')],
  ].filter(([,v]) => Boolean(v));

  return <article className="daon-core-page dc-summary-page" data-master-page="property-summary">
    <div className="dc-summary-brand">
      <div className="dc-side-copy">좋은 자산이<br/>좋은 내일을<br/>만듭니다.<i /></div>
      <div className="dc-brand-center"><strong>DAON</strong><span>REAL ESTATE PROFESSIONAL REPORT</span><p>도심의 가치를 잇는 전문적인 부동산 솔루션</p></div>
      <div className="dc-trust">TRUST<br/>VALUE<br/>SOLUTION<small>당신의 더 큰 가치와<br/>함께합니다.</small></div>
    </div>
    <section className="dc-summary-hero">
      {hero ? <img src={hero} alt={`${model.identity.name.display} 외관`} /> : <div className="dc-photo-fallback" />}
      <div className="dc-summary-copy"><h2>도시의 중심,<br/>더 큰 가치를 만나다.</h2><i/><p>{value(model.investment.overallOpinion, value(model.location.locationAnalysis, '입지와 활용가치를 함께 검토하는 자산'))}</p></div>
    </section>
    <section className="dc-summary-title">
      <b>{value(model.identity.tradeType, '매매')}</b><div><h1>{value(model.identity.name)}</h1><p>{value(model.investment.investmentPoints, value(model.location.locationAnalysis))}</p></div>
    </section>
    <section className="dc-summary-grid">
      <div className="dc-fact-table">{facts.map(([label,v]) => <div key={label}><b>{label}</b><span>{v}</span></div>)}</div>
      <div className="dc-feature-list"><SectionTitle>주요 특징</SectionTitle>{(features.length ? features : [value(model.investment.overallOpinion)]).filter(Boolean).map((item,i)=><div className="dc-feature" key={i}><span>{String(i+1).padStart(2,'0')}</span><p>{item}</p></div>)}</div>
      <div className="dc-map-column"><SectionTitle>위치도</SectionTitle>{map ? <img src={map} alt="위치도"/> : null}<h3>입지가 만드는 프리미엄</h3><p>{value(model.location.locationAnalysis)}</p></div>
    </section>
    <section className="dc-summary-highlights"><SectionTitle note="INVESTMENT HIGHLIGHTS">투자 포인트</SectionTitle><div><article><b>위치의 가치</b><span>{value(model.land.roadCondition, value(model.location.nearbyStation))}</span></article><article><b>투자 가치 분석</b><span>{value(model.pricing.occupancyStatus, value(model.investment.recommendedUse))}</span></article><article><b>맞춤형 솔루션</b><span>{value(model.investment.developmentPlan, '개발 모멘텀과 활용전략을 함께 검토')}</span></article></div></section>
    <CoreFooter />
  </article>;
}

export function DaonInvestmentAnalysisMasterPage({ model }: { model: ProfessionalReportViewModel }) {
  const media = mediaFor(model);
  const hero = model.media.mainImage.value || media.find((item) => item.category === 'main' || item.category === 'exterior')?.url || null;
  const support = model.media.locationAnalysisImage.value || media.find((item) => item.url !== hero && (item.category === 'surroundings' || item.category === 'road'))?.url || null;
  const points = [...split(model.investment.investmentPoints.value || '',4), ...split(model.investment.features.value || '',4)].slice(0,4);
  const developments = split(model.investment.developmentPlan.value || '',4);
  const future = split(model.investment.recommendedUse.value || '',4);
  const risks = split(model.risks.risks.value || '',3);
  return <article className="daon-core-page dc-analysis-page" data-master-page="investment-analysis">
    <CoreHeader page={2} title="투자 분석 및 개발 호재" model={model}/>
    <div className="dc-property-line"><h2>{value(model.identity.name)}</h2><p>{value(model.investment.overallOpinion, value(model.location.locationAnalysis))}</p></div>
    <section className="dc-analysis-top">
      <div><SectionTitle note="가치 있는 오늘, 더 큰 내일을 만듭니다.">투자 포인트</SectionTitle>{points.map((p,i)=><NumberItem key={i} index={i+1} title={['입지 경쟁력','리포지셔닝 기회','브랜드 수요','중장기 가치'][i] || '핵심 가치'} copy={p}/>)}</div>
      <div className="dc-analysis-images">{hero && <img src={hero} alt="본건 외관"/>}{support && <img src={support} alt="주변 입지"/>}</div>
    </section>
    {developments.length > 0 && <section><SectionTitle note="도시의 변화가 만드는, 더 큰 가치의 시작입니다.">주요 개발 호재</SectionTitle><div className="dc-card-four">{developments.map((item,i)=><article key={i}><span>{i+1}</span><b>{['산업·업무 고도화','대규모 복합개발','정비·재개발','상권 구조 변화'][i] || '개발 모멘텀'}</b><p>{item}</p></article>)}</div></section>}
    {future.length > 0 && <section><SectionTitle note="변화하는 도시, 더 높은 가치를 봅니다.">미래가치 해석</SectionTitle><div className="dc-card-four compact">{future.map((item,i)=><article key={i}><b>{['현금흐름','브랜드 유동','임대 수요','장기 가치'][i] || '미래가치'}</b><p>{item}</p></article>)}</div></section>}
    {risks.length > 0 && <section><SectionTitle note="리스크를 미리 살피는 것이, 성공적인 투자의 시작입니다.">리스크 및 확인사항</SectionTitle><div className="dc-risk-three">{risks.map((item,i)=><article key={i}><span>{i+1}</span><p>{item}</p></article>)}</div></section>}
    <div className="dc-opinion"><b>종합 의견</b><p>{value(model.investment.overallOpinion)}</p></div>
    <CoreFooter/>
  </article>;
}

export function DaonDevelopmentDeepDiveMasterPage({ model }: { model: ProfessionalReportViewModel }) {
  const developments = split(model.investment.developmentPlan.value || '',8);
  if (!developments.length) return null;
  const top = developments.slice(0,4);
  const rest = developments.slice(4,8);
  const location = split(model.location.locationAnalysis.value || '',4);
  const points = split(model.investment.investmentPoints.value || '',3);
  return <article className="daon-core-page dc-development-page" data-master-page="development-deep-dive">
    <CoreHeader page={3} title="개발 호재 심화 분석" model={model}/>
    <div className="dc-property-line"><h2>{value(model.identity.name)}</h2><p>산업·업무·상권·보행·주거 변화가 자산가치에 전달되는 경로를 분석합니다.</p></div>
    <section><SectionTitle note="도시의 변화가 만드는, 더 큰 가치를 만납니다.">핵심 개발축</SectionTitle><div className="dc-development-list">{top.map((item,i)=><NumberItem key={i} index={i+1} title={['산업개발진흥지구','미래업무복합단지','정비·재개발','보행·교통·녹지축'][i]} copy={item}/>)}</div></section>
    {rest.length > 0 && <section><SectionTitle>추가 개발 모멘텀</SectionTitle><div className="dc-card-four">{rest.map((item,i)=><article key={i}><span>{i+1}</span><b>개발 모멘텀 {i+1}</b><p>{item}</p></article>)}</div></section>}
    {location.length > 0 && <section><SectionTitle note="변화하는 도시, 더 높은 가치를 봅니다.">미래가치 해석</SectionTitle><div className="dc-card-four compact">{location.map((item,i)=><article key={i}><b>{['브랜드 상권','업무·오피스','보행·교통·녹지','장기 자산가치'][i]}</b><p>{item}</p></article>)}</div></section>}
    {points.length > 0 && <section><SectionTitle note="리스크를 넘어, 더 큰 기회를 봅니다.">투자자 관점 정리</SectionTitle><div className="dc-risk-three">{points.map((item,i)=><article key={i}><span>{i+1}</span><p>{item}</p></article>)}</div></section>}
    <div className="dc-opinion"><b>종합 의견</b><p>{value(model.investment.overallOpinion)}</p></div>
    <CoreFooter/>
  </article>;
}
