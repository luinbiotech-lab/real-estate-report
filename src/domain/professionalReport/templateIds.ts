export const DAON_ONE_PAGE_MASTER_TEMPLATE_ID = 'DAON_1P_MASTER' as const;
export const DAON_DETAIL_MASTER_TEMPLATE_ID = 'DAON_DETAIL_7P_MASTER' as const;
export const LEGACY_PROFESSIONAL_TEMPLATE_ID = 'professional-v1' as const;

export const DAON_ONE_PAGE_MASTER_TEMPLATE_VERSION = 'daon-1p-v2' as const;
export const DAON_DETAIL_MASTER_TEMPLATE_VERSION = 'daon-detail-7p-v2' as const;
export const LEGACY_PROFESSIONAL_TEMPLATE_VERSION = 'professional-v1' as const;

const COMPATIBLE_DAON_DETAIL_VERSIONS = new Set([
  'daon-detail-7p-v1',
  DAON_DETAIL_MASTER_TEMPLATE_VERSION,
  DAON_DETAIL_MASTER_TEMPLATE_ID,
]);

export type ProfessionalReportTemplateId =
  | typeof DAON_DETAIL_MASTER_TEMPLATE_ID
  | typeof LEGACY_PROFESSIONAL_TEMPLATE_ID;

export function isSupportedProfessionalTemplateId(value: string): value is ProfessionalReportTemplateId {
  return value === DAON_DETAIL_MASTER_TEMPLATE_ID || value === LEGACY_PROFESSIONAL_TEMPLATE_ID;
}

export function resolveProfessionalTemplate(input: { templateId?: string; templateVersion: string }): ProfessionalReportTemplateId | null {
  if (input.templateId && isSupportedProfessionalTemplateId(input.templateId)) return input.templateId;

  // Backward compatibility for immutable snapshots created before templateId existed.
  if (input.templateVersion === LEGACY_PROFESSIONAL_TEMPLATE_VERSION) return LEGACY_PROFESSIONAL_TEMPLATE_ID;

  // Compatibility for earlier DA:ON snapshots while new snapshots use the restored v2 MASTER.
  if (COMPATIBLE_DAON_DETAIL_VERSIONS.has(input.templateVersion)) return DAON_DETAIL_MASTER_TEMPLATE_ID;

  return null;
}
