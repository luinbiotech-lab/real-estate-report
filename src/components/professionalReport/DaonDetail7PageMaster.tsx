import { detailPagePlan, equalColumns, type DetailPageId } from '../../domain/professionalReport/reportLayoutFill';
import type { ReactNode } from 'react';
import type { ReportSnapshot } from '../../domain/propertyDataRoom/types';
import type { ProfessionalReportViewModel, ReportValue } from '../../domain/professionalReport/types';
import { reportMediaCategoryAllowed } from '../../domain/professionalReport/reportAccessPolicy';
import { DAON_DETAIL_MASTER_TEMPLATE_ID, DAON_DETAIL_MASTER_TEMPLATE_VERSION } from '../../domain/professionalReport/templateIds';

const splitLines = (value: ReportValue<string>, limit = 6) => (value.value || '')
  .split(/\r?\n|[•]/)
  .map((item) => item.trim())
  .filter(Boolean)
  .slice(0, limit);

// Blank-value policy (owner decision 2026-10-30): a missing value renders as '' and its row/card/line is omitted; the
// MASTER never prints a '확인 필요' placeholder. Users are asked about blank fields before publishing (reportBlankFields).
const display = (item: ReportValue<unknown>, fallback = '') => item.value === null || item.value === undefined || item.value === '' ? fallback : item.display;
/** Joins only the present parts, so a half-filled pair never prints a dangling separator. */
const joinPresent = (separator: string, ...parts: string[]) => parts.filter((part) => part && part.trim()).join(separator);
const formatFloorArea = (value: number | null) => value === null ? '-' : `${value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}㎡`;
const formatCompactWon = (value: number) => {
  if (!Number.isFinite(value)) return '-';
  if (value >= 100000000) {
    const eok = value / 100000000;
    return `${eok.toLocaleString('ko-KR', { maximumFractionDigits: eok % 1 ? 1 : 0 })}억`;
  }
  if (value >= 10000) return `${Math.round(value / 10000).toLocaleString('ko-KR')}만`;
  return value.toLocaleString('ko-KR');
};

function Page({ page, number, eyebrow, title, subtitle, snapshot, model, children }: {
  page: number;
  /** Printed page number after omitted pages are removed (owner decision 2026-10-31). */
  number: number;
  eyebrow: string;
  title: string;
  subtitle: string;
  snapshot: ReportSnapshot;
  model: ProfessionalReportViewModel;
  children: ReactNode;
}) {
  return <article className={`daon-detail-page daon-detail-page-${page}`} data-detail-page={page}>
    <header className="dd-head">
      <div><small>{eyebrow}</small><h1>{title}</h1><p>{subtitle}</p></div>
      <div className="dd-brand"><strong>DA:ON</strong><span>ASSET</span><em>EXCLUSIVE SALE REPORT | {String(number).padStart(2, '0')}</em></div>
    </header>
    <main className="dd-body">{children}</main>
    <footer className="dd-foot">
      <span>{joinPresent(' · ', 'DA:ON ASSET', model.identity.managerName.value || '', model.identity.managerPhone.value || '', model.identity.managerEmail.value || '')}</span>
      <span>Snapshot v{snapshot.reportVersion} · {new Date(snapshot.generatedAt).toLocaleDateString('ko-KR')}</span>
    </footer>
  </article>;
}

function SectionBar({ children, right }: { children: ReactNode; right?: string }) {
  return <div className="dd-section-bar"><b>{children}</b>{right && <span>{right}</span>}</div>;
}

function ImageSlot({ src, caption, className = '' }: { src?: string | null; caption: string; className?: string }) {
  if (!src) return null;
  return <figure className={`dd-image ${className}`}>
    <img src={src} alt={caption} />
    <figcaption>{caption}</figcaption>
  </figure>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return <div className="dd-info-row"><b>{label}</b><span>{value}</span></div>;
}

function NumberedPoint({ index, title, copy }: { index: number; title: string; copy: string }) {
  if (!copy) return null;
  return <article className="dd-number-card"><span>{String(index).padStart(2, '0')}</span><div><b>{title}</b><p>{copy}</p></div></article>;
}

function GoldCard({ title, copy, wide = false }: { title: string; copy: string; wide?: boolean }) {
  if (!copy) return null;
  return <article className="dd-gold-card" style={wide ? { gridColumn: '1 / -1' } : undefined}><span>●</span><div><b>{title}</b><p>{copy}</p></div></article>;
}

export function DaonDetail7PageMaster({ snapshot, model }: { snapshot: ReportSnapshot; model: ProfessionalReportViewModel }) {
  const visibleMedia = model.media.items.filter((item) => item.url && reportMediaCategoryAllowed(item.category, model.media.internalPhotoAllowed));
  const hero = (model.media.internalPhotoAllowed ? model.media.mainImage.value : null)
    || visibleMedia.find((item) => item.category === 'main' || item.category === 'exterior')?.url || null;
  const map = model.media.mapImage.value || null;
  const supporting = visibleMedia.filter((item) => item.url !== hero && item.category !== 'map').map((item) => item.url as string);
  const imageAt = (index: number) => supporting[index] || hero;
  const points = [...splitLines(model.investment.investmentPoints, 8), ...splitLines(model.investment.features, 8)].filter(Boolean).slice(0, 6);
  const scenarios = splitLines(model.investment.recommendedUse, 3);
  const risks = splitLines(model.risks.risks, 6);
  const comparables = model.investment.comparables ?? [];
  const isCorner = String(model.land.roadCondition.value || '').includes('코너');
  const heroStatement = points[0] || (isCorner ? '코너 입지와 활용가치를 함께 검토하는 자산' : '입지와 활용가치를 함께 검토하는 자산');
  const parkingOfficial = display(model.building.parkingOfficial);
  const parkingField = display(model.building.parkingField);
  const parkingFieldNote = model.building.parkingFieldNote.value ? ` · ${model.building.parkingFieldNote.display}` : '';

  const facts: Array<[string, string]> = [
    ['소재지', `${display(model.identity.address)}${model.identity.detailAddress.value ? ` ${model.identity.detailAddress.display}` : ''}`],
    ['토지면적', joinPresent(' / ', display(model.land.landAreaSqm), display(model.land.landAreaPyeong))],
    ['연면적', joinPresent(' / ', display(model.building.totalFloorAreaSqm), display(model.building.totalFloorAreaPyeong))],
    ['건축면적', display(model.building.buildingAreaPyeong)],
    ['구조 / 규모', joinPresent(' · ', display(model.building.structure), joinPresent(' / ', display(model.building.basementFloors) && `지하 ${display(model.building.basementFloors)}`, display(model.building.groundFloors) && `지상 ${display(model.building.groundFloors)}`))],
    ['주용도', display(model.building.mainUse)],
    ['용도지역', display(model.land.zoning)],
    ['사용승인', display(model.building.completionDate)],
    ['공부상 주차', parkingOfficial],
  ];
  const visibleFacts = facts.filter(([, value]) => value && value.trim());
  // Mixed blank policy (owner decision 2026-10-31): optional pages without enough real content are omitted and the rest
  // renumbered; inside a page, present cards move forward and the row is re-divided so no empty slot remains.
  const plan = detailPagePlan(model, Boolean(map), comparables.length);
  const pageNumber = (id: DetailPageId) => plan.pages.find((entry) => entry.id === id)?.number ?? 0;
  const shows = (id: DetailPageId) => pageNumber(id) > 0;
  const has = (value: string) => Boolean(value && value.trim());
  const p1SideCount = [display(model.pricing.occupancyStatus), display(model.land.roadCondition)].filter(has).length;
  const p4ReasonCount = 2 + (has(display(model.land.roadCondition)) ? 1 : 0);
  const p5RoadmapCount = 2 + (has(display(model.pricing.occupancyStatus)) ? 1 : 0);
  const metrics = ([['건폐율', display(model.building.buildingCoverageRate)], ['용적률', display(model.building.floorAreaRatio)], ['사용승인', display(model.building.completionDate)]] as Array<[string, string]>).filter(([, value]) => has(value));
  const p3CardCount = [display(model.land.roadCondition), display(model.location.locationAnalysis)].filter(has).length + 1;
  const occupancyParking = joinPresent(' · ', display(model.pricing.occupancyStatus), parkingField && `현장 주차 ${parkingField}${parkingFieldNote}`);

  return <div className="daon-detail-master" data-template-id={DAON_DETAIL_MASTER_TEMPLATE_ID} data-template-version={DAON_DETAIL_MASTER_TEMPLATE_VERSION}>
    <Page page={1} number={pageNumber(1)} eyebrow="WHY THIS ASSET" title={model.identity.name.display} subtitle="매입 관점에서 보는 핵심 제안" snapshot={snapshot} model={model}>
      <div className="dd-p1-top">
        <div className="dd-p1-hero"><ImageSlot src={hero} caption="대표 외관" /><div className="dd-hero-copy"><b>{heroStatement}</b><span>실사용 + 리포지셔닝 + 장기 가치</span></div></div>
        <div className="dd-p1-side" style={{ gridTemplateRows: p1SideCount ? `34mm ${equalColumns(p1SideCount)}` : '34mm' }}>
          <section className="dd-price-card"><small>희망매매가</small><strong>{display(model.pricing.salePrice)}</strong><span>{model.identity.address.display}</span></section>
          <NumberedPoint index={1} title="즉시 활용성" copy={display(model.pricing.occupancyStatus)} />
          <NumberedPoint index={2} title={isCorner ? '코너 대지의 존재감' : '도로·접근 조건'} copy={display(model.land.roadCondition)} />
        </div>
      </div>
      {points.length > 0 && <SectionBar right="KEY INVESTMENT POINTS">매입 검토 포인트</SectionBar>}
      {points.length > 0 && <div className="dd-key-list">{points.slice(0, 4).map((point, i) => <div key={i}><span>{i + 1}</span><b>{['생활권','사용성','확장성','장기성'][i] || '핵심'}</b><p>{point}</p></div>)}</div>}
      <div className="dd-insight"><b>매입의 핵심은 “건물” 하나가 아니라 선택지입니다.</b><p>{display(model.investment.overallOpinion, '현재 활용, 리포지셔닝, 장기 보유가치를 함께 검토할 수 있도록 자료를 확정합니다.')}</p></div>
    </Page>

    <Page page={2} number={pageNumber(2)} eyebrow="PROPERTY PROFILE" title="물건 개요 및 층별 구성" subtitle="공적자료와 현장 이용을 함께 보는 자산 구성" snapshot={snapshot} model={model}>
      <SectionBar>자산 개요</SectionBar>
      <div className="dd-profile-grid"><ImageSlot src={hero} caption="본건 외관" /><div className="dd-info-table">{visibleFacts.map(([label, value]) => <InfoRow key={label} label={label} value={value} />)}</div></div>
      {model.building.floors.length > 0 && <>
        <SectionBar>층별 구성과 현재 활용</SectionBar>
        <div className="dd-floor-placeholder" style={{ display: 'grid', placeItems: 'stretch', alignContent: 'stretch', gap: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '12mm 1fr 25mm 1.05fr', alignItems: 'center', background: '#f1f5f8', borderBottom: '0.25mm solid #d8dee5', padding: '0 2.5mm', fontSize: '6.7px', fontWeight: 800 }}><span>층</span><span>공적대장 용도</span><span>면적</span><span>현재 이용 / 비고</span></div>
          {model.building.floors.slice(0, 4).map((floor) => <div key={floor.id} style={{ display: 'grid', gridTemplateColumns: '12mm 1fr 25mm 1.05fr', alignItems: 'center', borderBottom: '0.2mm solid #e2e6eb', padding: '0 2.5mm', minHeight: 0, fontSize: '6.8px', overflow: 'hidden' }}><b style={{ fontSize: '7.2px' }}>{floor.floor}</b><span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{floor.name}</span><span>{formatFloorArea(floor.areaSqm)}</span><span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#6d7a88' }}>{floor.currentCondition || '-'}</span></div>)}
        </div>
      </>}
      <SectionBar>공간에서 보이는 가능성</SectionBar>
      <div className="dd-photo-three"><ImageSlot src={imageAt(0)} caption="인접 주거환경" /><ImageSlot src={imageAt(1)} caption="생활권·주변 상권" /><ImageSlot src={imageAt(2)} caption="주변 상업·업무 환경" /></div>
      <div className="dd-insight compact"><b>현재 활용을 존중하면서 다음 용도를 설계할 수 있습니다.</b><p>{display(model.investment.recommendedUse, '사옥, 주거, 업무, 복합공간 등 활용 방향은 인허가 및 현장검토 후 확정합니다.')}</p></div>
    </Page>

    {shows(3) && <Page page={3} number={pageNumber(3)} eyebrow="LOCATION LEVERAGE" title="입지 분석" subtitle="입지와 생활권 수요를 매입 가치로 연결하는 방법" snapshot={snapshot} model={model}>
      <SectionBar right="LOCATION MAP">입지의 핵심 구조</SectionBar>
      <div className="dd-location-grid"><div className="dd-map-wrap"><ImageSlot src={map} caption="입지 지도" className="map" /></div><div className="dd-location-cards" style={{ gridTemplateRows: equalColumns(p3CardCount) }}><GoldCard title={isCorner ? '보이는 코너' : '도로 접근성'} copy={display(model.land.roadCondition)} /><GoldCard title="생활권 안의 목적형 자산" copy={display(model.location.locationAnalysis)} /><GoldCard title="실사용 매수자에게 맞는 규모" copy={joinPresent(' ', display(model.land.landAreaPyeong), '토지 규모와 기존 건물 활용성을 함께 검토합니다.')} /></div></div>
      <div className="dd-photo-three"><ImageSlot src={imageAt(0)} caption="인접 주거환경" /><ImageSlot src={imageAt(1)} caption="생활권과 다양한 상권" /><ImageSlot src={imageAt(2)} caption={isCorner ? '가시성 높은 코너 입지' : '주변 도로·접근 환경'} /></div>
      <SectionBar right="KEY POINTS">매수자 관점에서 읽는 입지</SectionBar>
      <div className="dd-key-list three">{['사옥','F&B / 브랜드','문화 / 콘텐츠'].map((title, i) => <div key={title}><span>{i + 1}</span><b>{title}</b><p>{points[i] || '확인된 입지·수요 데이터 기반으로 활용성을 검토합니다.'}</p></div>)}</div>
      <div className="dd-insight compact"><b>입지는 “유동인구 숫자”보다 어떤 매수자가 이 공간을 필요로 하는지를 보여줘야 합니다.</b>{display(model.location.locationAnalysis) && <p>{display(model.location.locationAnalysis)}</p>}</div>
    </Page>}

    {shows(4) && <Page page={4} number={pageNumber(4)} eyebrow="MARKET POSITION" title="주변 시세 및 비교거래 사례" subtitle="실거래 사례 속에서 본건의 토지 평당을 읽는 방법" snapshot={snapshot} model={model}>
      <SectionBar>가격 포지션</SectionBar>
      <div className="dd-price-position"><div><small>본건 토지 평당</small><strong>{display(model.pricing.landUnitPrice)}</strong></div><div><b>가격을 설득하는 핵심은 “평균보다 싸다”가 아닙니다.</b><p>도로조건, 명도·실사용 가능성, 기존 건물의 활용성과 같은 개별 조건을 확인된 비교사례와 함께 설명합니다.</p></div></div>
      {(comparables.length > 0 || model.investment.nearbyTransactions.value) && <>
        <SectionBar right="단위: 입력자료 기준">비교 사례</SectionBar>
        <div className="dd-comparables">{comparables.length ? <div style={{ display: 'grid', height: '100%', gridTemplateRows: '8mm repeat(6, minmax(0, 1fr))' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.25fr .7fr .65fr .72fr .5fr .72fr', alignItems: 'center', background: '#f1f5f8', borderBottom: '0.25mm solid #d8dee5', padding: '0 2mm', fontSize: '6.5px', fontWeight: 800 }}><span>사례</span><span>거래가</span><span>대지</span><span>토지평당</span><span>승인</span><span>거래일</span></div>
          {comparables.slice(0, 6).map((row) => <div key={`${row.sourceId}:${row.label}:${row.tradeDate}`} style={{ display: 'grid', gridTemplateColumns: '1.25fr .7fr .65fr .72fr .5fr .72fr', alignItems: 'center', borderBottom: '0.2mm solid #e2e6eb', padding: '0 2mm', fontSize: '6.7px', overflow: 'hidden' }}><b style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.label}</b><span>{formatCompactWon(row.salePrice)}</span><span>{row.landAreaPyeong.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}평</span><span>{formatCompactWon(row.landUnitPrice)}</span><span>{row.approvalYear || '-'}</span><span>{row.tradeDate}</span></div>)}
        </div> : <p>{model.investment.nearbyTransactions.display}</p>}</div>
      </>}
      <div className="dd-analysis-box"><b>해석</b><p>{display(model.investment.overallOpinion, '단순 평균으로 적정가격을 확정하지 않고, 입지·규모·도로조건·건물상태를 함께 검토합니다.')}</p></div>
      <SectionBar>가격을 매입 논리로 바꾸는 세 가지 포인트</SectionBar>
      <div className="dd-reason-three" style={{ gridTemplateColumns: equalColumns(p4ReasonCount) }}><GoldCard title="총액과 규모의 균형" copy={display(model.land.landAreaPyeong) ? `${display(model.land.landAreaPyeong)} 토지와 기존 건물을 함께 확보하는 구조를 검토합니다.` : '토지와 기존 건물을 함께 확보하는 구조를 검토합니다.'} /><GoldCard title="입지 프리미엄의 근거" copy={display(model.land.roadCondition)} /><GoldCard title="리스크의 투명성" copy={risks[0] || '공적자료·현장·권리관계를 확인해 가격 리스크를 투명하게 제시합니다.'} /></div>
    </Page>}

    {shows(5) && <Page page={5} number={pageNumber(5)} eyebrow="VALUE CREATION SCENARIOS" title="가치 확장 시나리오" subtitle="매입 후 바로 실행할 수 있는 세 가지 방향" snapshot={snapshot} model={model}>
      <SectionBar right="VALUE CREATION ROADMAP">가치 확장 로드맵</SectionBar>
      <div className="dd-roadmap" style={{ gridTemplateColumns: equalColumns(p5RoadmapCount) }}><NumberedPoint index={1} title="즉시 사용" copy={display(model.pricing.occupancyStatus)} /><NumberedPoint index={2} title="리포지셔닝" copy={display(model.investment.features, '파사드·동선·공간 재구성 검토')} /><NumberedPoint index={3} title="중장기 검토" copy={display(model.investment.developmentPlan, '리노베이션 또는 신축 여부 검토')} /></div>
      <SectionBar right="USE CASE SCENARIOS">활용 시나리오</SectionBar>
      <div className="dd-scenarios">{['OWNER-OCCUPIED HQ','F&B / FLAGSHIP','GALLERY / CULTURE'].map((title, i) => <article key={title}><ImageSlot src={imageAt(i)} caption={title} /><h3>{title}</h3>{scenarios[i] && <p>{scenarios[i]}</p>}</article>)}</div>
      <div className="dd-insight"><b>이 자산의 강점은 하나의 “정답 용도”가 아니라 매수자에 따라 달라지는 실행 옵션입니다.</b>{display(model.investment.recommendedUse) && <p>{display(model.investment.recommendedUse)}</p>}</div>
    </Page>}

    {shows(6) && <Page page={6} number={pageNumber(6)} eyebrow="BUILDING & DEVELOPMENT REVIEW" title="건물 및 개발 검토" subtitle="기존 건물의 활용성과 중장기 개발 검토 포인트" snapshot={snapshot} model={model}>
      <SectionBar>현황 건물에서 읽는 실사용 가치</SectionBar>
      <div className="dd-photo-three"><ImageSlot src={imageAt(0)} caption="본건 및 주변 건물 전경" /><ImageSlot src={imageAt(1)} caption="주변 랜드마크·배후수요" /><ImageSlot src={imageAt(2)} caption="주변 도로·생활권 전경" /></div>
      {metrics.length > 0 && <SectionBar>건물 지표</SectionBar>}
      {metrics.length > 0 && <div className="dd-metrics" style={{ gridTemplateColumns: equalColumns(metrics.length) }}>{metrics.map(([label, value]) => <div key={label}><span>●</span><small>{label}</small><strong>{value}</strong></div>)}</div>}
      <SectionBar>매입 후 의사결정 포인트</SectionBar>
      <div className="dd-reason-three"><GoldCard title="기존 건물 유지" copy="초기 투자비를 통제하면서 사옥·업무·콘텐츠 공간으로 활용하는 전략을 검토합니다." /><GoldCard title="리노베이션" copy="외관과 동선, 설비, 층별 기능 재배치를 검토합니다." /><GoldCard title="신축 검토" copy={display(model.investment.developmentPlan, '용도지역·도로·주차·일조·높이·건축선 등을 사전 검토합니다.')} /></div>
      <div className="dd-insight compact"><b>기존 건물의 연식과 상태는 의사결정의 출발점입니다.</b><p>현재 사용 가능한 공간을 확보하면서 향후 리노베이션 또는 신축 여부를 선택할 수 있는 구조인지 확인합니다.</p></div>
    </Page>}

    <Page page={7} number={pageNumber(7)} eyebrow="TRANSACTION READINESS" title="결론 및 제안" subtitle="권리·공적자료·인허가 체크와 매입 결론" snapshot={snapshot} model={model}>
      <SectionBar>거래 전 확인해야 할 핵심</SectionBar>
      <div className="dd-dd-grid"><GoldCard title="토지이용" copy={joinPresent(' · ', display(model.land.zoning), display(model.land.roadCondition))} /><GoldCard title="건축물대장" copy={joinPresent(' · ', display(model.building.totalFloorAreaSqm) && `연면적 ${display(model.building.totalFloorAreaSqm)}`, display(model.building.buildingAreaPyeong) && `건축면적 ${display(model.building.buildingAreaPyeong)}`, parkingOfficial && `공부상 주차 ${parkingOfficial}`)} /><GoldCard title="권리관계" copy={risks[0] || '등기·권리관계는 최신 등기사항전부증명서로 재확인합니다.'} wide={!has(occupancyParking)} />{has(occupancyParking) && <GoldCard title="명도·현장 주차" copy={occupancyParking} />}</div>
      <SectionBar>매수자 체크리스트</SectionBar>
      <ol className="dd-checklist"><li>최신 토지·건물 등기사항전부증명서 재발급</li><li>토지거래허가구역 적용 여부 및 매수인 요건 확인</li><li>대지 경계·접도 폭·현황도로·건축선 확인</li><li>주차·일조·높이·피난·내진 등 신축/대수선 사전검토</li><li>누수·균열·설비·전기용량·배수 등 현장실사</li><li>잔금일 기준 명도 및 인도 범위 계약서 명문화</li></ol>
      <div className="dd-acquisition"><b>ACQUISITION CASE</b><p>{display(model.investment.overallOpinion, '확인된 토지·건물·입지·명도·권리 정보를 종합해 매입 판단 근거를 확정합니다.')}</p></div>
    </Page>
  </div>;
}