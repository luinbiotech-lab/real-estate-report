export const DAON_ONE_PAGE_MASTER_TEMPLATE_ID = 'DAON_1P_MASTER' as const;
export const DAON_DETAIL_MASTER_TEMPLATE_ID = 'DAON_DETAIL_7P_MASTER' as const;
export const LEGACY_PROFESSIONAL_TEMPLATE_ID = 'professional-v1' as const;

export type ProfessionalReportTemplateId =
  | typeof DAON_DETAIL_MASTER_TEMPLATE_ID
  | typeof LEGACY_PROFESSIONAL_TEMPLATE_ID;

export function isSupportedProfessionalTemplate(value: string): value is ProfessionalReportTemplateId {
  return value === DAON_DETAIL_MASTER_TEMPLATE_ID || value === LEGACY_PROFESSIONAL_TEMPLATE_ID;
}
