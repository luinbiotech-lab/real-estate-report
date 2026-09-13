import type { MasterPresentation } from '../../services/reportEngine/masterPresentation';
import { DAON_ONE_PAGE_MASTER_TEMPLATE_ID, DAON_ONE_PAGE_MASTER_TEMPLATE_VERSION } from '../../domain/professionalReport/templateIds';

function DaonLogo() {
  return <div className="d1-logo" aria-label="DA:ON ASSET">
    <div className="d1-logo-mark">D</div>
    <div><strong>DA:ON</strong><span>ASSET</span></div>
  </div>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="d1-fact"><b>{label}</b><span title={value}>{value}</span></div>;
}

export function DaonOnePageMaster({ view: v }: { view: MasterPresentation }) {
  const points = v.highlights.slice(0, 7);
  return <div className="daon-one-page-master" data-template-id={DAON_ONE_PAGE_MASTER_TEMPLATE_ID} data-template-version={DAON_ONE_PAGE_MASTER_TEMPLATE_VERSION}>
    <article className="d1-sheet">
      <header className="d1-header">
        <div className="d1-head-copy">
          <small>가치를 보는 안목, 새로운 가능성을 만듭니다.</small>
          <h1 title={`${v.transaction} | ${v.name}`}>{v.transaction} | {v.name}</h1>
          <p>{v.address}</p>
        </div>
        <DaonLogo />
        <div className="d1-tagline">More Than Real Estate<br/>A Better Tomorrow</div>
      </header>

      <section className="d1-price-band">
        <div><small>희망매매가</small><strong>{v.price}</strong></div>
        <div><small>토지평당</small><strong>{v.landUnit}</strong></div>
        <div><small>연면적평당</small><strong>{v.grossUnit}</strong></div>
      </section>

      <section className="d1-status-strip">
        <div><b>{v.occupancy}</b></div><div><b>{v.currentUse}</b></div><div><b>{v.road}</b></div>
        <div className="d1-parking"><b>{v.parking}</b>{v.parkingNote && <small>{v.parkingNote}</small>}</div>
        <span>PRIME LOCATION<br/>VALUABLE ASSET</span>
      </section>

      <section className="d1-main-grid">
        <div className="d1-left">
          <div className="d1-hero">
            {v.hero.src ? <img src={v.hero.src} alt={v.hero.caption} /> : <div className="d1-empty">대표 외관사진<br/><small>데이터 미연결</small></div>}
            <div className="d1-hero-copy">
              <h2 title={v.heroHeadline}>{v.heroHeadline}</h2>
              <p>{v.heroSubline}</p>
            </div>
          </div>
          <div className="d1-facts-grid">
            {v.facts.map(([label, value]) => <Fact key={label} label={label} value={value} />)}
          </div>
        </div>

        <div className="d1-right">
          <section className="d1-points">
            <div className="d1-section-title"><b>핵심 포인트</b><small>KEY INVESTMENT HIGHLIGHTS</small></div>
            <ol>{(points.length ? points : ['핵심 투자포인트 확인 필요']).map((point, index) => <li key={`${point}-${index}`}><span>✓</span><b title={point}>{point}</b></li>)}</ol>
          </section>
          <section className="d1-map">
            {v.map.src ? <img src={v.map.src} alt={v.map.caption} /> : <div className="d1-empty">위치지도<br/><small>데이터 미연결</small></div>}
            <div className="d1-map-caption">{v.locationHeadline}</div>
          </section>
        </div>
      </section>

      <section className="d1-mini-grid">
        <article><b>ROAD ACCESS</b><div className="d1-road-diagram"><i/><span>본건</span></div><p title={v.roadSummary}>{v.roadSummary}</p><small>도로 연결 개념도 · 현황 확인 필요</small></article>
        <article><b>TRANSIT</b><div className="d1-transit-diagram"><i/><i/></div><p>{v.transitSummary}</p><small>{v.transitDistance}</small></article>
        <article><b>LIVING NETWORK</b><div className="d1-network"><span>{v.networkNames[0] || '주변시설 확인'}</span><span>본건</span><span>{v.networkNames[1] || '주변시설 확인'}</span></div><p title={v.livingSummary}>{v.livingSummary}</p></article>
      </section>
      <section className="d1-highlight-strip">{v.highlightStrip.map((text, i) => <div key={i}><b title={text}>{text}</b></div>)}</section>
      <section className="d1-use"><strong>활용 제안</strong><p title={v.use}>{v.use}</p></section>

      <footer className="d1-footer">
        <DaonLogo />
        <div className="d1-contact"><span>M {v.brand.phone}</span><span>E {v.brand.email}</span></div>
        <div className="d1-footer-note">REAL ESTATE<br/>CREATES<br/>A BETTER TOMORROW<small>{v.brand.footerText}<br/>† 확인 필요 · 계산값은 입력자료 기준{v.isSample ? ' · 샘플 데이터' : ''}</small></div>
      </footer>
    </article>
  </div>;
}
