import type { ReportSnapshot } from '../../domain/propertyDataRoom/types';
import type { ProfessionalReportViewModel } from '../../domain/professionalReport/types';
import { DAON_DETAIL_MASTER_TEMPLATE_ID, DAON_DETAIL_MASTER_TEMPLATE_VERSION } from '../../domain/professionalReport/templateIds';
import { DaonDetail7PageMaster } from './DaonDetail7PageMaster';
import { DaonReportOpeningPage } from './DaonReportOpeningPage';
import { DaonReportClosingPage } from './DaonReportClosingPage';

export function DaonProfessionalReportMaster({ snapshot, model }: { snapshot: ReportSnapshot; model: ProfessionalReportViewModel }) {
  return <div
    className="daon-professional-report-master"
    data-template-id={DAON_DETAIL_MASTER_TEMPLATE_ID}
    data-template-version={DAON_DETAIL_MASTER_TEMPLATE_VERSION}
    data-visual-master="DAON_VISUAL_MASTER_2026_09_22"
  >
    <DaonReportOpeningPage model={model} />
    <DaonDetail7PageMaster snapshot={snapshot} model={model} />
    <DaonReportClosingPage model={model} />
  </div>;
}
