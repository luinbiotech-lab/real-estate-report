/* Pure rule for one-step registration from an address lookup (kept free of storage imports so validators can run it). */

/** Refuses when the lookup could not be matched against the register safely; a person must choose instead. */
export function quickCreateBlockReason(input: { result?: { address?: unknown }; matchCount: number; matchError: string; matchChecked: boolean }) {
  if (!input.result?.address) return '주소를 먼저 확인하세요.';
  if (input.matchError) return '등록 물건과 대조하지 못해 중복 여부를 알 수 없습니다.';
  if (!input.matchChecked) return '등록 물건과 대조하는 중입니다.';
  if (input.matchCount > 0) return '같은 주소로 등록된 물건이 있습니다.';
  return '';
}
