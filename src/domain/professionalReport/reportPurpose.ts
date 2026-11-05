/*
 * Report purpose (owner decision 2026-11-05, after Luin / multi-model review of the Yeouido test): every report used to
 * print "전속매각 / EXCLUSIVE SALE" even for an analysis-only building, which reads as a listing the broker holds a
 * mandate for. The purpose is chosen per property; the default stays the exclusive-sale wording of the approved MASTER.
 */
export type ReportPurpose = 'exclusive_sale' | 'analysis';

export interface ReportPurposeWording {
  titlePrefix: string; heroTag: string; pageTag: string; contactCta: string; footerNote: string; coverTag: string;
}

const WORDING: Record<ReportPurpose, ReportPurposeWording> = {
  exclusive_sale: {
    titlePrefix: '전속매각', heroTag: 'EXCLUSIVE SALE', pageTag: 'EXCLUSIVE SALE REPORT', contactCta: '전속매각 문의',
    footerNote: '본 자료는 매각 검토용 요약자료이며 계약 전 권리관계 및 현장 재확인이 필요합니다.', coverTag: '전속매각',
  },
  analysis: {
    titlePrefix: '분석 보고서', heroTag: 'ANALYSIS REPORT', pageTag: 'ANALYSIS REPORT', contactCta: '문의',
    footerNote: '본 자료는 공개 자료 기반 분석 자료이며 매물 정보가 아닙니다. 권리관계와 현장은 별도 확인이 필요합니다.', coverTag: '분석 보고서',
  },
};

export function reportPurposeOf(value: unknown): ReportPurpose {
  return value === 'analysis' ? 'analysis' : 'exclusive_sale';
}

export function reportWording(value: unknown): ReportPurposeWording {
  return WORDING[reportPurposeOf(value)];
}
