import type { ReactNode } from 'react';
import type { ReportSnapshot } from '../../domain/propertyDataRoom/types';
import type { MasterPresentation } from '../../services/reportEngine/masterPresentation';
import { DAON_DETAIL_MASTER_TEMPLATE_ID, DAON_DETAIL_V2_TEMPLATE_VERSION } from '../../domain/professionalReport/templateIds';

function Page({ page, eyebrow, title, subtitle, snapshot, view, children }: {
  page: number;
  eyebrow: string;
  title: string;
  subtitle: string;
  snapshot: ReportSnapshot;
  view: MasterPresentation;
  children: ReactNode;
}) {
  return <article className={`daon-detail-page daon-detail-page-${page}`}>
    <header className="dd-head">
      <div><small>{eyebrow}</small><h1>{title}</h1><p>{subtitle}</p></div>
      <div className="dd-brand"><strong>DA:ON</strong><span>ASSET</span><em>EXCLUSIVE SALE REPORT | {String(page).padStart(2, '0')}</em></div>
    </header>
    <main className="dd-body">{children}</main>
    <footer className="dd-foot">
      <span>DA:ON ASSET · {view.brand.managerName} · {view.brand.phone} · {view.brand.email}</span>
      <span>Snapshot v{snapshot.reportVersion} · {snapshot.generatedAt.slice(0, 10)} · † 확인 필요{view.isSample ? ' · 샘플' : ''}</span>
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

export function LegacyDaonDetail7PageMasterV2({ snapshot, view: v }: { snapshot: ReportSnapshot; view: MasterPresentation }) {
  const hero = v.hero.src;
  const map = v.map.src;
  const imageAt = (i: number) => v.photos[i]?.src;
  const points = v.points;
  const scenarios = v.scenarios;
  const risks = v.risks;
  const facts = v.profileFacts;
  return <div className="daon-detail-master daon-detail-v2" data-template-id={DAON_DETAIL_MASTER_TEMPLATE_ID} data-template-version={DAON_DETAIL_V2_TEMPLATE_VERSION}>
    <Page page={1} eyebrow="WHY THIS ASSET" title={v.name} subtitle="매입 관점에서 보는 핵심 제안" snapshot={snapshot} view={v}>
      <div className="dd-p1-top">
        <div className="dd-p1-hero"><ImageSlot src={hero} caption="대표 외관" /><div className="dd-hero-copy"><b title={v.heroHeadline}>{v.heroHeadline}</b><span>{v.heroSubline}</span></div></div>
        <div className="dd-p1-side">
          <section className="dd-price-card"><small>희망매매가</small><strong>{v.price}</strong><span>{v.address}</span></section>
          <NumberedPoint index={1} title="즉시 활용성" copy={v.occupancy} />
          <NumberedPoint index={2} title="대지와 도로 조건" copy={v.road} />
        </div>
      </div>
      <SectionBar right="KEY INVESTMENT POINTS">매입 검토 포인트</SectionBar>
      <div className="dd-key-list">{(points.length ? points : ['생활권 및 배후수요 확인 필요', '현재 활용성 확인 필요', '확장성 검토 필요', '장기 보유가치 검토 필요']).slice(0, 4).map((point, i) => <div key={i}><span>{i + 1}</span><b>{`검토 ${i + 1}`}</b><p>{point}</p></div>)}</div>
      <div className="dd-insight"><b>매입의 핵심은 “건물” 하나가 아니라 선택지입니다.</b><p>{v.opinion}</p></div>
    </Page>

    <Page page={2} eyebrow="PROPERTY PROFILE" title="PROPERTY PROFILE" subtitle="공적자료와 현장 이용을 함께 보는 자산 구성" snapshot={snapshot} view={v}>
      <SectionBar>자산 개요</SectionBar>
      <div className="dd-profile-grid"><ImageSlot src={hero} caption="본건 외관" /><div className="dd-info-table">{facts.map(([label, value]) => <InfoRow key={label} label={label} value={value} />)}</div></div>
      <SectionBar>층별 구성과 현재 활용</SectionBar>
      <div className="dd-floor-table"><table aria-label="층별 구성 및 현황"><thead><tr>{['층', '공적 용도', '면적', '현황 / 이용'].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{v.floorRows.map((row) => <tr key={row.id} title={row.evidence}>{row.cells.map((cell, i) => <td key={i}>{cell}</td>)}</tr>)}</tbody></table>{v.floorOverflow > 0 && <small>추가 {v.floorOverflow}개 행은 저장된 원본자료 참조</small>}</div>
      <SectionBar>공간에서 보이는 가능성</SectionBar>
      <div className="dd-photo-three"><ImageSlot src={imageAt(0)} caption={v.photos[0].caption} /><ImageSlot src={imageAt(1)} caption={v.photos[1].caption} /><ImageSlot src={imageAt(2)} caption={v.photos[2].caption} /></div>
      <div className="dd-insight compact"><b>현재 활용을 존중하면서 다음 용도를 설계할 수 있습니다.</b><p>{v.use}</p></div>
    </Page>

    <Page page={3} eyebrow="LOCATION LEVERAGE" title="LOCATION LEVERAGE" subtitle="입지와 생활권 수요를 매입 가치로 연결하는 방법" snapshot={snapshot} view={v}>
      <SectionBar right="LOCATION MAP">입지의 핵심 구조</SectionBar>
      <div className="dd-location-grid"><div className="dd-map-wrap"><ImageSlot src={map} caption="입지 지도" className="map" /></div><div className="dd-location-cards"><GoldCard title="도로와 접근성" copy={v.road} /><GoldCard title="생활권 안의 목적형 자산" copy={v.locationHeadline} /><GoldCard title="실사용 매수자에게 맞는 규모" copy={`${v.landArea} 토지 규모와 기존 건물 활용성을 함께 검토합니다.`} /></div></div>
      <div className="dd-photo-three"><ImageSlot src={imageAt(0)} caption={v.photos[0].caption} /><ImageSlot src={imageAt(1)} caption={v.photos[1].caption} /><ImageSlot src={imageAt(2)} caption={v.photos[2].caption} /></div>
      <SectionBar right="KEY POINTS">매수자 관점에서 읽는 입지</SectionBar>
      <div className="dd-key-list three">{['검토 1','검토 2','검토 3'].map((title, i) => <div key={title}><span>{i + 1}</span><b>{title}</b><p>{points[i] || '확인된 입지·수요 데이터 기반으로 활용성을 검토합니다.'}</p></div>)}</div>
      <div className="dd-insight compact"><b>입지는 “유동인구 숫자”보다 어떤 매수자가 이 공간을 필요로 하는지를 보여줘야 합니다.</b><p>{v.locationHeadline}</p></div>
    </Page>

    <Page page={4} eyebrow="EXCLUSIVE SALE REPORT | 04" title="MARKET POSITION & PRICE RATIONALE" subtitle="실거래 사례 속에서 본건의 토지 평당을 읽는 방법" snapshot={snapshot} view={v}>
      <SectionBar>가격 포지션</SectionBar>
      <div className="dd-price-position"><div><small>본건 토지 평당</small><strong>{v.landUnit}</strong></div><div><b>가격을 설득하는 핵심은 “평균보다 싸다”가 아닙니다.</b><p>도로 조건, 명도·실사용 가능성, 기존 건물의 활용성을 확인된 비교사례와 함께 검토합니다.</p></div></div>
      <SectionBar right="토지 평당 · 만원/평 · † 확인 필요">비교 사례</SectionBar>
      <div className="dd-comparison-chart" aria-label="토지 평당 비교"><div>{v.comparableRows.map((row) => <div className={`dd-comparison-row${row.subject ? ' subject' : ''}`} key={row.id} title={row.evidence}><span>{row.label}</span><div className="dd-comparison-track">{row.percent > 0 && <i style={{ width: `${row.percent}%` }} />}</div><b>{row.unit}</b></div>)}</div><small>{v.comparableOverflow > 0 ? `추가 ${v.comparableOverflow}건은 저장된 원본자료 참조 · ` : ''}본건은 희망매매가 기준 · 비교사례는 입력된 거래가격 기준</small></div>
      <div className="dd-analysis-box"><b>해석</b><p>{v.opinion}</p></div>
      <SectionBar>가격을 매입 논리로 바꾸는 세 가지 포인트</SectionBar>
      <div className="dd-photo-three dd-market-photos"><ImageSlot src={imageAt(0)} caption={v.photos[0].caption} /><ImageSlot src={imageAt(1)} caption={v.photos[1].caption} /><ImageSlot src={imageAt(2)} caption={v.photos[2].caption} /></div>
      <div className="dd-reason-three"><GoldCard title="총액과 규모의 균형" copy={`${v.landArea} 토지와 기존 건물을 함께 확보하는 구조를 검토합니다.`} /><GoldCard title="프리미엄의 근거" copy={v.road} /><GoldCard title="리스크의 투명성" copy={risks[0] || '공적자료·현장·권리관계를 확인해 가격 리스크를 투명하게 제시합니다.'} /></div>
    </Page>

    <Page page={5} eyebrow="DA:ON ASSET" title="VALUE CREATION SCENARIOS" subtitle="매입 후 활용 가능성을 검토하는 세 가지 방향" snapshot={snapshot} view={v}>
      <SectionBar right="VALUE CREATION ROADMAP">가치 확장 로드맵</SectionBar>
      <div className="dd-roadmap"><NumberedPoint index={1} title="즉시 사용" copy={v.occupancy} /><NumberedPoint index={2} title="리포지셔닝" copy={v.features} /><NumberedPoint index={3} title="중장기 검토" copy={v.development} /></div>
      <SectionBar right="USE CASE SCENARIOS">활용 시나리오</SectionBar>
      <div className="dd-scenarios">{['활용 검토 01','활용 검토 02','활용 검토 03'].map((title, i) => <article key={title}><ImageSlot src={imageAt(i)} caption={v.photos[i].caption} /><h3>{title}</h3><p>{scenarios[i] || '활용 시나리오 데이터 확인 필요'}</p></article>)}</div>
      <div className="dd-insight"><b>이 자산의 강점은 하나의 “정답 용도”가 아니라 매수자에 따라 달라지는 실행 옵션입니다.</b><p>{v.use}</p></div>
    </Page>

    <Page page={6} eyebrow="BUILDING & DEVELOPMENT REVIEW" title="BUILDING & DEVELOPMENT REVIEW" subtitle="기존 건물의 활용성과 중장기 개발 검토 포인트" snapshot={snapshot} view={v}>
      <SectionBar>현황 건물에서 읽는 실사용 가치</SectionBar>
      <div className="dd-photo-three"><ImageSlot src={imageAt(0)} caption={v.photos[0].caption} /><ImageSlot src={imageAt(1)} caption={v.photos[1].caption} /><ImageSlot src={imageAt(2)} caption={v.photos[2].caption} /></div>
      <SectionBar>건물 지표</SectionBar>
      <div className="dd-metrics"><div><span>●</span><small>건폐율</small><strong>{v.metrics[0][1]}</strong></div><div><span>●</span><small>용적률</small><strong>{v.metrics[1][1]}</strong></div><div><span>●</span><small>사용승인</small><strong>{v.metrics[2][1]}</strong></div></div>
      <SectionBar>매입 후 의사결정 포인트</SectionBar>
      <div className="dd-reason-three"><GoldCard title="기존 건물 유지" copy="초기 투자비를 통제하면서 사옥·업무·콘텐츠 공간으로 활용하는 전략을 검토합니다." /><GoldCard title="리노베이션" copy="외관과 동선, 설비, 층별 기능 재배치를 검토합니다." /><GoldCard title="신축 검토" copy={v.development} /></div>
      <div className="dd-insight compact"><b>기존 건물의 연식은 약점이 아니라 “의사결정의 출발점”으로 설명해야 합니다.</b><p>현재 사용 가능한 공간을 확보하면서 향후 리노베이션 또는 신축 여부를 선택할 수 있는 구조인지 확인합니다.</p></div>
    </Page>

    <Page page={7} eyebrow="TRANSACTION READINESS" title="TRANSACTION READINESS" subtitle="권리·공적자료·인허가 체크와 매입 결론" snapshot={snapshot} view={v}>
      <SectionBar>거래 전 확인해야 할 핵심</SectionBar>
      <div className="dd-dd-grid"><GoldCard title="토지이용" copy={`${v.zoning} · ${v.road}`} /><GoldCard title="건축물대장" copy={`연면적 ${v.totalArea}, 건축면적 ${v.buildingArea}, ${v.mainUse}`} /><GoldCard title="권리관계" copy={risks[0] || '등기·권리관계 최신 자료 재확인 필요'} /><GoldCard title="명도·인도" copy={v.occupancy} /></div>
      <SectionBar>매수자 체크리스트</SectionBar>
      <ol className="dd-checklist"><li>최신 토지·건물 등기사항전부증명서 재발급</li><li>토지거래허가구역 적용 여부 및 매수인 요건 확인</li><li>대지 경계·접도 폭·현황도로·건축선 확인</li><li>주차·일조·높이·피난·내진 등 신축/대수선 사전검토</li><li>누수·균열·설비·전기용량·배수 등 현장실사</li><li>잔금일 기준 명도 및 인도 범위 계약서 명문화</li></ol>
      <div className="dd-acquisition"><b>ACQUISITION CASE</b><p>{v.opinion}</p></div>
      <div className="dd-contact-bar"><strong>DA:ON ASSET</strong><div><b>{v.brand.managerName}</b><span>{v.brand.phone} · {v.brand.email}</span><span>{v.brand.address}</span></div></div>
    </Page>
  </div>;
}
