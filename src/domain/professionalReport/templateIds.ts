export const DAON_ONE_PAGE_MASTER_TEMPLATE_ID = 'DAON_1P_MASTER' as const;
export const DAON_DETAIL_MASTER_TEMPLATE_ID = 'DAON_DETAIL_7P_MASTER' as const;
export const LEGACY_PROFESSIONAL_TEMPLATE_ID = 'professional-v1' as const;
export const DAON_ONE_PAGE_MASTER_TEMPLATE_VERSION = 'daon-1p-v3' as const;
export const DAON_DETAIL_MASTER_TEMPLATE_VERSION = 'daon-detail-7p-v3' as const;
export const DAON_DETAIL_V2_TEMPLATE_VERSION = 'daon-detail-7p-v2' as const;
export const DAON_DETAIL_V1_TEMPLATE_VERSION = 'daon-detail-7p-v1' as const;
export const LEGACY_PROFESSIONAL_TEMPLATE_VERSION = 'professional-v1' as const;
export type ProfessionalReportTemplateId = typeof DAON_DETAIL_MASTER_TEMPLATE_ID | typeof LEGACY_PROFESSIONAL_TEMPLATE_ID;
export type ProfessionalRenderer = 'legacy-professional' | 'legacy-daon-v1' | 'daon-v2' | 'daon-v3';
export function resolveProfessionalRenderer(input: { templateId?: string; templateVersion: string }): ProfessionalRenderer | null {
  const { templateId: id, templateVersion: version } = input;
  if (id && id !== DAON_DETAIL_MASTER_TEMPLATE_ID && id !== LEGACY_PROFESSIONAL_TEMPLATE_ID) return null;
  if ((!id || id === LEGACY_PROFESSIONAL_TEMPLATE_ID) && version === LEGACY_PROFESSIONAL_TEMPLATE_VERSION) return 'legacy-professional';
  if (!id || id === DAON_DETAIL_MASTER_TEMPLATE_ID) {
    if (version === DAON_DETAIL_MASTER_TEMPLATE_VERSION) return 'daon-v3';
    if (version === DAON_DETAIL_V2_TEMPLATE_VERSION) return 'daon-v2';
    if (version === DAON_DETAIL_V1_TEMPLATE_VERSION || version === DAON_DETAIL_MASTER_TEMPLATE_ID) return 'legacy-daon-v1';
  }
  return null;
}
export function isSupportedProfessionalTemplateId(value: string): value is ProfessionalReportTemplateId {
  return value === DAON_DETAIL_MASTER_TEMPLATE_ID || value === LEGACY_PROFESSIONAL_TEMPLATE_ID;
}
export function resolveProfessionalTemplate(input: { templateId?: string; templateVersion: string }): ProfessionalReportTemplateId | null {
  const renderer = resolveProfessionalRenderer(input);
  return renderer === 'legacy-professional' ? LEGACY_PROFESSIONAL_TEMPLATE_ID : renderer ? DAON_DETAIL_MASTER_TEMPLATE_ID : null;
}
