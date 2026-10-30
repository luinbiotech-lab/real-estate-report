import type { ReactNode } from 'react';
import {
  ApartmentOutlined,
  AssignmentTurnedInOutlined,
  BusinessOutlined,
  CalendarMonthOutlined,
  DescriptionOutlined,
  GroupsOutlined,
  LayersOutlined,
  LightbulbOutlined,
  LocalParkingOutlined,
  LocationOnOutlined,
  StraightenOutlined,
} from '@mui/icons-material';
import type { Property } from '../../types';
import { formatWon, lines, pricePerPyeong } from '../../utils/format';
import { DAON_ONE_PAGE_MASTER_TEMPLATE_ID, DAON_ONE_PAGE_MASTER_TEMPLATE_VERSION } from '../../domain/professionalReport/templateIds';

// Blank-value policy (owner decision 2026-10-30): a missing value is hidden, never printed as a '확인 필요' placeholder.
// Fixed grid cells keep their slot (layout of the approved MASTER is unchanged) and list-like entries are omitted.
const moneyPerPyeong = (value: number) => value ? `약 ${formatWon(value)}` : '';
const areaPair = (sqm: number, py: number) => sqm || py ? `${sqm ? `${sqm.toFixed(2).replace(/\.00$/, '')}㎡` : '-'} (${py ? `${py.toFixed(2).replace(/\.00$/, '')}평` : '-'})` : '';
const first = (value: string, fallback: string) => lines(value)[0] || fallback;
const hasNumber = (value: number | undefined) => typeof value === 'number' && Number.isFinite(value);
const floorText = (p: Property) => {
  const basement = hasNumber(p.basementFloors) && p.basementFloors > 0 ? `지하 ${p.basementFloors}층` : '';
  const ground = hasNumber(p.groundFloors) && p.groundFloors > 0 ? `지상 ${p.groundFloors}층` : '';
  return [basement, ground].filter(Boolean).join(' / ');
};

function DaonLogo() {
  return <div className="d1-logo" aria-label="DA:ON ASSET">
    <div className="d1-logo-mark">D</div>
    <div><strong>DA:ON</strong><span>ASSET</span></div>
  </div>;
}

function Fact({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  if (!value || !value.trim()) return null;
  return <div className="d1-fact">
    <b><span className="d1-fact-icon">{icon}</span><span className="d1-fact-label">{label}</span></b>
    <span className="d1-fact-value" title={value}>{value}</span>
  </div>;
}

export function DaonOnePageMaster({ property: p }: { property: Property }) {
  const landUnit = pricePerPyeong(p);
  const grossUnit = p.salePrice && p.totalFloorAreaPyeong ? Math.round(p.salePrice / p.totalFloorAreaPyeong) : 0;
  const points = [...lines(p.features), ...lines(p.investmentPoints)].filter(Boolean).slice(0, 7);
  const officialParking = hasNumber(p.parkingOfficial)
    ? `${p.parkingOfficial}대`
    : hasNumber(p.parkingSpaces)
      ? `${p.parkingSpaces}대 · 기존값`
      : '';
  const fieldParking = hasNumber(p.parkingField)
    ? `${p.parkingField}대 가능${p.parkingFieldNote ? ` · ${p.parkingFieldNote}` : ' · 현장 이용 기준'}`
    : '';
  const parking = hasNumber(p.parkingField)
    ? `${p.parkingField}대 가능*`
    : hasNumber(p.parkingOfficial)
      ? `${p.parkingOfficial}대`
      : hasNumber(p.parkingSpaces)
        ? `${p.parkingSpaces}대`
        : '';
  const parkingNote = hasNumber(p.parkingField) ? `* ${p.parkingFieldNote || '현장 이용 기준'}` : '';
  const heroHeadline = first(p.investmentPoints, first(p.features, '입지와 활용가치를 함께 검토하는 자산'));
  const locationCaption = [p.nearbyStation || '', p.roadCondition || ''].filter(Boolean).join(' · ');
  const occupancySummary = first(p.occupancyStatus, '');
  const roadSummary = first(p.roadCondition, '');
  const roadAddress = p.address ? p.address.split(' ').slice(-2).join(' ') : '';
  const highlightItems = [
    { text: roadSummary, icon: <LocationOnOutlined /> },
    { text: occupancySummary, icon: <GroupsOutlined /> },
    { text: first(p.recommendedUse, ''), icon: <ApartmentOutlined /> },
    { text: first(p.developmentPlan, ''), icon: <DescriptionOutlined /> },
  ];

  return <div className="daon-one-page-master" data-template-id={DAON_ONE_PAGE_MASTER_TEMPLATE_ID} data-template-version={DAON_ONE_PAGE_MASTER_TEMPLATE_VERSION}>
    <article className="d1-sheet">
      <header className="d1-header">
        <div className="d1-head-copy">
          <small>가치를 보는 안목, 새로운 가능성을 만듭니다.</small>
          <h1>전속매각 | {p.name}</h1>
          <p>{p.address}{p.detailAddress ? ` ${p.detailAddress}` : ''}</p>
        </div>
        <DaonLogo />
        <div className="d1-tagline">More Than Real Estate<br/>A Better Tomorrow</div>
      </header>

      <section className="d1-price-band">
        <div><small>희망매매가</small><strong>{p.salePrice ? formatWon(p.salePrice) : ''}</strong></div>
        <div><small>토지평당</small><strong>{moneyPerPyeong(landUnit)}</strong></div>
        <div><small>연면적평당</small><strong>{moneyPerPyeong(grossUnit)}</strong></div>
      </section>

      <section className="d1-status-strip">
        {occupancySummary ? <div><AssignmentTurnedInOutlined className="d1-status-icon" /><b>{occupancySummary}</b></div> : <div aria-hidden="true" />}
        {(p.occupancyStatus || '').includes('소유자') ? <div><BusinessOutlined className="d1-status-icon" /><b>소유자 직접 사용</b></div> : <div aria-hidden="true" />}
        {roadSummary ? <div><LocationOnOutlined className="d1-status-icon" /><b>{(p.roadCondition || '').includes('코너') ? '코너 입지' : roadSummary}</b></div> : <div aria-hidden="true" />}
        {parking ? <div><LocalParkingOutlined className="d1-status-icon" /><b>{parking}</b>{parkingNote && <small>{parkingNote}</small>}</div> : <div aria-hidden="true" />}
        <span>PRIME LOCATION<br/>VALUABLE ASSET</span>
      </section>

      <section className="d1-main-grid">
        <div className="d1-left">
          <div className="d1-hero">
            {p.mainImage ? <img src={p.mainImage} alt={`${p.name} 대표 외관`} /> : <div className="d1-empty">대표 외관사진<br/><small>데이터 미연결</small></div>}
            <div className="d1-hero-copy">
              <h2>{heroHeadline}</h2>
              <p>DA:ON ASSET<br/>EXCLUSIVE SALE</p>
            </div>
          </div>
          <div className="d1-facts-grid">
            <Fact icon={<LocationOnOutlined />} label="주소" value={p.address || ''} />
            <Fact icon={<BusinessOutlined />} label="주용도" value={p.mainUse || ''} />
            <Fact icon={<StraightenOutlined />} label="토지면적" value={areaPair(p.landAreaSqm, p.landAreaPyeong)} />
            <Fact icon={<LayersOutlined />} label="용도지역" value={p.zoning || ''} />
            <Fact icon={<DescriptionOutlined />} label="지목" value={p.landCategory || ''} />
            <Fact icon={<CalendarMonthOutlined />} label="사용승인일" value={p.completionDate || ''} />
            <Fact icon={<StraightenOutlined />} label="연면적" value={areaPair(p.totalFloorAreaSqm, p.totalFloorAreaPyeong)} />
            <Fact icon={<ApartmentOutlined />} label="건축면적" value={p.buildingAreaPyeong ? `${p.buildingAreaPyeong.toFixed(2)}평` : ''} />
            <Fact icon={<ApartmentOutlined />} label="규모" value={floorText(p)} />
            <Fact icon={<LocalParkingOutlined />} label="공부상 주차" value={officialParking} />
            <Fact icon={<LocalParkingOutlined />} label="현장 주차" value={fieldParking} />
            <Fact icon={<AssignmentTurnedInOutlined />} label="현재 이용·명도" value={occupancySummary} />
          </div>
        </div>

        <div className={`d1-right ${p.mapImage ? '' : 'd1-right-no-map'}`}>
          <section className="d1-points">
            <div className="d1-section-title"><b>핵심 포인트</b><small>KEY INVESTMENT HIGHLIGHTS</small></div>
            <ol>{points.map((point, index) => <li key={`${point}-${index}`}><span>✓</span><b title={point}>{point}</b></li>)}</ol>
          </section>
          {p.mapImage && <section className="d1-map">
            <img src={p.mapImage} alt={`${p.name} 위치 지도`} />
            {locationCaption && <div className="d1-map-caption">{locationCaption}</div>}
          </section>}
        </div>
      </section>

      <section className="d1-mini-grid">
        <article><b>ROAD ACCESS</b><div className="d1-road-diagram"><i/><span>본건</span></div>{roadAddress && <p>{roadAddress} · 주요 도로 연결</p>}{p.roadCondition && <small>{p.roadCondition}</small>}</article>
        <article><b>TRANSIT</b><div className="d1-transit-diagram"><i/><i/></div>{p.nearbyStation && <p>{p.nearbyStation}</p>}{p.stationDistance && <small>{p.stationDistance}</small>}</article>
        <article><b>LIVING NETWORK</b><div className="d1-network"><span>주거</span><span>본건</span><span>상권</span></div>{first(p.locationAnalysis, '') && <p>{first(p.locationAnalysis, '')}</p>}</article>
      </section>

      <section className="d1-highlight-strip">
        {highlightItems.map((item, index) => item.text ? <div key={`${item.text}-${index}`}><span className="d1-highlight-icon">{item.icon}</span><b>{item.text}</b></div> : <div key={`blank-${index}`} aria-hidden="true" />)}
      </section>

      <section className="d1-use"><strong><LightbulbOutlined /><span>활용 제안</span></strong><p>{p.recommendedUse || '활용 방향은 현장 및 인허가 검토 후 확정합니다.'}</p></section>

      <footer className="d1-footer">
        <DaonLogo />
        <div className="d1-contact"><strong>{p.managerName || '김은미 대표 / 공인중개사'}</strong><span>M&nbsp; {p.managerPhone || '010 9953 1270'} &nbsp;&nbsp; E&nbsp; {p.managerEmail || 'daonasset.korea@gmail.com'}</span></div>
        <div className="d1-footer-note">REAL ESTATE<br/>CREATES<br/>A BETTER TOMORROW<small>본 자료는 매각 검토용 요약자료이며 계약 전 권리관계 및 현장 재확인이 필요합니다.</small></div>
      </footer>
    </article>
  </div>;
}
