import type { ProfessionalReportViewModel } from '../../domain/professionalReport/types';
import { reportPurposeOf } from '../../domain/professionalReport/reportPurpose';
import { DaonMark } from '../brand/DaonMark';

const display = (value: { value: unknown; display: string }, fallback = '') =>
  value.value === null || value.value === '' ? fallback : value.display;

/*
 * Detail-report cover (owner decision 2026-11-05: "the cover stays simple, no photos or content; emphasise the company").
 * Company mark and name lead; then the report title, property name and a short fact block (address, author, date).
 * Blank values are omitted. The content pages follow.
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
    <div className="dcs-brand">
      <DaonMark className="dcs-mark" />
      <strong>DA:ON</strong>
      <span>ASSET</span>
      <i />
      <em>REAL ESTATE PROFESSIONAL REPORT</em>
    </div>
    <div className="dcs-title">
      <small>{title}</small>
      {name && <h1>{name}</h1>}
    </div>
    {facts.length > 0 && <dl className="dcs-facts">
      {facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>}
    <footer className="dcs-foot"><b>{company}</b><span>고객의 가치를 먼저 생각하는 든든한 부동산 파트너</span></footer>
  </article>;
}
