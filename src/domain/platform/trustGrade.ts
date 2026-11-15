/*
 * Trust grade (2026-11-15 platform upgrade, 루치오: "다온을 부동산플랫폼으로 격상").
 * Every listing carries an A–D grade computed only from what the Data Room actually holds: core facts filled,
 * required official documents present / officially confirmed, and open verification candidates. The grade is
 * explainable (each criterion is listed with its numbers) and never raised by automation: candidates count
 * against A until a person decides them, and nothing is inferred from missing data.
 */

export type TrustGrade = 'A' | 'B' | 'C' | 'D';

export const TRUST_GRADES: readonly TrustGrade[] = ['A', 'B', 'C', 'D'];

export const TRUST_GRADE_LABEL: Record<TrustGrade, string> = {
  A: '검증 완료',
  B: '근거 확보',
  C: '기본 정보',
  D: '확인 필요',
};

export const TRUST_GRADE_HINT: Record<TrustGrade, string> = {
  A: '필수 공적서류가 모두 공식확인됐고, 검토할 후보값이 없습니다.',
  B: '필수 공적서류 원본이 대부분 붙어 있지만, 공식확인이 끝나지 않았습니다.',
  C: '기본 정보는 입력됐지만, 공적서류 근거가 부족합니다.',
  D: '기본 정보부터 부족합니다. 숫자를 그대로 믿기 어렵습니다.',
};

export interface TrustGradeInput {
  factsFilled: number;
  factsTotal: number;
  requiredSourcePresent: number;
  requiredOfficiallyVerified: number;
  requiredDocumentTotal: number;
  verificationPending: number;
}

export interface TrustCriterion {
  key: 'facts' | 'sources' | 'official' | 'pending';
  label: string;
  value: string;
  met: boolean;
}

export interface TrustGradeResult {
  grade: TrustGrade;
  label: string;
  hint: string;
  criteria: TrustCriterion[];
}

const ratio = (done: number, total: number) => (total > 0 ? done / total : 0);

export function trustGrade(input: TrustGradeInput): TrustGradeResult {
  const facts = ratio(input.factsFilled, input.factsTotal);
  const total = input.requiredDocumentTotal;
  const allOfficial = total > 0 && input.requiredOfficiallyVerified >= total;
  const mostSources = total > 0 && input.requiredSourcePresent >= total - 1;
  const noPending = input.verificationPending === 0;

  let grade: TrustGrade = 'D';
  if (facts >= 0.9 && allOfficial && noPending) grade = 'A';
  else if (facts >= 0.7 && mostSources) grade = 'B';
  else if (facts >= 0.5) grade = 'C';

  const criteria: TrustCriterion[] = [
    { key: 'facts', label: '기본 정보', value: `${input.factsFilled}/${input.factsTotal}`, met: facts >= 0.9 },
    { key: 'sources', label: '필수 공적서류 원본', value: `${input.requiredSourcePresent}/${total}`, met: total > 0 && input.requiredSourcePresent >= total },
    { key: 'official', label: '필수 공적서류 공식확인', value: `${input.requiredOfficiallyVerified}/${total}`, met: allOfficial },
    { key: 'pending', label: '검토 대기 후보값', value: noPending ? '없음' : `${input.verificationPending}건`, met: noPending },
  ];
  return { grade, label: TRUST_GRADE_LABEL[grade], hint: TRUST_GRADE_HINT[grade], criteria };
}

/** Grade ordering for filters ("B 이상" = A or B). */
export function gradeAtLeast(grade: TrustGrade, minimum: TrustGrade) {
  return TRUST_GRADES.indexOf(grade) <= TRUST_GRADES.indexOf(minimum);
}
