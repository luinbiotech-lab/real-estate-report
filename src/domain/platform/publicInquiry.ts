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


/* Staff inbox (2026-11-24, pilot readiness): what a broker sees of a received inquiry. */
export type InquiryStatus = 'new' | 'answered' | 'closed';
export const INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = { new: '새 문의', answered: '답변함', closed: '종료' };
export const INQUIRY_KIND_LABEL: Record<InquiryKind, string> = { inquiry: '매물 문의', report_request: '투자 보고서 요청' };

export interface ReceivedInquiry {
  id: string;
  publicListingId: string;
  kind: InquiryKind;
  name: string;
  /** null once the retention job erased it (90 days after receipt). */
  contact: string | null;
  message: string;
  status: InquiryStatus;
  createdAt: string;
  consentAt: string;
  /** From the staff-readable listing row; absent when the listing was removed. */
  propertyId?: string;
  listingTitle?: string;
}

/** tel: / mailto: link for a contact value, or undefined when it is neither. */
export function contactHref(contact: string | null | undefined): string | undefined {
  const value = (contact ?? '').trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `mailto:${value}`;
  const digits = value.replace(/[^\d+]/g, '');
  if (/^\+?\d{8,15}$/.test(digits)) return `tel:${digits}`;
  return undefined;
}

/** New first, then newest received. */
export function sortInquiries(rows: ReceivedInquiry[]): ReceivedInquiry[] {
  const rank: Record<InquiryStatus, number> = { new: 0, answered: 1, closed: 2 };
  return [...rows].sort((a, b) => rank[a.status] - rank[b.status] || b.createdAt.localeCompare(a.createdAt));
}
