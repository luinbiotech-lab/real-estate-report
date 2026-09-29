import type { ProfessionalReportViewModel } from '../../domain/professionalReport/types';

export function DaonReportClosingPage({ model }: { model: ProfessionalReportViewModel }) {
  const manager = model.identity.managerName.value || '김은미';
  const phone = model.identity.managerPhone.value || '010-9953-1270';
  return <article className="daon-frame-page daon-closing-page" data-master-page="closing">
    <header className="df-brand-head">
      <div className="df-side-copy">좋은 자산이<br/>좋은 내일을<br/>만듭니다.<i /></div>
      <div className="df-brand-center"><strong>DAON</strong><span>REAL ESTATE PROFESSIONAL REPORT</span><p>도심의 가치를 잇는 전문적인 부동산 솔루션</p></div>
      <div className="df-trust">TRUST<br/>VALUE<br/>SOLUTION<small>당신의 더 큰 가치와<br/>함께합니다.</small></div>
    </header>

    <section className="df-closing-lead">
      <h1>DAON 소개</h1>
      <h2>고객의 가치를 먼저 생각하는 든든한 부동산 파트너</h2>
      <p>다온에셋 부동산중개는 자산의 현재 가치와 미래 가치를 함께 읽어내는 제안형 부동산 솔루션을 지향합니다. 매각 제안서, 투자 분석, 입지 해석, 개발 호재 분석까지 고객의 의사결정에 필요한 핵심 정보를 정돈된 보고서로 제공합니다.</p>
    </section>

    <section className="df-service-section">
      <div className="df-section-heading"><b>주요 서비스</b><span>고객의 다양한 목표를, 더 큰 가치로 연결합니다.</span></div>
      <div className="df-service-grid">
        <article><span>01</span><b>매각 제안</b><p>물건의 강점과 시장 포지션을 구조화해 제안합니다.</p></article>
        <article><span>02</span><b>투자 분석</b><p>입지, 수익, 개발 모멘텀을 종합적으로 해석합니다.</p></article>
        <article><span>03</span><b>리포트 제작</b><p>고급 보고서 형식으로 핵심 내용을 명확하게 전달합니다.</p></article>
        <article><span>04</span><b>맞춤 상담</b><p>고객 상황에 맞는 방향성과 실행 포인트를 함께 정리합니다.</p></article>
      </div>
    </section>

    <section className="df-contact-section">
      <div className="df-section-heading"><b>Contact</b><span>언제든지, 다온이 함께하겠습니다.</span></div>
      <div className="df-contact-card">
        <div><small>다온에셋 부동산중개</small><strong>대표 {manager}</strong><b>{phone}</b></div>
        <p><em>TRUST VALUE SOLUTION</em>신뢰를 바탕으로 고객의 더 큰 가치를 실현하는 든든한 파트너, 다온입니다.</p>
      </div>
    </section>

    <div className="df-closing-quote">“당신의 더 큰 가치와 함께합니다.”</div>
    <footer className="df-frame-footer"><b>DAON</b><span>REAL ESTATE PROFESSIONAL REPORT</span><em>고객의 가치를 먼저 생각하는 든든한 파트너, 다온입니다.</em></footer>
  </article>;
}
