import type { ProfessionalReportViewModel } from '../../domain/professionalReport/types';

const ONE_PAGE_ASSET = '/daon-master/bangbae-815-11-1p.jpg';
const DETAIL_ASSETS = Array.from({ length: 7 }, (_, index) => `/daon-master/bangbae-815-11-7p-${index + 1}.jpg`);

export function isBangbaeGoldenModel(model: Pick<ProfessionalReportViewModel, 'identity'>): boolean {
  const name = model.identity.name.value || '';
  const address = `${model.identity.address.value || ''} ${model.identity.detailAddress.value || ''}`;
  return /방배동\s*815[-\s]11/.test(`${name} ${address}`);
}

export function DaonBangbaeOnePageGolden() {
  return <div className="daon-golden-document daon-golden-one-page" data-template-id="DAON_1P_MASTER">
    <article className="daon-golden-page"><img src={ONE_PAGE_ASSET} alt="DAON_1P_MASTER 방배동 815-11" /></article>
  </div>;
}

export function DaonBangbaeDetail7PageGolden() {
  return <div className="daon-golden-document daon-golden-detail" data-template-id="DAON_DETAIL_7P_MASTER">
    {DETAIL_ASSETS.map((src, index) => <article className="daon-golden-page" key={src}><img src={src} alt={`DAON_DETAIL_7P_MASTER ${index + 1}페이지`} /></article>)}
  </div>;
}
