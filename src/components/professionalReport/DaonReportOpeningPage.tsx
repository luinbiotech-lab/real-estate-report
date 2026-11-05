import type { ProfessionalReportViewModel } from '../../domain/professionalReport/types';
import { reportPurposeOf } from '../../domain/professionalReport/reportPurpose';
import { DaonLogoImage } from '../brand/DaonLogoImage';

const display = (value: { value: unknown; display: string }, fallback = '') =>
  value.value === null || value.value === '' ? fallback : value.display;

/*
 * Detail-report cover (owner decision 2026-11-05: "the cover stays simple, no photos or content; emphasise the company").
 * Revision 2026-11-05 22:30 (owner: "white property name on a full navy page stands out too much; check it matches the
 * body design"): the cover now uses the body's own vocabulary instead of a full-bleed navy page — a navy brand panel
 * with the gold rule (an enlarged version of the content-page title band) carrying the company logo, a white body with
 * navy/gold type like the content pages, and the navy foot bar of the closing page. The property name is navy at a
 * moderate size on white. Blank values are omitted. The content pages follow.
 */
export function DaonReportOpeningPage({ model }: { model: ProfessionalReportViewModel }) {
  const name = display(model.identity.name, '');
  const address = [display(model.identity.address, ''), display(model.identity.detailAddress, '')].filter(Boolean).join(' ');
  const company = display(model.identity.companyName, '') || 'DA:ON ASSET';
  const author = display(model.identity.managerName, '');
  const generated = new Date(model.generated.generatedAt);
  const issued = Number.isNaN(generated.getTime()) ? '' : `${generated.getFullYear()}. ${String(generated.getMonth() + 1).padStart(2, '0')}. ${String(generated.getDate()).padStart(2, '0')}`;
  const title = reportPurposeOf(model.identity.reportPurpose?.value) === 'analysis' ? '부동산 분석 보고서' : '부동산 전속매각 보고서';
  const facts = ([['소재지', address], ['작성', [author, company].filter(Boolean).join(' · ')], ['발행일', issued]] as Array<[string, string]>)
    .filter(([, value]) => value && value.trim());
  return <article className="daon-frame-page daon-opening-page daon-cover-simple" data-master-page="opening">
    <header className="dcs-brand">
      <DaonLogoImage className="dcs-logo" />
      <em>REAL ESTATE PROFESSIONAL REPORT</em>
    </header>
    <div className="dcs-body">
      <div className="dcs-title">
        <small>{title}</small>
        {name && <h1>{name}</h1>}
        <i />
      </div>
      {facts.length > 0 && <dl className="dcs-facts">
        {facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>}
    </div>
    <footer className="dcs-foot"><b>{company}</b><span>고객의 가치를 먼저 생각하는 든든한 부동산 파트너</span></footer>
  </article>;
}
