/*
 * Public listing rules (2026-11-15 platform upgrade). What a buyer may see of a property, and how each value is marked.
 * - Address is shown only to the level the broker chooses (구 / 동·도로명 / 전체). Default: 동·도로명 (no lot or building number).
 * - Every value carries a badge: 공식확인 (a verified field record exists), 중개사 입력, 계산값. Missing values are not shown as
 *   values; they are listed as "확인 중" so the page never implies a fact that is not there.
 * Pure functions: the validator and the page share them.
 */
import type { Property } from '../../types';
import { formatWon } from '../../utils/format';
import { hubFactRows } from '../propertyDetail/propertyDetailModel';

export type AddressLevel = 'gu' | 'dong' | 'full';

export const ADDRESS_LEVEL_LABEL: Record<AddressLevel, string> = {
  gu: '구까지',
  dong: '동·도로명까지',
  full: '전체 주소',
};

export const DEFAULT_ADDRESS_LEVEL: AddressLevel = 'dong';

/** Cut an address to the chosen level. Lot / building numbers are dropped below "full". */
export function maskAddress(address: string, level: AddressLevel): string {
  const text = String(address ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (level === 'full') return text;
  const tokens = text.split(' ');
  const guIndex = tokens.findIndex((token, index) => index > 0 && /[구군]$/.test(token));
  const cityIndex = guIndex >= 0 ? guIndex : tokens.findIndex((token, index) => index > 0 && /시$/.test(token));
  const base = cityIndex >= 0 ? tokens.slice(0, cityIndex + 1) : tokens.slice(0, 1);
  if (level === 'gu') return base.join(' ');
  const rest = tokens.slice(base.length);
  const dong = rest.find((token) => /[가-힣0-9]+(동|가|읍|면|리)$/.test(token) && !/^\d/.test(token));
  if (dong) return [...base, dong].join(' ');
  const road = rest.find((token) => /[가-힣0-9]+(로|길)$/.test(token));
  if (road) return [...base, road].join(' ');
  return base.join(' ');
}

export type FactBadge = 'verified' | 'input' | 'calculated';

export const FACT_BADGE_LABEL: Record<FactBadge, string> = {
  verified: '공식확인',
  input: '중개사 입력',
  calculated: '계산값',
};

export interface PublicFact {
  key: string;
  label: string;
  value: string;
  badge: FactBadge;
}

export interface PublicFacts {
  shown: PublicFact[];
  /** Labels of values not yet entered: shown as "확인 중", never as a value. */
  pending: string[];
}

const positive = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0;
const text = (value: unknown) => String(value ?? '').trim();

type FactSpec = { key: keyof Property; label: string; value: (p: Property) => string };

const FACT_SPECS: FactSpec[] = [
  { key: 'salePrice', label: '매매가', value: (p) => (positive(p.salePrice) ? formatWon(p.salePrice) : '') },
  { key: 'landAreaPyeong', label: '대지면적', value: (p) => (positive(p.landAreaPyeong) ? `${p.landAreaPyeong.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}평` : '') },
  { key: 'totalFloorAreaSqm', label: '연면적', value: (p) => (positive(p.totalFloorAreaSqm) ? `${p.totalFloorAreaSqm.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}㎡` : '') },
  { key: 'zoning', label: '용도지역', value: (p) => text(p.zoning) },
  { key: 'mainUse', label: '주용도', value: (p) => text(p.mainUse) },
  { key: 'structure', label: '구조', value: (p) => text(p.structure) },
  { key: 'groundFloors', label: '층수', value: (p) => (positive(p.groundFloors) ? `지하 ${p.basementFloors || 0}층 · 지상 ${p.groundFloors}층` : '') },
  { key: 'completionDate', label: '사용승인일', value: (p) => text(p.completionDate) },
  { key: 'nearbyStation', label: '인근역', value: (p) => [text(p.nearbyStation), text(p.stationDistance)].filter(Boolean).join(' · ') },
  { key: 'roadCondition', label: '도로 조건', value: (p) => text(p.roadCondition) },
];

/** Values a buyer sees, each with its badge. `verifiedFieldKeys` = fields with a verified field record in the Data Room. */
export function publicFacts(property: Property, verifiedFieldKeys: ReadonlySet<string>): PublicFacts {
  const shown: PublicFact[] = [];
  const pending: string[] = [];
  for (const spec of FACT_SPECS) {
    const value = spec.value(property);
    if (!value) { pending.push(spec.label); continue; }
    shown.push({ key: String(spec.key), label: spec.label, value, badge: verifiedFieldKeys.has(String(spec.key)) ? 'verified' : 'input' });
  }
  if (positive(property.salePrice) && positive(property.landAreaPyeong)) {
    const perPyeong = Math.round(property.salePrice / property.landAreaPyeong / 10000);
    shown.splice(2, 0, { key: 'unitPrice', label: '대지 평당가', value: `${perPyeong.toLocaleString('ko-KR')}만 원/평`, badge: 'calculated' });
  }
  return { shown, pending };
}

/** Core facts entered, for the trust grade: the same rows as the 근거 · 신뢰도 panel's '기본정보 입력' (one number everywhere). */
export function factCompleteness(property: Partial<Property>) {
  const rows = hubFactRows(property);
  return { filled: rows.filter((row) => !row.missing).length, total: rows.length };
}

export type PriceBand = 'all' | 'lt30' | '30to50' | '50to100' | 'gte100';

export const PRICE_BAND_LABEL: Record<PriceBand, string> = {
  all: '가격 전체',
  lt30: '30억 미만',
  '30to50': '30억~50억',
  '50to100': '50억~100억',
  gte100: '100억 이상',
};

const EOK = 100_000_000;

export function inPriceBand(price: number, band: PriceBand) {
  if (band === 'all') return true;
  if (!positive(price)) return false;
  if (band === 'lt30') return price < 30 * EOK;
  if (band === '30to50') return price >= 30 * EOK && price < 50 * EOK;
  if (band === '50to100') return price >= 50 * EOK && price < 100 * EOK;
  return price >= 100 * EOK;
}
