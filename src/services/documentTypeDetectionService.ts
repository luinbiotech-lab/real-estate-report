import type { DocumentType } from '../domain/propertyDataRoom/types';

const CONTENT_RULES: Array<{ type: DocumentType; patterns: RegExp[] }> = [
  { type: 'building_register', patterns: [/건축물대장/i, /일반건축물대장/i, /총괄표제부/i, /건축물현황/i] },
  { type: 'land_register', patterns: [/토지대장/i, /토지표시/i, /지목\s*면적/i] },
  { type: 'land_use_plan', patterns: [/토지이용계획확인서/i, /지역지구등 지정여부/i, /국토의 계획 및 이용에 관한 법률/i] },
  { type: 'registry', patterns: [/등기사항전부증명서/i, /표제부/i, /갑구/i, /을구/i] },
  { type: 'cadastral_map', patterns: [/지적도/i, /임야도/i, /축척/i] },
  { type: 'lease_status', patterns: [/임대차현황/i, /보증금/i, /차임/i, /점유현황/i] },
  { type: 'appraisal', patterns: [/감정평가서/i, /감정평가액/i, /평가목적/i] },
  { type: 'contract', patterns: [/부동산매매계약서/i, /매매대금/i, /계약금/i] },
  { type: 'financial', patterns: [/손익계산서/i, /재무상태표/i, /매출액/i] },
  { type: 'development', patterns: [/정비계획/i, /개발계획/i, /도시관리계획/i] },
  { type: 'due_diligence', patterns: [/실사보고서/i, /due\s*diligence/i] },
  { type: 'floor_plan', patterns: [/평면도/i, /배치도/i, /floor\s*plan/i] },
];

export const documentTypeDetectionService = {
  detect(text: string, fallback: DocumentType = 'other'): DocumentType {
    const normalized = text.replace(/\s+/g, ' ');
    let best: { type: DocumentType; score: number } | undefined;
    for (const rule of CONTENT_RULES) {
      const score = rule.patterns.reduce((count, pattern) => count + (pattern.test(normalized) ? 1 : 0), 0);
      if (!score) continue;
      if (!best || score > best.score) best = { type: rule.type, score };
    }
    return best?.type ?? fallback;
  },
};
