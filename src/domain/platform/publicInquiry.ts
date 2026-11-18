/* Buyer inquiry input rules (phase 2, 2026-11-18). Same limits as the public_listing_inquiries CHECK constraints. */
export type InquiryKind = 'inquiry' | 'report_request';

export interface InquiryInput {
  kind: InquiryKind;
  name: string;
  contact: string;
  message: string;
  consent: boolean;
}

export const INQUIRY_LIMITS = { name: 40, contactMin: 5, contact: 80, message: 1000 } as const;

/** Same limits as the database CHECK constraints, so the form explains a refusal before the server does. */
export function inquiryProblems(input: InquiryInput): string[] {
  const problems: string[] = [];
  const name = input.name.trim();
  const contact = input.contact.trim();
  if (!name) problems.push('이름을 입력해 주세요.');
  if (name.length > INQUIRY_LIMITS.name) problems.push(`이름은 ${INQUIRY_LIMITS.name}자까지 입력할 수 있습니다.`);
  if (contact.length < INQUIRY_LIMITS.contactMin) problems.push('연락받을 전화번호나 이메일을 입력해 주세요.');
  if (contact.length > INQUIRY_LIMITS.contact) problems.push(`연락처는 ${INQUIRY_LIMITS.contact}자까지 입력할 수 있습니다.`);
  if (input.message.length > INQUIRY_LIMITS.message) problems.push(`내용은 ${INQUIRY_LIMITS.message}자까지 입력할 수 있습니다.`);
  if (!input.consent) problems.push('개인정보 수집·이용에 동의해야 문의를 보낼 수 있습니다.');
  return problems;
}

