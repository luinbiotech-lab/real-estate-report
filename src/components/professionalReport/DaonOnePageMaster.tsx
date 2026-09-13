import { AssignmentTurnedInOutlined, BusinessOutlined, LocalParkingOutlined, LocationOnOutlined } from '@mui/icons-material';
import type { Property } from '../../types';
import { formatWon, lines, pricePerPyeong } from '../../utils/format';
import { DAON_ONE_PAGE_MASTER_TEMPLATE_ID, DAON_ONE_PAGE_MASTER_TEMPLATE_VERSION } from '../../domain/professionalReport/templateIds';

const moneyPerPyeong = (value: number) => value ? `약 ${formatWon(value)}` : '확인 필요';
const areaPair = (sqm: number, py: number) => sqm || py ? `${sqm ? `${sqm.toFixed(2).replace(/\.00$/, '')}㎡` : '-'} (${py ? `${py.toFixed(2).replace(/\.00$/, '')}평` : '-'})` : '확인 필요';
const first = (value: string, fallback: string) => lines(value)[0] || fallback;
const hasNumber = (value: number | undefined) => typeof value === 'number' && Number.isFinite(value);
const floorText = (p: Property) => {
  const basement = hasNumber(p.basementFloors) && p.basementFloors > 0 ? `지하 ${p.basementFloors}층` : '';
  const ground = hasNumber(p.groundFloors) && p.groundFloors > 0 ? `지상 ${p.groundFloors}층` : '';
  return [basement, ground].filter(Boolean).join(' / ') || '확인 필요';
};

function DaonLogo() {
  return <div className="d1-logo" aria-label="DA:ON ASSET">
    <div className="d1-logo-mark">D</div>
    <div><strong>DA:ON</strong><span>ASSET</span></div>
  </div>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="d1-fact"><b>{label}</b><span title={value}>{value}</span></div>;
}

export function DaonOnePageMaster({ property: p }: { property: Property }) {
  const landUnit = pricePerPyeong(p);
  const grossUnit = p.salePrice && p.totalFloorAreaPyeong ? Math.round(p.salePrice / p.totalFloorAreaPyeong) : 0;
  const points = [...lines(p.features), ...lines(p.investmentPoints)].filter(Boolean).slice(0, 6);
  const parking = hasNumber(p.parkingField)
    ? `${p.parkingField}대 가능*`
    : hasNumber(p.parkingOfficial)
      ? `${p.parkingOfficial}대`
      : hasNumber(p.parkingSpaces)
        ? `${p.parkingSpaces}대`
        : '확인 필요';
  const parkingNote = hasNumber(p.parkingField) ? `* ${p.parkingFieldNote || '현장 이용 기준'}` : '';
  const heroHeadline = first(p.investmentPoints, first(p.features, '입지와 활용가치를 함께 검토하는 자산'));
  const locationCaption = [p.nearbyStation || '', p.roadCondition || ''].filter(Boolean).join(' · ') || '입지 특성 확인 필요';
  const occupancySummary = first(p.occupancyStatus, '명도·현재 이용 확인 필요');
  const roadSummary = first(p.roadCondition, '도로 조건 확인 필요');
  const roadAddress = p.address ? p.address.split(' ').slice(-2).join(' ') : '소재지 확인 필요';
  const highlightItems = [
    roadSummary,
    occupancySummary,
    first(p.recommendedUse, '활용 방향 검토'),
    first(p.developmentPlan, '개발·인허가 검토'),
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
        <div><small>희망매매가</small><strong>{p.salePrice ? formatWon(p.salePrice) : '확인 필요'}</strong></div>
        <div><small>토지평당</small><strong>{moneyPerPyeong(landUnit)}</strong></div>
        <div><small>연면적평당</small><strong>{moneyPerPyeong(grossUnit)}</strong></div>
      </section>

      <section className="d1-status-strip">
        <div><AssignmentTurnedInOutlined className="d1-status-icon" /><b>{occupancySummary}</b></div>
        <div><BusinessOutlined className="d1-status-icon" /><b>{p.occupancyStatus.includes('소유자') ? '소유자 직접 사용' : '현재 이용 확인'}</b></div>
        <div><LocationOnOutlined className="d1-status-icon" /><b>{p.roadCondition.includes('코너') ? '코너 입지' : roadSummary}</b></div>
        <div><LocalParkingOutlined className="d1-status-icon" /><b>{parking}</b>{parkingNote && <small>{parkingNote}</small>}</div>
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
            <Fact label="주소" value={p.address || '확인 필요'} />
            <Fact label="주용도" value={p.mainUse || '확인 필요'} />
            <Fact label="토지면적" value={areaPair(p.landAreaSqm, p.landAreaPyeong)} />
            <Fact label="용도지역" value={p.zoning || '확인 필요'} />
            <Fact label="지목" value="확인 필요" />
            <Fact label="사용승인일" value={p.completionDate || '확인 필요'} />
            <Fact label="연면적" value={areaPair(p.totalFloorAreaSqm, p.totalFloorAreaPyeong)} />
            <Fact label="현재 이용" value={first(p.occupancyStatus, '확인 필요')} />
            <Fact label="건축면적" value={p.buildingAreaPyeong ? `${p.buildingAreaPyeong.toFixed(2)}평` : '확인 필요'} />
            <Fact label="지하층" value={p.basementFloors > 0 ? `지하 ${p.basementFloors}층` : '확인 필요'} />
            <Fact label="용적률 참고 계산" value={p.floorAreaRatio && p.landAreaSqm ? `${(p.floorAreaRatio / 100 * p.landAreaSqm).toFixed(2)}㎡ · 계산값` : '확인 필요'} />
            <Fact label="명도 조건" value={first(p.occupancyStatus, '협의 필요')} />
            <Fact label="규모" value={floorText(p)} />
          </div>
        </div>

        <div className="d1-right">
          <section className="d1-points">
            <div className="d1-section-title"><b>핵심 포인트</b><small>KEY INVESTMENT HIGHLIGHTS</small></div>
            <ol>{(points.length ? points : ['핵심 투자포인트 확인 필요']).map((point, index) => <li key={`${point}-${index}`}><span>✓</span><b title={point}>{point}</b></li>)}</ol>
          </section>
          <section className="d1-map">
            {p.mapImage ? <img src={p.mapImage} alt={`${p.name} 위치 지도`} /> : <div className="d1-empty">위치지도<br/><small>데이터 미연결</small></div>}
            <div className="d1-map-caption">{locationCaption}</div>
          </section>
        </div>
      </section>

      <section className="d1-mini-grid">
        <article><b>ROAD ACCESS</b><div className="d1-road-diagram"><i/><span>본건</span></div><p>{roadAddress} · 주요 도로 연결</p><small>{p.roadCondition || '도로조건 확인 필요'}</small></article>
        <article><b>TRANSIT</b><div className="d1-transit-diagram"><i/><i/></div><p>{p.nearbyStation || '인근역 확인 필요'}</p><small>{p.stationDistance || '접근거리 확인 필요'}</small></article>
        <article><b>LIVING NETWORK</b><div className="d1-network"><span>주거</span><span>본건</span><span>상권</span></div><p>{first(p.locationAnalysis, '배후수요·생활권 분석 필요')}</p></article>
      </section>

      <section className="d1-highlight-strip">
        {highlightItems.map((item, index) => <div key={`${item}-${index}`}><b>{item}</b></div>)}
      </section>

      <section className="d1-use"><strong>활용 제안</strong><p>{p.recommendedUse || '활용 방향은 현장 및 인허가 검토 후 확정합니다.'}</p></section>

      <footer className="d1-footer">
        <DaonLogo />
        <div className="d1-contact"><strong>{p.managerName || '김은미 대표 / 공인중개사'}</strong><span>M&nbsp; {p.managerPhone || '010 9953 1270'} &nbsp;&nbsp; E&nbsp; {p.managerEmail || 'daonasset.korea@gmail.com'}</span></div>
        <div className="d1-footer-note">REAL ESTATE<br/>CREATES<br/>A BETTER TOMORROW<small>본 자료는 매각 검토용 요약자료이며 계약 전 권리관계 및 현장 재확인이 필요합니다.</small></div>
      </footer>
    </article>
  </div>;
}
