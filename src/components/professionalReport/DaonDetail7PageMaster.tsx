import type { ReactNode } from 'react';
import type { ReportSnapshot } from '../../domain/propertyDataRoom/types';
import type { ProfessionalReportViewModel, ReportValue } from '../../domain/professionalReport/types';
import { DAON_DETAIL_MASTER_TEMPLATE_ID, DAON_DETAIL_MASTER_TEMPLATE_VERSION } from '../../domain/professionalReport/templateIds';

const splitLines = (value: ReportValue<string>, limit = 6) => (value.value || '')
  .split(/\r?\n|[•]/)
  .map((item) => item.trim())
  .filter(Boolean)
  .slice(0, limit);

const display = (item: ReportValue<unknown>, fallback = '확인 필요') => item.value === null || item.value === '' ? fallback : item.display;

function Page({ page, eyebrow, title, subtitle, snapshot, model, children }: {
  page: number;
  eyebrow: string;
  title: string;
  subtitle: string;
  snapshot: ReportSnapshot;
  model: ProfessionalReportViewModel;
  children: ReactNode;
}) {
  return <article className={`daon-detail-page daon-detail-page-${page}`}>
    <header className="dd-head">
      <div><small>{eyebrow}</small><h1>{title}</h1><p>{subtitle}</p></div>
      <div className="dd-brand"><strong>DA:ON</strong><span>ASSET</span><em>EXCLUSIVE SALE REPORT | {String(page).padStart(2, '0')}</em></div>
    </header>
    <main className="dd-body">{children}</main>
    <footer className="dd-foot">
      <span>DA:ON ASSET · {model.identity.managerName.value || '담당자 미등록'} · {model.identity.managerPhone.value || '연락처 미등록'} · {model.identity.managerEmail.value || '이메일 미등록'}</span>
      <span>Snapshot v{snapshot.reportVersion} · {new Date(snapshot.generatedAt).toLocaleDateString('ko-KR')}</span>
    </footer>
  </article>;
}

function SectionBar({ children, right }: { children: ReactNode; right?: string }) {
  return <div className="dd-section-bar"><b>{children}</b>{right && <span>{right}</span>}</div>;
}

function ImageSlot({ src, caption, className = '' }: { src?: string | null; caption: string; className?: string }) {
  return <figure className={`dd-image ${className}`}>
    {src ? <img src={src} alt={caption} /> : <div className="dd-image-empty"><b>IMAGE</b><span>데이터 미연결</span></div>}
    <figcaption>{caption}</figcaption>
  </figure>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="dd-info-row"><b>{label}</b><span>{value}</span></div>;
}

function NumberedPoint({ index, title, copy }: { index: number; title: string; copy: string }) {
  return <article className="dd-number-card"><span>{String(index).padStart(2, '0')}</span><div><b>{title}</b><p>{copy}</p></div></article>;
}

function GoldCard({ title, copy }: { title: string; copy: string }) {
  return <article className="dd-gold-card"><span>●</span><div><b>{title}</b><p>{copy}</p></div></article>;
}

export function DaonDetail7PageMaster({ snapshot, model }: { snapshot: ReportSnapshot; model: ProfessionalReportViewModel }) {
  const visibleMedia = model.media.items.filter((item) => item.url && (model.media.internalPhotoAllowed || item.category !== 'interior'));
  const hero = model.media.mainImage.value || visibleMedia.find((item) => item.category === 'main' || item.category === 'exterior')?.url || null;
  const map = model.media.mapImage.value || null;
  const supporting = visibleMedia.filter((item) => item.url !== hero && item.category !== 'map').map((item) => item.url as string);
  const imageAt = (index: number) => supporting[index] || hero;
  const points = [...splitLines(model.investment.investmentPoints, 8), ...splitLines(model.investment.features, 8)].filter(Boolean).slice(0, 6);
  const scenarios = splitLines(model.investment.recommendedUse, 3);
  const risks = splitLines(model.risks.risks, 6);
  const isCorner = String(model.land.roadCondition.value || '').includes('코너');
  const heroStatement = points[0] || (isCorner ? '코너 입지와 활용가치를 함께 검토하는 자산' : '입지와 활용가치를 함께 검토하는 자산');

  const facts: Array<[string, string]> = [
    ['소재지', `${display(model.identity.address)}${model.identity.detailAddress.value ? ` ${model.identity.detailAddress.display}` : ''}`],
    ['토지면적', `${display(model.land.landAreaSqm)} / ${display(model.land.landAreaPyeong)}`],
    ['연면적', `${display(model.building.totalFloorAreaSqm)} / ${display(model.building.totalFloorAreaPyeong)}`],
    ['건축면적', display(model.building.buildingAreaPyeong)],
    ['구조', display(model.building.structure)],
    ['규모', `지하 ${display(model.building.basementFloors)} / 지상 ${display(model.building.groundFloors)}`],
    ['주용도', display(model.building.mainUse)],
    ['용도지역', display(model.land.zoning)],
    ['사용승인', display(model.building.completionDate)],
  ];

  return <div className="daon-detail-master" data-template-id={DAON_DETAIL_MASTER_TEMPLATE_ID} data-template-version={DAON_DETAIL_MASTER_TEMPLATE_VERSION}>
    <Page page={1} eyebrow="WHY THIS ASSET" title={model.identity.name.display} subtitle="매입 관점에서 보는 핵심 제안" snapshot={snapshot} model={model}>
      <div className="dd-p1-top">
        <div className="dd-p1-hero"><ImageSlot src={hero} caption="대표 외관" /><div className="dd-hero-copy"><b>{heroStatement}</b><span>실사용 + 리포지셔닝 + 장기 가치</span></div></div>
        <div className="dd-p1-side">
          <section className="dd-price-card"><small>희망매매가</small><strong>{display(model.pricing.salePrice)}</strong><span>{model.identity.address.display}</span></section>
          <NumberedPoint index={1} title="즉시 활용성" copy={display(model.pricing.occupancyStatus, '명도·사용 조건 확인 필요')} />
          <NumberedPoint index={2} title={isCorner ? '코너 대지의 존재감' : '도로·접근 조건'} copy={display(model.land.roadCondition, '도로·접근 조건 현장 확인 필요')} />
        </div>
      </div>
      <SectionBar right="KEY INVESTMENT POINTS">매입 검토 포인트</SectionBar>
      <div className="dd-key-list">{(points.length ? points : ['생활권 및 배후수요 확인 필요', '현재 활용성 확인 필요', '확장성 검토 필요', '장기 보유가치 검토 필요']).slice(0, 4).map((point, i) => <div key={i}><span>{i + 1}</span><b>{['생활권','사용성','확장성','장기성'][i] || '핵심'}</b><p>{point}</p></div>)}</div>
      <div className="dd-insight"><b>매입의 핵심은 “건물” 하나가 아니라 선택지입니다.</b><p>{display(model.investment.overallOpinion, '현재 활용, 리포지셔닝, 장기 보유가치를 함께 검토할 수 있도록 자료를 확정합니다.')}</p></div>
    </Page>

    <Page page={2} eyebrow="PROPERTY PROFILE" title="PROPERTY PROFILE" subtitle="공적자료와 현장 이용을 함께 보는 자산 구성" snapshot={snapshot} model={model}>
      <SectionBar>자산 개요</SectionBar>
      <div className="dd-profile-grid"><ImageSlot src={hero} caption="본건 외관" /><div className="dd-info-table">{facts.map(([label, value]) => <InfoRow key={label} label={label} value={value} />)}</div></div>
      <SectionBar>층별 구성과 현재 활용</SectionBar>
      <div className="dd-floor-placeholder"><b>층별 임대·이용 현황</b><span>Property Data Room의 층별 데이터 완전 매핑 단계에서 확정값을 주입합니다.</span></div>
      <SectionBar>공간에서 보이는 가능성</SectionBar>
      <div className="dd-photo-three"><ImageSlot src={imageAt(0)} caption="인접 주거환경" /><ImageSlot src={imageAt(1)} caption="생활권·주변 상권" /><ImageSlot src={imageAt(2)} caption="주변 상업·업무 환경" /></div>
      <div className="dd-insight compact"><b>현재 활용을 존중하면서 다음 용도를 설계할 수 있습니다.</b><p>{display(model.investment.recommendedUse, '사옥, 주거, 업무, 복합공간 등 활용 방향은 인허가 및 현장검토 후 확정합니다.')}</p></div>
    </Page>

    <Page page={3} eyebrow="LOCATION LEVERAGE" title="LOCATION LEVERAGE" subtitle="입지와 생활권 수요를 매입 가치로 연결하는 방법" snapshot={snapshot} model={model}>
      <SectionBar right="LOCATION MAP">입지의 핵심 구조</SectionBar>
      <div className="dd-location-grid"><div className="dd-map-wrap"><ImageSlot src={map} caption="입지 지도" className="map" /></div><div className="dd-location-cards"><GoldCard title={isCorner ? '보이는 코너' : '도로 접근성'} copy={display(model.land.roadCondition, '도로·접근·출입 동선 확인 필요')} /><GoldCard title="생활권 안의 목적형 자산" copy={display(model.location.locationAnalysis, '생활·상권·배후수요 분석 데이터 확인 필요')} /><GoldCard title="실사용 매수자에게 맞는 규모" copy={`${display(model.land.landAreaPyeong)} 토지 규모와 기존 건물 활용성을 함께 검토합니다.`} /></div></div>
      <div className="dd-photo-three"><ImageSlot src={imageAt(0)} caption="인접 주거환경" /><ImageSlot src={imageAt(1)} caption="생활권과 다양한 상권" /><ImageSlot src={imageAt(2)} caption={isCorner ? '가시성 높은 코너 입지' : '주변 도로·접근 환경'} /></div>
      <SectionBar right="KEY POINTS">매수자 관점에서 읽는 입지</SectionBar>
      <div className="dd-key-list three">{['사옥','F&B / 브랜드','문화 / 콘텐츠'].map((title, i) => <div key={title}><span>{i + 1}</span><b>{title}</b><p>{points[i] || '확인된 입지·수요 데이터 기반으로 활용성을 검토합니다.'}</p></div>)}</div>
      <div className="dd-insight compact"><b>입지는 “유동인구 숫자”보다 어떤 매수자가 이 공간을 필요로 하는지를 보여줘야 합니다.</b><p>{display(model.location.locationAnalysis)}</p></div>
    </Page>

    <Page page={4} eyebrow="MARKET POSITION" title="MARKET POSITION & PRICE RATIONALE" subtitle="실거래 사례 속에서 본건의 토지 평당을 읽는 방법" snapshot={snapshot} model={model}>
      <SectionBar>가격 포지션</SectionBar>
      <div className="dd-price-position"><div><small>본건 토지 평당</small><strong>{display(model.pricing.landUnitPrice)}</strong></div><div><b>가격을 설득하는 핵심은 “평균보다 싸다”가 아닙니다.</b><p>도로조건, 명도·실사용 가능성, 기존 건물의 활용성과 같은 개별 조건을 확인된 비교사례와 함께 설명합니다.</p></div></div>
      <SectionBar right="단위: 입력자료 기준">비교 사례</SectionBar>
      <div className="dd-comparables">{model.investment.nearbyTransactions.value ? <p>{model.investment.nearbyTransactions.display}</p> : <div><b>비교 거래 데이터 미연결</b><span>검증된 거래자료 연결 후 표와 가격포지션을 확정합니다.</span></div>}</div>
      <div className="dd-analysis-box"><b>해석</b><p>{display(model.investment.overallOpinion, '단순 평균으로 적정가격을 확정하지 않고, 입지·규모·도로조건·건물상태를 함께 검토합니다.')}</p></div>
      <SectionBar>가격을 매입 논리로 바꾸는 세 가지 포인트</SectionBar>
      <div className="dd-reason-three"><GoldCard title="총액과 규모의 균형" copy={`${display(model.land.landAreaPyeong)} 토지와 기존 건물을 함께 확보하는 구조를 검토합니다.`} /><GoldCard title="입지 프리미엄의 근거" copy={display(model.land.roadCondition)} /><GoldCard title="리스크의 투명성" copy={risks[0] || '공적자료·현장·권리관계를 확인해 가격 리스크를 투명하게 제시합니다.'} /></div>
    </Page>

    <Page page={5} eyebrow="VALUE CREATION SCENARIOS" title="VALUE CREATION SCENARIOS" subtitle="매입 후 바로 실행할 수 있는 세 가지 방향" snapshot={snapshot} model={model}>
      <SectionBar right="VALUE CREATION ROADMAP">가치 확장 로드맵</SectionBar>
      <div className="dd-roadmap"><NumberedPoint index={1} title="즉시 사용" copy={display(model.pricing.occupancyStatus)} /><NumberedPoint index={2} title="리포지셔닝" copy={display(model.investment.features, '파사드·동선·공간 재구성 검토')} /><NumberedPoint index={3} title="중장기 검토" copy={display(model.investment.developmentPlan, '리노베이션 또는 신축 여부 검토')} /></div>
      <SectionBar right="USE CASE SCENARIOS">활용 시나리오</SectionBar>
      <div className="dd-scenarios">{['OWNER-OCCUPIED HQ','F&B / FLAGSHIP','GALLERY / CULTURE'].map((title, i) => <article key={title}><ImageSlot src={imageAt(i)} caption={title} /><h3>{title}</h3><p>{scenarios[i] || '활용 시나리오 데이터 확인 필요'}</p></article>)}</div>
      <div className="dd-insight"><b>이 자산의 강점은 하나의 “정답 용도”가 아니라 매수자에 따라 달라지는 실행 옵션입니다.</b><p>{display(model.investment.recommendedUse)}</p></div>
    </Page>

    <Page page={6} eyebrow="BUILDING & DEVELOPMENT REVIEW" title="BUILDING & DEVELOPMENT REVIEW" subtitle="기존 건물의 활용성과 중장기 개발 검토 포인트" snapshot={snapshot} model={model}>
      <SectionBar>현황 건물에서 읽는 실사용 가치</SectionBar>
      <div className="dd-photo-three"><ImageSlot src={imageAt(0)} caption="본건 및 주변 건물 전경" /><ImageSlot src={imageAt(1)} caption="주변 랜드마크·배후수요" /><ImageSlot src={imageAt(2)} caption="주변 도로·생활권 전경" /></div>
      <SectionBar>건물 지표</SectionBar>
      <div className="dd-metrics"><div><span>●</span><small>건폐율</small><strong>{display(model.building.buildingCoverageRate)}</strong></div><div><span>●</span><small>용적률</small><strong>{display(model.building.floorAreaRatio)}</strong></div><div><span>●</span><small>사용승인</small><strong>{display(model.building.completionDate)}</strong></div></div>
      <SectionBar>매입 후 의사결정 포인트</SectionBar>
      <div className="dd-reason-three"><GoldCard title="기존 건물 유지" copy="초기 투자비를 통제하면서 사옥·업무·콘텐츠 공간으로 활용하는 전략을 검토합니다." /><GoldCard title="리노베이션" copy="외관과 동선, 설비, 층별 기능 재배치를 검토합니다." /><GoldCard title="신축 검토" copy={display(model.investment.developmentPlan, '용도지역·도로·주차·일조·높이·건축선 등을 사전 검토합니다.')} /></div>
      <div className="dd-insight compact"><b>기존 건물의 연식은 약점이 아니라 “의사결정의 출발점”으로 설명해야 합니다.</b><p>현재 사용 가능한 공간을 확보하면서 향후 리노베이션 또는 신축 여부를 선택할 수 있는 구조인지 확인합니다.</p></div>
    </Page>

    <Page page={7} eyebrow="TRANSACTION READINESS" title="TRANSACTION READINESS" subtitle="권리·공적자료·인허가 체크와 매입 결론" snapshot={snapshot} model={model}>
      <SectionBar>거래 전 확인해야 할 핵심</SectionBar>
      <div className="dd-dd-grid"><GoldCard title="토지이용" copy={`${display(model.land.zoning)} · ${display(model.land.roadCondition)}`} /><GoldCard title="건축물대장" copy={`연면적 ${display(model.building.totalFloorAreaSqm)}, 건축면적 ${display(model.building.buildingAreaPyeong)}, ${display(model.building.mainUse)}`} /><GoldCard title="권리관계" copy={risks[0] || '등기·권리관계 최신 자료 재확인 필요'} /><GoldCard title="명도·인도" copy={display(model.pricing.occupancyStatus)} /></div>
      <SectionBar>매수자 체크리스트</SectionBar>
      <ol className="dd-checklist"><li>최신 토지·건물 등기사항전부증명서 재발급</li><li>토지거래허가구역 적용 여부 및 매수인 요건 확인</li><li>대지 경계·접도 폭·현황도로·건축선 확인</li><li>주차·일조·높이·피난·내진 등 신축/대수선 사전검토</li><li>누수·균열·설비·전기용량·배수 등 현장실사</li><li>잔금일 기준 명도 및 인도 범위 계약서 명문화</li></ol>
      <div className="dd-acquisition"><b>ACQUISITION CASE</b><p>{display(model.investment.overallOpinion, '확인된 토지·건물·입지·명도·권리 정보를 종합해 매입 판단 근거를 확정합니다.')}</p></div>
    </Page>
  </div>;
}
