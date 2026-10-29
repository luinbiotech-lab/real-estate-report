import type { PropertyDocument, VerificationStatus } from '../propertyDataRoom/types';

/*
 * Document verification choices in the Data Room (2026-10-30 review).
 * The select used to offer every VerificationStatus, including system-only states (calculated, estimated, ai_analysis,
 * missing) that are meaningless for an uploaded document and would be misread downstream. A person may only mark a
 * document as one of these; a legacy value outside the list stays visible but cannot be re-selected.
 */
export const DOCUMENT_VERIFICATION_OPTIONS: readonly VerificationStatus[] = ['unverified', 'imported', 'confirmed', 'verified'];

export function documentVerificationOptions(current: VerificationStatus): VerificationStatus[] {
  return DOCUMENT_VERIFICATION_OPTIONS.includes(current) ? [...DOCUMENT_VERIFICATION_OPTIONS] : [current, ...DOCUMENT_VERIFICATION_OPTIONS];
}

/** Marking a document "공식 확인" gates report readiness, so it always needs an explicit human confirmation. */
export function requiresOfficialConfirmation(current: VerificationStatus, next: VerificationStatus) {
  return next === 'verified' && current !== 'verified';
}

export function applyDocumentVerification(document: PropertyDocument, next: VerificationStatus, now: string): PropertyDocument {
  if (!DOCUMENT_VERIFICATION_OPTIONS.includes(next)) throw new Error(`문서에 지정할 수 없는 검증 상태입니다: ${next}`);
  if (next === document.verificationStatus) return document;
  return {
    ...document,
    verificationStatus: next,
    // Keep the original verification time when it stays verified; clear it when downgraded.
    verifiedAt: next === 'verified' ? now : undefined,
    updatedAt: now,
  };
}
