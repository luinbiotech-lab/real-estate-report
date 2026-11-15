import type { TrustGradeResult } from '../../domain/platform/trustGrade';

/** A–D trust grade chip. `grade` undefined = the Data Room could not be read: say so, never guess a grade. */
export default function TrustGradeBadge({ grade, size = 'small' }: { grade?: TrustGradeResult; size?: 'small' | 'large' }) {
  if (!grade) return <span className={`trust-grade-badge grade-none size-${size}`} title="자료실을 읽지 못해 등급을 계산하지 않았습니다."><b>–</b><span>등급 확인 불가</span></span>;
  return <span className={`trust-grade-badge grade-${grade.grade} size-${size}`} title={grade.hint} aria-label={`신뢰 등급 ${grade.grade} ${grade.label}`}>
    <b>{grade.grade}</b><span>{grade.label}</span>
  </span>;
}

/** Criteria behind a grade, each with its numbers, so nobody has to trust the letter alone. */
export function TrustCriteriaList({ grade }: { grade: TrustGradeResult }) {
  return <ul className="trust-criteria" aria-label="등급 기준">{grade.criteria.map((row) => <li key={row.key} className={row.met ? 'met' : 'unmet'}>
    <span aria-hidden="true">{row.met ? '✓' : '·'}</span><span>{row.label}</span><b>{row.value}</b>
  </li>)}</ul>;
}
