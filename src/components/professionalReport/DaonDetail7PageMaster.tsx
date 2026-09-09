import type { ProfessionalReportViewModel } from '../../domain/professionalReport/types';
import { DAON_DETAIL_MASTER_TEMPLATE_ID } from '../../domain/professionalReport/templateIds';
import type { ReportSnapshot } from '../../domain/propertyDataRoom/types';
import { ProfessionalReportV1 } from './ProfessionalReportV1';

/**
 * Locked DAON 7-page MASTER shell.
 * Visual markup and CSS stay in ProfessionalReportV1 until a new template ID is introduced.
 */
export function DaonDetail7PageMaster({ snapshot, model }: { snapshot: ReportSnapshot; model: ProfessionalReportViewModel }) {
  return <ProfessionalReportV1 snapshot={snapshot} model={model} templateId={DAON_DETAIL_MASTER_TEMPLATE_ID} />;
}
