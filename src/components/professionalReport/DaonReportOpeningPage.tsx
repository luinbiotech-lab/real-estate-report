import type { ProfessionalReportViewModel } from '../../domain/professionalReport/types';

const display = (value: { value: unknown; display: string }, fallback = '') =>
  value.value === null || value.value === '' ? fallback : value.display;

export function DaonReportOpeningPage({ model }: { model: ProfessionalReportViewModel }) {
  const hero = model.media.mainImage.value || model.media.items.find((item) => item.url && (item.category === 'main' || item.category === 'exterior'))?.url || null;
  const name = display(model.identity.name, 'DA:ON PROFESSIONAL REPORT');
  const location = display(model.identity.address, '');
  return <article className="daon-frame-page daon-opening-page" data-master-page="opening">
    <header className="df-brand-head">
      <div className="df-side-copy">좋은 자산이<br/>좋은 내일을<br/>만듭니다.<i /></div>
      <div className="df-brand-center"><strong>DAON</strong><span>REAL ESTATE PROFESSIONAL REPORT</span><p>도심의 가치를 잇는 전문적인 부동산 솔루션</p></div>
      <div className="df-trust">TRUST<br/>VALUE<br/>SOLUTION<small>당신의 더 큰 가치와<br/>함께합니다.</small></div>
    </header>

    <section className="df-opening-hero">
      {hero ? <img src={hero} alt={`${name} 제안서 대표 이미지`} /> : <div className="df-opening-fallback" />}
      <div className="df-opening-copy">
        <small>전속매각 제안서</small>
        <h1>도시의 가치를 읽고,<br/>더 나은 내일을 만듭니다.</h1>
        <p>{location ? `${location}의 현재 가치와 미래 성장 가능성을 함께 검토합니다.` : '자산의 현재 가치와 미래 성장 가능성을 함께 검토합니다.'}</p>
      </div>
    </section>

    <section className="df-opening-intro">
      <h2>{name}</h2>
      <p>본 제안서는 핵심 자산의 현재 가치와 미래 성장 가능성을 함께 검토할 수 있도록 구성했습니다. 물건 개요, 투자 포인트, 개발 호재, 미래가치 해석을 통해 투자 판단에 필요한 핵심 내용을 정돈된 보고서로 전달합니다.</p>
      <div className="df-opening-pillars">
        <article><b>핵심 물건 요약</b><span>검증된 자산 정보를 한눈에 정리합니다.</span></article>
        <article><b>투자 분석</b><span>입지·수익·활용성을 투자 관점으로 해석합니다.</span></article>
        <article><b>개발 호재 심화 분석</b><span>지역 변화와 미래가치를 구조적으로 연결합니다.</span></article>
      </div>
    </section>

    <div className="df-opening-quote">좋은 자산이 좋은 내일을 만듭니다.</div>
    <footer className="df-frame-footer"><b>DAON</b><span>REAL ESTATE PROFESSIONAL REPORT</span><em>고객의 가치를 먼저 생각하는 든든한 파트너, 다온입니다.</em></footer>
  </article>;
}
