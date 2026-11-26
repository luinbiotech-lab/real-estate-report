/*
 * 세무·임대 계산기 (2026-11-26, 루치오 시안 승인 "시안대로 진행").
 * Every rate below is written from the statute as commonly published and is marked 원문 대조 전 (not yet checked
 * against the archived original text). The UI shows that label and a disclaimer on every result. Cases these
 * formulas do not cover (multi-home surcharge, regulated areas, 1세대1주택 exemption, etc.) are returned as `notCovered`
 * instead of being guessed.
 */

export interface CalcLine { label: string; value: number; note?: string }
export interface CalcResult {
  title: string;
  /** Total the user asked for (tax or yield, see unit). */
  total: number;
  unit: 'KRW' | 'PERCENT';
  lines: CalcLine[];
  notCovered: string[];
  basis: string[];
  verified: false;
}

const pct = (value: number) => Math.round(value * 10_000) / 100;

/* ---------- 중개보수 ---------- */
/** 주택 외 매매·교환 상한 0.9% (공인중개사법 시행규칙 제20조 제4항, 원문 대조 전). */
export const NON_HOUSING_BROKERAGE_CAP = 0.009;

export function brokerageFeeCap(price: number): CalcResult {
  const cap = Math.floor(price * NON_HOUSING_BROKERAGE_CAP);
  return {
    title: '중개보수 상한 (주택 외 매매)',
    total: cap,
    unit: 'KRW',
    lines: [{ label: '거래 금액', value: price }, { label: `상한 ${pct(NON_HOUSING_BROKERAGE_CAP)}%`, value: cap, note: '이 범위 안에서 협의' }],
    notCovered: ['주택 매매·임대차 요율', '부가가치세(별도)'],
    basis: ['공인중개사법 시행규칙 제20조 제4항 — 원문 대조 전'],
    verified: false,
  };
}

/* ---------- 취득세 ---------- */
export interface AcquisitionInput { price: number; use: 'non-housing' | 'housing'; homesAfter: number; over85: boolean }

/** 1주택 유상취득 본세율: 6억 이하 1%, 6억~9억 (가액×2/3억 − 3)%, 9억 초과 3%. */
export function housingBaseRate(price: number): number {
  const eok = price / 100_000_000;
  if (eok <= 6) return 0.01;
  if (eok <= 9) return Math.round(((eok * 2) / 3 - 3) * 100) / 10_000;
  return 0.03;
}

export function acquisitionTax(input: AcquisitionInput): CalcResult {
  const { price } = input;
  if (input.use === 'non-housing') {
    const base = Math.floor(price * 0.04);
    const edu = Math.floor(price * 0.004);
    const rural = Math.floor(price * 0.002);
    return {
      title: '취득세 (주택 외 건물·토지 매매)',
      total: base + edu + rural,
      unit: 'KRW',
      lines: [{ label: '취득가', value: price }, { label: '취득세 4%', value: base }, { label: '지방교육세 0.4%', value: edu }, { label: '농어촌특별세 0.2%', value: rural }],
      notCovered: ['과밀억제권역 안 본점·공장 중과', '농지', '감면 대상'],
      basis: ['지방세법 제11조 제1항 제7호 나목 — 원문 대조 전', '지방세법 제151조(지방교육세), 농어촌특별세법 제5조 — 원문 대조 전'],
      verified: false,
    };
  }
  const notCovered = ['조정대상지역·다주택 중과 세율', '생애최초 등 감면'];
  if (input.homesAfter > 1) {
    return { title: '취득세 (주택)', total: 0, unit: 'KRW', lines: [{ label: '취득가', value: price }], notCovered: ['취득 후 2주택 이상: 지역·주택 수에 따라 중과 세율이 달라 계산하지 않습니다. 세무사 확인이 필요합니다.'], basis: ['지방세법 제13조의2 — 원문 대조 전'], verified: false };
  }
  const rate = housingBaseRate(price);
  const base = Math.floor(price * rate);
  const edu = Math.floor(base * 0.1);
  const rural = input.over85 ? Math.floor(price * 0.002) : 0;
  return {
    title: '취득세 (1주택 매매)',
    total: base + edu + rural,
    unit: 'KRW',
    lines: [
      { label: '취득가', value: price },
      { label: `취득세 ${pct(rate)}%`, value: base },
      { label: '지방교육세 (취득세의 10%)', value: edu },
      { label: '농어촌특별세 0.2%', value: rural, note: input.over85 ? '전용 85㎡ 초과' : '전용 85㎡ 이하 비과세' },
    ],
    notCovered,
    basis: ['지방세법 제11조 제1항 제8호 — 원문 대조 전'],
    verified: false,
  };
}

/* ---------- 양도소득세 (토지·건물, 주택 외) ---------- */
export interface CapitalGainsInput { buyPrice: number; sellPrice: number; expenses: number; holdingYears: number }

/** 소득세법 제55조 기본세율 (2023년 이후 양도분), [상한, 세율, 누진공제]. */
const BRACKETS: Array<[number, number, number]> = [
  [14_000_000, 0.06, 0],
  [50_000_000, 0.15, 1_260_000],
  [88_000_000, 0.24, 5_760_000],
  [150_000_000, 0.35, 15_440_000],
  [300_000_000, 0.38, 19_940_000],
  [500_000_000, 0.4, 25_940_000],
  [1_000_000_000, 0.42, 35_940_000],
  [Infinity, 0.45, 65_940_000],
];

export function progressiveTax(base: number): { tax: number; rate: number } {
  if (base <= 0) return { tax: 0, rate: 0 };
  const [, rate, deduction] = BRACKETS.find(([limit]) => base <= limit)!;
  return { tax: Math.max(0, Math.floor(base * rate - deduction)), rate };
}

export function capitalGainsTax(input: CapitalGainsInput): CalcResult {
  const gain = Math.max(0, input.sellPrice - input.buyPrice - input.expenses);
  const years = Math.max(0, Math.floor(input.holdingYears));
  const longTermRate = years >= 3 ? Math.min(years, 15) * 0.02 : 0;
  const longTerm = Math.floor(gain * longTermRate);
  const basicDeduction = gain > 0 ? Math.min(2_500_000, gain - longTerm) : 0;
  const taxBase = Math.max(0, gain - longTerm - basicDeduction);
  let tax: number;
  let rateNote: string;
  if (years < 1) { tax = Math.floor(taxBase * 0.5); rateNote = '1년 미만 보유 50%'; }
  else if (years < 2) { tax = Math.floor(taxBase * 0.4); rateNote = '2년 미만 보유 40%'; }
  else { const result = progressiveTax(taxBase); tax = result.tax; rateNote = `기본세율 (과세표준 구간 ${pct(result.rate)}%)`; }
  const local = Math.floor(tax * 0.1);
  return {
    title: '양도소득세 (주택 외 건물·토지)',
    total: tax + local,
    unit: 'KRW',
    lines: [
      { label: '양도차익', value: gain, note: '양도가 − 취득가 − 필요경비' },
      { label: `장기보유특별공제 ${pct(longTermRate)}%`, value: longTerm, note: '3년 이상 보유, 해마다 2% (최대 30%)' },
      { label: '기본공제', value: basicDeduction, note: '연 250만원' },
      { label: '과세표준', value: taxBase },
      { label: '양도소득세', value: tax, note: rateNote },
      { label: '지방소득세 (10%)', value: local },
    ],
    notCovered: ['주택 (1세대1주택 비과세·다주택 중과)', '비사업용 토지 중과', '미등기 양도', '같은 해 다른 양도와의 합산'],
    basis: ['소득세법 제95조(장기보유특별공제)·제103조(기본공제)·제104조(세율)·제55조 — 원문 대조 전'],
    verified: false,
  };
}

/* ---------- 임대 수익률 ---------- */
export interface YieldInput { price: number; deposit: number; monthlyRent: number; monthlyCost: number; vacancyMonths: number; loan: number; loanRatePercent: number }

export function rentalYield(input: YieldInput): CalcResult {
  const occupied = Math.min(12, Math.max(0, 12 - input.vacancyMonths));
  const rentIncome = input.monthlyRent * occupied;
  const cost = input.monthlyCost * 12;
  const interest = Math.floor(input.loan * (input.loanRatePercent / 100));
  const net = rentIncome - cost - interest;
  const equity = input.price - input.deposit - input.loan;
  const grossBase = input.price - input.deposit;
  const gross = grossBase > 0 ? (input.monthlyRent * 12) / grossBase : 0;
  const onEquity = equity > 0 ? net / equity : 0;
  return {
    title: '임대 수익률',
    total: pct(onEquity),
    unit: 'PERCENT',
    lines: [
      { label: '연 임대료 (공실 반영)', value: rentIncome, note: `${occupied}개월` },
      { label: '연 운영비', value: cost },
      { label: '연 대출이자', value: interest },
      { label: '연 순수익', value: net },
      { label: '실투자금', value: equity, note: '매입가 − 보증금 − 대출' },
      { label: '표면 수익률 (%)', value: pct(gross), note: '연 임대료 ÷ (매입가 − 보증금), 대출 미반영' },
    ],
    notCovered: ['취득세·중개보수 등 매입 부대비용', '세금', '임대료 상승·하락'],
    basis: ['단순 계산식 — 법령 근거 없음'],
    verified: false,
  };
}
