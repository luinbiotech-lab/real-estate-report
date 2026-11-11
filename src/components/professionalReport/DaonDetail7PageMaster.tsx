import { detailPagePlan, equalColumns, type DetailPageId } from '../../domain/professionalReport/reportLayoutFill';
import { askingPosition, formatEok, priceLayerCells, PRICE_ESTIMATE_METHOD_NOTE } from '../../domain/professionalReport/priceLayerView';
import type { ReactNode } from 'react';
import { DaonLogoImage } from '../brand/DaonLogoImage';
import { coverageDisplay, shortOrFirstLine } from '../../domain/professionalReport/reportDisplayRules';
import { reportWording } from '../../domain/professionalReport/reportPurpose';
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

function Page({ page, number, eyebrow, title, en, subtitle, snapshot, model, source, children }: {
  page: number;
  /** Printed page number after omitted pages are removed (owner decision 2026-10-31). */
  number: number;
  eyebrow: string;
  title: string;
  /** Large English page title of the owner's reference 7P (2026-11-03); the Korean title stays as the eyebrow line. */
  en?: string;
  subtitle: string;
  /** Right-hand footer note (data basis); defaults to the snapshot version. */
  source?: string;
  snapshot: ReportSnapshot;
  model: ProfessionalReportViewModel;
  children: ReactNode;
}) {
  return <article className={`daon-detail-page daon-detail-page-${page}`} data-detail-page={page}>
    <header className="dd-head" data-page-number={String(number).padStart(2, '0')}>
      <div className="dd-head-copy"><small>{en ? title : eyebrow}</small><h1 lang={en ? 'en' : undefined} className={!en && title.length > 16 ? 'dd-title-long' : undefined}>{en || title}</h1><p>{subtitle}</p></div>
      <div className="dd-brand dd-brand-image"><DaonLogoImage className="dd-logo-img" /><em>{reportWording(model.identity.reportPurpose?.value).pageTag} | {String(number).padStart(2, '0')}</em></div>
    </header>
    <main className="dd-body">{children}</main>
    <footer className="dd-foot">
      <span>{joinPresent(' · ', 'DA:ON ASSET', model.identity.managerName.value || '', model.identity.managerPhone.value || '', model.identity.managerEmail.value || '')}</span>
      <span>{joinPresent(' · ', source || '', `Snapshot v${snapshot.reportVersion}`, new Date(snapshot.generatedAt).toLocaleDateString('ko-KR'))}</span>
    </footer>
  </article>;
}

export type DetailIconName = 'pin' | 'building' | 'document' | 'people' | 'chart' | 'leaf' | 'target' | 'bulb' | 'tools' | 'search' | 'edit' | 'route';
const ICON_PATHS: Record<DetailIconName, string> = {
  pin: 'M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  building: 'M4 21V5l8-2v18M12 8h8v13M7 8h2M7 12h2M7 16h2M15 12h2M15 16h2M2 21h20',
  document: 'M6 3h9l4 4v14H6zM15 3v4h4M9 11h7M9 15h7M9 19h4',
  people: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16.5 11a2.5 2.5 0 1 0 0-5M18 14.5c1.8.8 3 2.7 3 5',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  leaf: 'M5 19c0-8 5-14 15-14 0 10-6 15-14 15M5 19l8-8',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12l7-7M16 5h3v3',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.8.6 1.5 1.6 1.5 2.6V17h4v-.5c0-1 .7-2 1.5-2.6A6 6 0 0 0 12 3z',
  tools: 'M14.5 6.5a4 4 0 0 0 5 5L12 19l-3 1 1-3 7.5-7.5M5 5l4 4M3 7l4-4',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5L21 21',
  edit: 'M5 3h9l4 4v6M5 3v18h7M14 3v4h4M16 21l5-5-2-2-5 5v2z',
  route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 15V9a4 4 0 0 1 4-4h6M18 9v6a4 4 0 0 1-4 4H8',
};
/** Line icon used by the reference 7P (cards, insight boxes, numbered rows). Decorative, so hidden from screen readers. */
function Icon({ name, className = 'dd-icon' }: { name: DetailIconName; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={ICON_PATHS[name]} /></svg>;
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

function NumberedPoint({ index, title, copy, icon }: { index: number; title: string; copy: string; icon?: DetailIconName }) {
  if (!copy) return null;
  return <article className="dd-number-card"><span>{String(index).padStart(2, '0')}</span><div><b>{title}</b><p>{copy}</p></div>{icon && <Icon name={icon} className="dd-icon dd-number-icon" />}</article>;
}

function GoldCard({ title, copy, wide = false, icon, photo, index }: { title: string; copy: string; wide?: boolean; icon?: DetailIconName; photo?: string | null; index?: number }) {
  if (!copy) return null;
  if (photo) return <article className="dd-gold-card photo-card"><figure className="dd-image"><img src={photo} alt={title} /></figure><div className="dd-photo-card-copy"><b>{index !== undefined && <span className="dd-badge">{String(index).padStart(2, '0')}</span>}{title}</b><p>{copy}</p></div></article>;
  return <article className={`dd-gold-card${icon ? ' with-icon' : ''}`} style={wide ? { gridColumn: '1 / -1' } : undefined}>{icon ? <span className="dd-icon-badge"><Icon name={icon} /></span> : <span>●</span>}<div><b>{title}</b><p>{copy}</p></div></article>;
}

function Insight({ title, copy, icon, compact = false, kicker }: { title: string; copy?: string; icon: DetailIconName; compact?: boolean; kicker?: string }) {
  return <div className={`dd-insight with-icon${compact ? ' compact' : ''}`}><span className="dd-icon-badge large"><Icon name={icon} /></span><div>{kicker && <small>{kicker}</small>}<b>{title}</b>{copy && <p>{copy}</p>}</div></div>;
}

/** Horizontal land-unit-price bars of the reference 7P page 4: comparables in navy, the subject in gold. */
function UnitPriceBars({ rows, subject }: { rows: Array<{ label: string; detail: string; value: number }>; subject: { label: string; value: number } | null }) {
  const all = [...rows.map((row) => row.value), subject?.value ?? 0].filter((value) => Number.isFinite(value) && value > 0);
  const max = Math.max(...all, 1);
  const bar = (key: string, label: string, detail: string, value: number, own = false) => <div key={key} className={`dd-bar-row${own ? ' own' : ''}`}><b>{label}{detail && <small>{detail}</small>}</b><span className="dd-bar-track"><i style={{ width: `${Math.max(4, Math.round((value / max) * 100))}%` }} /></span><strong>{formatCompactWon(value)}</strong></div>;
  return <div className="dd-bars">{rows.map((row, i) => bar(`${row.label}:${i}`, row.label, row.detail, row.value))}{subject && subject.value > 0 && bar('subject', subject.label, '', subject.value, true)}</div>;
}

const KEY_ICONS: DetailIconName[] = ['people', 'building', 'chart', 'leaf'];

/*
 * Category labels must describe the line they sit next to (multi-model review on PR #46, 2026-11-05: fixed labels such
 * as '문화 / 콘텐츠' were printed beside an official land price). A label is used only when the stored line states it
 * itself as "라벨: 내용" (or "라벨 — 내용"); otherwise the row is numbered without a category.
 */
export function splitLabel(line: string): { label: string; text: string } {
  const match = line.match(/^\s*([^:：]{2,10})\s*[:：]\s*(.+)$/);
  return match ? { label: match[1].trim(), text: match[2].trim() } : { label: '', text: line };
}

export function DaonDetail7PageMaster({ snapshot, model }: { snapshot: ReportSnapshot; model: ProfessionalReportViewModel }) {
  const visibleMedia = model.media.items.filter((item) => item.url && reportMediaCategoryAllowed(item.category, model.media.internalPhotoAllowed));
  const hero = (model.media.internalPhotoAllowed ? model.media.mainImage.value : null)
    || visibleMedia.find((item) => item.category === 'main' || item.category === 'exterior')?.url || null;
  const map = model.media.mapImage.value || null;
  const supporting = visibleMedia.filter((item) => item.url !== hero && item.category !== 'map').map((item) => item.url as string);
  const imageAt = (index: number) => supporting[index] || hero;
  const hasPhotos = Boolean(imageAt(0));
  const points = [...splitLines(model.investment.investmentPoints, 8), ...splitLines(model.investment.features, 8)].filter(Boolean).slice(0, 6);
  const scenarios = splitLines(model.investment.recommendedUse, 3);
  const risks = splitLines(model.risks.risks, 6);
  const comparables = model.investment.comparables ?? [];
  // Titles never infer a corner from free text (Luin review on PR #46, 2026-11-04): neutral titles until a verified
  // structured road state exists. The stored road text itself is still printed as written.
  const heroStatement = shortOrFirstLine(model.identity.shortHeadline?.value, points[0], '입지와 활용가치를 함께 검토하는 자산');
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
  const plan = detailPagePlan(model, Boolean(map), comparables.length, hasPhotos);
  const pageNumber = (id: DetailPageId) => plan.pages.find((entry) => entry.id === id)?.number ?? 0;
  const shows = (id: DetailPageId) => pageNumber(id) > 0;
  const has = (value: string) => Boolean(value && value.trim());
  const p1SideCount = [display(model.pricing.occupancyStatus), display(model.land.roadCondition)].filter(has).length;
  const p4ReasonCount = 2 + (has(display(model.land.roadCondition)) ? 1 : 0);
  const p5RoadmapCount = 2 + (has(display(model.pricing.occupancyStatus)) ? 1 : 0);
  // A 0% coverage/FAR is how the building register reports an unrecorded value, not a fact (2026-11-05 owner test).
  const positive = (item: ReportValue<number>) => typeof item.value === 'number' && item.value > 0 ? display(item) : '';
  // Register coverage 0 = unrecorded. When building and land areas exist, print a clearly labelled calculated value
  // (owner reference page 6: "단순 건폐율 약 48.8%" with a note), never as the register value.
  const coverage = coverageDisplay(model.building.buildingCoverageRate.value, display(model.building.buildingCoverageRate), model.building.buildingAreaPyeong.value, model.land.landAreaPyeong.value);
  const calcCoverage = coverage?.calculated ? coverage.value : '';
  const metrics = ([[coverage?.label ?? '건폐율', coverage?.value ?? ''], ['용적률', positive(model.building.floorAreaRatio)], ['사용승인', display(model.building.completionDate)]] as Array<[string, string]>).filter(([, value]) => has(value));
  const p3CardCount = [display(model.land.roadCondition), display(model.location.locationAnalysis)].filter(has).length + 1;
  // Price layers (owner decision 2026-11-02, 안 A): 4 cards on page 4 + the deals behind the estimate.
  const priceEstimate = model.pricing.priceEstimate ?? null;
  const priceCells = priceLayerCells({
    salePrice: model.pricing.salePrice.value ?? 0,
    landAreaPyeong: model.land.landAreaPyeong.value ?? 0, landAreaSqm: model.land.landAreaSqm.value ?? 0,
    estimatedOfficialLandValue: model.land.estimatedOfficialLandValue?.value ?? 0, officialLandPriceYear: model.land.officialLandPriceYear?.value ?? '',
    brokerAchievablePrice: model.pricing.brokerAchievablePrice?.value ?? 0,
    brokerAchievablePriceRationale: model.pricing.brokerAchievablePriceRationale?.value ?? '',
    brokerAchievablePriceConfirmedAt: model.pricing.brokerAchievablePriceConfirmedAt?.value ?? '',
  }, priceEstimate);
  const askingLine = askingPosition(model.pricing.salePrice.value ?? undefined, priceEstimate);
  const brokerRationale = display(model.pricing.brokerAchievablePriceRationale ?? { value: null, display: '', state: 'missing', sourceIds: [] });
  const estimateDeals = priceEstimate?.state === 'estimated' ? (priceEstimate.deals ?? []).slice(0, 6) : [];
  const occupancyParking = joinPresent(' · ', display(model.pricing.occupancyStatus), parkingField && `현장 주차 ${parkingField}${parkingFieldNote}`);

  return <div className="daon-detail-master" data-template-id={DAON_DETAIL_MASTER_TEMPLATE_ID} data-template-version={DAON_DETAIL_MASTER_TEMPLATE_VERSION}>
    <Page page={1} number={pageNumber(1)} eyebrow="WHY THIS ASSET" title={model.identity.name.display} subtitle="매입 관점에서 보는 핵심 제안" source="자료기준: 건축물대장·토지이용계획" snapshot={snapshot} model={model}>
      <div className={`dd-p1-top${hero ? '' : ' no-photo'}`}>
        <div className="dd-p1-hero"><ImageSlot src={hero} caption="대표 외관" /><div className="dd-hero-copy"><b>{heroStatement}</b><span>실사용 + 리포지셔닝 + 장기 가치</span></div></div>
        <div className="dd-p1-side" style={{ gridTemplateRows: display(model.pricing.salePrice) ? (p1SideCount ? `34mm ${equalColumns(p1SideCount)}` : '34mm') : equalColumns(Math.max(p1SideCount, 1)) }}>
          {display(model.pricing.salePrice) && <section className="dd-price-card"><small>희망매매가</small><strong>{display(model.pricing.salePrice)}</strong><span>{model.identity.address.display}</span></section>}
          <NumberedPoint index={1} title="즉시 활용성" copy={display(model.pricing.occupancyStatus)} />
          <NumberedPoint index={2} title={'도로·접근 조건'} copy={display(model.land.roadCondition)} />
        </div>
      </div>
      {points.length > 0 && <SectionBar right="KEY INVESTMENT POINTS">매입 검토 포인트</SectionBar>}
      {points.length > 0 && <div className={`dd-key-list${points.slice(0, 4).some((point) => splitLabel(point).label) ? ' has-labels' : ''}`}>{points.slice(0, 4).map((point, i) => { const { label, text } = splitLabel(point); return <div key={i} className={label ? '' : 'no-label'}><span>{i + 1}</span>{label ? <b><Icon name={KEY_ICONS[i] || 'pin'} />{label}</b> : <b className="dd-label-empty" />}<p>{text}</p></div>; })}</div>}
      <Insight icon="building" title="매입의 핵심은 “건물” 하나가 아니라 선택지입니다." copy={display(model.investment.overallOpinion, '현재 활용, 리포지셔닝, 장기 보유가치를 함께 검토할 수 있도록 자료를 확정합니다.')} />
    </Page>

    <Page page={2} number={pageNumber(2)} eyebrow="PROPERTY PROFILE" title="물건 개요 및 층별 구성" en="PROPERTY PROFILE" source="자료기준: 건축물대장·현장 확인" subtitle="공적자료와 현장 이용을 함께 보는 자산 구성" snapshot={snapshot} model={model}>
      <SectionBar>자산 개요</SectionBar>
      <div className={`dd-profile-grid${hero ? '' : ' no-photo'}`}><ImageSlot src={hero} caption="본건 외관" /><div className="dd-info-table">{visibleFacts.map(([label, value]) => <InfoRow key={label} label={label} value={value} />)}</div></div>
      {model.building.floors.length > 0 && <>
        <SectionBar>층별 구성과 현재 활용</SectionBar>
        <div className="dd-floor-placeholder" style={{ display: 'grid', placeItems: 'stretch', alignContent: 'stretch', gap: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '12mm 1fr 25mm 1.05fr', alignItems: 'center', background: '#062f55', color: '#fff', borderRadius: '1.6mm 1.6mm 0 0', padding: '0 2.5mm', fontSize: '9.6px', fontWeight: 800 }}><span>층</span><span>공적대장 용도</span><span>면적</span><span>현재 이용 / 비고</span></div>
          {model.building.floors.slice(0, 4).map((floor) => <div key={floor.id} style={{ display: 'grid', gridTemplateColumns: '12mm 1fr 25mm 1.05fr', alignItems: 'center', borderBottom: '0.2mm solid #e2e6eb', padding: '0 2.5mm', minHeight: 0, fontSize: '10px', overflow: 'hidden' }}><b style={{ fontSize: '10.4px' }}>{floor.floor}</b><span style={{ whiteSpace: 'normal', wordBreak: 'keep-all' }}>{floor.name}</span><span>{formatFloorArea(floor.areaSqm)}</span><span style={{ whiteSpace: 'normal', wordBreak: 'keep-all', color: '#6d7a88' }}>{floor.currentCondition || '-'}</span></div>)}
          {model.building.floors.length > 4 && <div className="dd-floor-more" style={{ padding: '1.4mm 2.5mm', fontSize: '10px', color: '#6d7a88' }}>외 {model.building.floors.length - 4}개 층은 Data Room 층별 자료에서 확인할 수 있습니다.</div>}
        </div>
      </>}
      {hasPhotos && <SectionBar>공간에서 보이는 가능성</SectionBar>}
      {hasPhotos && <div className={`dd-photo-three${model.building.floors.length ? '' : ' tall'}`}><ImageSlot src={imageAt(0)} caption="인접 주거환경" /><ImageSlot src={imageAt(1)} caption="생활권·주변 상권" /><ImageSlot src={imageAt(2)} caption="주변 상업·업무 환경" /></div>}
      <Insight compact icon="building" title="현재 활용을 존중하면서 다음 용도를 설계할 수 있습니다." copy={display(model.investment.recommendedUse, '사옥, 주거, 업무, 복합공간 등 활용 방향은 인허가 및 현장검토 후 확정합니다.')} />
    </Page>

    {shows(3) && <Page page={3} number={pageNumber(3)} eyebrow="LOCATION LEVERAGE" title="입지 분석" en="LOCATION LEVERAGE" source="입지표현: 공개 지도·현장 확인 기준" subtitle="입지와 생활권 수요를 매입 가치로 연결하는 방법" snapshot={snapshot} model={model}>
      <SectionBar right="LOCATION MAP">입지의 핵심 구조</SectionBar>
      <div className={`dd-location-grid${map ? '' : ' no-map'}`}><div className="dd-map-wrap"><ImageSlot src={map} caption="입지 지도" className="map" /></div><div className="dd-location-cards" style={{ gridTemplateRows: equalColumns(p3CardCount) }}><GoldCard icon="pin" title={'도로 접근성'} copy={display(model.land.roadCondition)} /><GoldCard icon="people" title="생활권 안의 목적형 자산" copy={display(model.location.locationAnalysis)} /><GoldCard icon="chart" title="실사용 매수자에게 맞는 규모" copy={joinPresent(' ', display(model.land.landAreaPyeong), '토지 규모와 기존 건물 활용성을 함께 검토합니다.')} /></div></div>
      {hasPhotos && <div className="dd-photo-three"><ImageSlot src={imageAt(0)} caption="인접 주거환경" /><ImageSlot src={imageAt(1)} caption="생활권과 다양한 상권" /><ImageSlot src={imageAt(2)} caption={'주변 도로·접근 환경'} /></div>}
      {points.length > 0 && <SectionBar right="KEY POINTS">매수자 관점에서 읽는 입지</SectionBar>}
      {points.length > 0 && <div className={`dd-key-list three${points.slice(0, 3).some((point) => splitLabel(point).label) ? ' has-labels' : ''}`}>{points.slice(0, 3).map((point, i) => { const { label, text } = splitLabel(point); return <div key={i} className={label ? '' : 'no-label'}><span>{i + 1}</span>{label ? <b>{label}</b> : <b className="dd-label-empty" />}<p>{text}</p></div>; })}</div>}
      <Insight compact icon="bulb" title="입지는 “유동인구 숫자”보다 어떤 매수자가 이 공간을 필요로 하는지를 보여줘야 합니다." copy={display(model.location.locationAnalysis)} />
    </Page>}

    {shows(4) && <Page page={4} number={pageNumber(4)} eyebrow="MARKET POSITION" title="주변 시세 및 비교거래 사례" en="MARKET POSITION & PRICE RATIONALE" source="비교거래: 확인된 공개 실거래 기준" subtitle="실거래 사례 속에서 본건의 토지 평당을 읽는 방법" snapshot={snapshot} model={model}>
      {priceCells.length > 1 ? <>
        <SectionBar right="PRICE LAYERS">가격 4단계</SectionBar>
        <div className="dd-price-layers" data-testid="dd-price-layers" style={{ gridTemplateColumns: equalColumns(priceCells.length) }}>{priceCells.map((cell) => <div key={cell.key} data-price-layer={cell.key} data-price-unit={cell.unit} data-long={cell.value.length > 13 ? 'true' : undefined}><small>{cell.label}</small><strong>{cell.value}</strong><span>{cell.sub}</span><em>{cell.badge}</em></div>)}</div>
        {(askingLine || brokerRationale) && <p className="dd-price-layers-note">{joinPresent(' ', askingLine, brokerRationale && `중개사 확정 근거: ${brokerRationale}`)}</p>}
      </> : <>
        <SectionBar>가격 포지션</SectionBar>
        <div className="dd-price-position"><div><small>본건 토지 평당</small><strong>{display(model.pricing.landUnitPrice)}</strong></div><div><b>가격을 설득하는 핵심은 “평균보다 싸다”가 아닙니다.</b><p>도로조건, 명도·실사용 가능성, 기존 건물의 활용성과 같은 개별 조건을 확인된 비교사례와 함께 설명합니다.</p></div></div>
      </>}
      {comparables.length === 0 && estimateDeals.length > 0 && <>
        <SectionBar right="공개 실거래 후보 · 감정평가 아님">추정에 쓴 비교거래</SectionBar>
        <div className="dd-estimate-deals" data-testid="dd-estimate-deals">
          <div className="dd-est-row dd-est-head"><span>거래일</span><span>위치 · 용도</span><span>거래가</span><span>대지</span><span>토지평당</span></div>
          {estimateDeals.map((deal, index) => <div className="dd-est-row" key={`${deal.dealDate}-${index}`}><span>{deal.dealDate}</span><span>{joinPresent(' · ', `${deal.legalDong} ${deal.jibun}`, deal.buildingUse)}</span><span>{formatEok(deal.dealAmount)}</span><span>{deal.landAreaSqm}㎡</span><b>{formatEok(deal.landPricePerPyeong)}</b></div>)}
          <small>{PRICE_ESTIMATE_METHOD_NOTE}</small>
        </div>
      </>}
      {(comparables.length > 0 || (model.investment.nearbyTransactions.value && estimateDeals.length === 0)) && <>
        <SectionBar right={comparables.length ? '단위: 토지 평당가' : '단위: 입력자료 기준'}>비교 사례</SectionBar>
        <div className={`dd-comparables${comparables.length ? ' has-bars' : ''}`}>{comparables.length ? <UnitPriceBars rows={comparables.slice(0, 6).map((row) => ({ label: row.label, detail: joinPresent(' / ', formatCompactWon(row.salePrice), `${row.landAreaPyeong.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}평`, row.tradeDate), value: row.landUnitPrice }))} subject={typeof model.pricing.landUnitPrice.value === 'number' ? { label: '본건', value: model.pricing.landUnitPrice.value } : null} /> : <p>{model.investment.nearbyTransactions.display}</p>}</div>
      </>}
      <div className="dd-analysis-box"><b>해석</b><p>{display(model.investment.overallOpinion, '단순 평균으로 적정가격을 확정하지 않고, 입지·규모·도로조건·건물상태를 함께 검토합니다.')}</p></div>
      <SectionBar>가격을 매입 논리로 바꾸는 세 가지 포인트</SectionBar>
      <div className={`dd-reason-three${imageAt(0) ? ' with-photos' : ''}`} style={{ gridTemplateColumns: equalColumns(p4ReasonCount) }}><GoldCard photo={imageAt(0)} index={1} icon="chart" title="총액과 규모의 균형" copy={display(model.land.landAreaPyeong) ? `${display(model.land.landAreaPyeong)} 토지와 기존 건물을 함께 확보하는 구조를 검토합니다.` : '토지와 기존 건물을 함께 확보하는 구조를 검토합니다.'} /><GoldCard photo={imageAt(1)} index={2} icon="pin" title="입지 프리미엄의 근거" copy={display(model.land.roadCondition)} /><GoldCard photo={imageAt(2)} index={3} icon="search" title="리스크의 투명성" copy={risks[0] || '공적자료·현장·권리관계를 확인해 가격 리스크를 투명하게 제시합니다.'} /></div>
    </Page>}

    {shows(5) && <Page page={5} number={pageNumber(5)} eyebrow="VALUE CREATION SCENARIOS" title="가치 확장 시나리오" en="VALUE CREATION SCENARIOS" source="활용 제안은 인허가·구조·소방·주차 등 별도 검토가 필요합니다" subtitle="매입 후 바로 실행할 수 있는 세 가지 방향" snapshot={snapshot} model={model}>
      <SectionBar right="VALUE CREATION ROADMAP">가치 확장 로드맵</SectionBar>
      <div className="dd-roadmap" style={{ gridTemplateColumns: equalColumns(p5RoadmapCount) }}><NumberedPoint icon="building" index={1} title="즉시 사용" copy={display(model.pricing.occupancyStatus)} /><NumberedPoint icon="chart" index={2} title="리포지셔닝" copy={display(model.investment.features, '파사드·동선·공간 재구성 검토')} /><NumberedPoint icon="edit" index={3} title="중장기 검토" copy={display(model.investment.developmentPlan, '리노베이션 또는 신축 여부 검토')} /></div>
      {scenarios.length > 0 && <SectionBar right="USE CASE SCENARIOS">활용 시나리오</SectionBar>}
      {scenarios.length > 0 && <div className="dd-scenarios" style={{ gridTemplateColumns: equalColumns(scenarios.length) }}>{scenarios.map((line, i) => { const { label, text } = splitLabel(line); const title = label || `활용안 ${i + 1}`; return <article key={i}>{hasPhotos && <ImageSlot src={imageAt(i)} caption={title} />}<h3>{title}</h3><p>{text}</p></article>; })}</div>}
      <Insight icon="target" kicker="STRATEGIC INSIGHT" title="이 자산의 강점은 하나의 “정답 용도”가 아니라 매수자에 따라 달라지는 실행 옵션입니다." copy={splitLines(model.investment.recommendedUse, 6).join(' · ')} />
    </Page>}

    {shows(6) && <Page page={6} number={pageNumber(6)} eyebrow="BUILDING & DEVELOPMENT REVIEW" title="건물 및 개발 검토" en="BUILDING & DEVELOPMENT REVIEW" source="자료기준: 일반건축물대장" subtitle="기존 건물의 활용성과 중장기 개발 검토 포인트" snapshot={snapshot} model={model}>
      {hasPhotos && <SectionBar>현황 건물에서 읽는 실사용 가치</SectionBar>}
      {hasPhotos && <div className="dd-photo-three"><ImageSlot src={imageAt(0)} caption="본건 및 주변 건물 전경" /><ImageSlot src={imageAt(1)} caption="주변 랜드마크·배후수요" /><ImageSlot src={imageAt(2)} caption="주변 도로·생활권 전경" /></div>}
      {metrics.length > 0 && <SectionBar>건물 지표</SectionBar>}
      {metrics.length > 0 && <div className="dd-metrics" style={{ gridTemplateColumns: equalColumns(metrics.length) }}>{metrics.map(([label, value]) => <div key={label}><span>●</span><small>{label}{label === '단순 건폐율' && <em>(산출)</em>}</small><strong>{value}</strong></div>)}</div>}
      {calcCoverage && <p className="dd-metric-note">※ 건축물대장 건폐율 미기재. 건축면적÷대지면적으로 단순 산출한 값이며 공부상 수치가 아닙니다.</p>}
      <SectionBar>매입 후 의사결정 포인트</SectionBar>
      <div className="dd-reason-three"><GoldCard icon="building" title="기존 건물 유지" copy="초기 투자비를 통제하면서 사옥·업무·콘텐츠 공간으로 활용하는 전략을 검토합니다." /><GoldCard icon="tools" title="리노베이션" copy="외관과 동선, 설비, 층별 기능 재배치를 검토합니다." /><GoldCard icon="search" title="신축 검토" copy={display(model.investment.developmentPlan, '용도지역·도로·주차·일조·높이·건축선 등을 사전 검토합니다.')} /></div>
      <Insight compact icon="building" title="기존 건물의 연식과 상태는 의사결정의 출발점입니다." copy="현재 사용 가능한 공간을 확보하면서 향후 리노베이션 또는 신축 여부를 선택할 수 있는 구조인지 확인합니다." />
    </Page>}

    <Page page={7} number={pageNumber(7)} eyebrow="TRANSACTION READINESS" title="결론 및 제안" en="TRANSACTION READINESS" source="등기·공적자료는 계약 전 재확인" subtitle="권리·공적자료·인허가 체크와 매입 결론" snapshot={snapshot} model={model}>
      <SectionBar>거래 전 확인해야 할 핵심</SectionBar>
      <div className="dd-dd-grid"><GoldCard icon="pin" title="토지이용" copy={joinPresent(' · ', display(model.land.zoning), display(model.land.roadCondition))} /><GoldCard icon="building" title="건축물대장" copy={joinPresent(' · ', display(model.building.totalFloorAreaSqm) && `연면적 ${display(model.building.totalFloorAreaSqm)}`, display(model.building.buildingAreaPyeong) && `건축면적 ${display(model.building.buildingAreaPyeong)}`, parkingOfficial && `공부상 주차 ${parkingOfficial}`)} /><GoldCard icon="document" title="권리·규제 확인" copy={risks[0] || '등기·권리관계는 최신 등기사항전부증명서로 재확인합니다.'} wide={!has(occupancyParking)} />{has(occupancyParking) && <GoldCard icon="people" title="명도·현장 주차" copy={occupancyParking} />}</div>
      <SectionBar>매수자 체크리스트</SectionBar>
      <ol className="dd-checklist"><li>최신 토지·건물 등기사항전부증명서 재발급</li><li>토지거래허가구역 적용 여부 및 매수인 요건 확인</li><li>대지 경계·접도 폭·현황도로·건축선 확인</li><li>주차·일조·높이·피난·내진 등 신축/대수선 사전검토</li><li>누수·균열·설비·전기용량·배수 등 현장실사</li><li>잔금일 기준 명도 및 인도 범위 계약서 명문화</li></ol>
      <div className="dd-acquisition with-icon"><span className="dd-icon-badge large solid"><Icon name="edit" /></span><div><b>ACQUISITION CASE</b><p>{display(model.investment.overallOpinion, '확인된 토지·건물·입지·명도·권리 정보를 종합해 매입 판단 근거를 확정합니다.')}</p></div></div>
      {has(display(model.identity.managerName)) && <div className="dd-contact-band"><div className="dd-contact-brand dd-contact-brand-image"><DaonLogoImage className="dd-contact-logo-img" /></div><div><b>{display(model.identity.managerName)}</b><p>{joinPresent('   ', display(model.identity.managerPhone) && `M ${display(model.identity.managerPhone)}`, display(model.identity.managerEmail) && `E ${display(model.identity.managerEmail)}`)}</p></div><div className="dd-contact-cta"><b>{reportWording(model.identity.reportPurpose?.value).contactCta}</b><p>{display(model.identity.companyName, 'DA:ON ASSET')}</p></div></div>}
    </Page>
  </div>;
}