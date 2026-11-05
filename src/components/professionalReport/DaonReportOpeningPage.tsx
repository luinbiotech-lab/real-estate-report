import type { ProfessionalReportViewModel } from '../../domain/professionalReport/types';
import { reportWording } from '../../domain/professionalReport/reportPurpose';
import { reportMediaCategoryAllowed } from '../../domain/professionalReport/reportAccessPolicy';

const display = (value: { value: unknown; display: string }, fallback = '') =>
  value.value === null || value.value === '' ? fallback : value.display;

export function DaonReportOpeningPage({ model }: { model: ProfessionalReportViewModel }) {
  const hero = (model.media.internalPhotoAllowed ? model.media.mainImage.value : null)
    || model.media.items.find((item) => item.url && reportMediaCategoryAllowed(item.category, model.media.internalPhotoAllowed)
      && (item.category === 'main' || item.category === 'exterior'))?.url || null;
  const name = display(model.identity.name, 'DA:ON PROFESSIONAL REPORT');
  const location = display(model.identity.address, '');
  const use = [display(model.building.mainUse, ''), display(model.land.zoning, '')].filter(Boolean).join(' · ');
  const author = [display(model.identity.managerName, ''), display(model.identity.companyName, '')].filter(Boolean).join(' · ');
  const region = (display(model.identity.address, '').split(' ').slice(0, 3).join(' ')) || '';
  const detail = display(model.identity.detailAddress, '');
  const coverFacts = ([['물건명', display(model.identity.name, '')], ['위치', region], ['소재지', [location, detail].filter(Boolean).join(' ')], ['작성', author], ['발행일', '']] as Array<[string, string]>);
  const generated = new Date(model.generated.generatedAt);
  const month = Number.isNaN(generated.getTime()) ? '' : `${generated.getFullYear()}.${String(generated.getMonth() + 1).padStart(2, '0')}`;
  const issued = Number.isNaN(generated.getTime()) ? '' : `${generated.getFullYear()}.${String(generated.getMonth() + 1).padStart(2, '0')}.${String(generated.getDate()).padStart(2, '0')}`;
  coverFacts[4][1] = issued;
  const shownFacts = coverFacts.filter(([, value]) => value && value.trim());
  return <article className="daon-frame-page daon-opening-page" data-master-page="opening">
    <header className="df-brand-head">
      <div className="df-side-copy">좋은 자산이<br/>좋은 내일을<br/>만듭니다.<i /></div>
      <div className="df-brand-center"><strong>DAON</strong><span>REAL ESTATE PROFESSIONAL REPORT</span><p>도심의 가치를 잇는 전문적인 부동산 솔루션</p></div>
      <div className="df-trust">TRUST<br/>VALUE<br/>SOLUTION<small>당신의 더 큰 가치와<br/>함께합니다.</small></div>
    </header>

    {/* Cover layout of the owner's reference report (2026-11-05): clean full photo, "전속매각 | 주소" title, use line,
        report month and three value pillars. No wording is invented: the title and use come from the Property. */}
    <section className="df-opening-hero df-cover-photo">
      {hero ? <img src={hero} alt={`${name} 대표 이미지`} /> : <div className="df-opening-fallback" />}
    </section>
    <section className="df-cover-title">
      <h1><small>{reportWording(model.identity.reportPurpose?.value).coverTag}</small><span>{location || name}</span></h1>
      {use && <p>{use}</p>}
      <time>{month}</time>
    </section>
    {/* Report cover facts (owner request 2026-11-05): company, author, property name, location and address, so the detail
        report opens with a proper cover instead of starting straight on the content. Blank values are omitted. */}
    <section className="df-cover-facts">
      {shownFacts.map(([label, value]) => <div key={label}><b>{label}</b><span>{value}</span></div>)}
    </section>
    <section className="df-cover-pillars">
      <article><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" /></svg><b>위치의 가치</b><span>입지와 생활권을<br/>공적자료로 정리합니다</span></article>
      <article><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg><b>투자 가치 분석</b><span>데이터로 보는<br/>신뢰 있는 자산 가치</span></article>
      <article><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20h18M5 16l4-5 4 3 6-8M15 6h4v4" /></svg><b>맞춤형 솔루션</b><span>최적의 전략으로<br/>더 큰 가치를 제안합니다</span></article>
    </section>
    <footer className="df-frame-footer"><b>DAON</b><span>REAL ESTATE PROFESSIONAL REPORT</span><em>고객의 가치를 먼저 생각하는 든든한 파트너, 다온입니다.</em></footer>
  </article>;
}
