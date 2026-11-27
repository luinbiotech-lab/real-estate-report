// 세무·법률 질문 계산기 경계값 (2026-11-26, 루치오 시안 승인). Rates are 원문 대조 전; this locks the arithmetic and
// the "never guess" boundaries (multi-home housing, unsupported questions) so a later edit cannot silently change them.
import { readFileSync } from 'node:fs';
import { importTs } from './lib/ts-module-loader.mjs';

const calc = await importTs('src/domain/advisor/calculators.ts');
const ask = await importTs('src/domain/advisor/askAdvisor.ts');
let checks = 0;
const expect = (ok, message) => { checks += 1; if (!ok) throw new Error(message); };
const eq = (actual, expected, label) => expect(actual === expected, `${label}: expected ${expected}, got ${actual}`);

// 중개보수 (주택 외 0.9%)
eq(calc.brokerageFeeCap(4_150_000_000).total, 37_350_000, '중개보수 41.5억');

// 취득세
eq(calc.acquisitionTax({ price: 2_500_000_000, use: 'non-housing', homesAfter: 1, over85: false }).total, 115_000_000, '상가 취득세 25억 (4.6%)');
eq(calc.housingBaseRate(600_000_000), 0.01, '주택 6억 경계 1%');
eq(calc.housingBaseRate(750_000_000), 0.02, '주택 7.5억 2%');
eq(calc.housingBaseRate(900_000_000), 0.03, '주택 9억 경계 3%');
eq(calc.housingBaseRate(1_000_000_000), 0.03, '주택 10억 3%');
const multi = calc.acquisitionTax({ price: 800_000_000, use: 'housing', homesAfter: 2, over85: false });
// 루인 #86 RB-71e0384: 결과 없음은 0(세금 없음)이 아니라 null + 이유. 루치오 11/27: 지원 안 하는 경우는 '세무사 상담 필요'.
expect(multi.total === null && Boolean(multi.notComputableReason) && multi.notComputableKind === 'unsupported', '2주택 이상은 total=null·unsupported(세무사 상담 필요)와 이유를 돌려줘야 합니다.');

// 양도세 기본세율 구간 경계 (누진공제 연속성)
const brackets = [[14_000_000, 840_000], [50_000_000, 6_240_000], [88_000_000, 15_360_000], [150_000_000, 37_060_000], [300_000_000, 94_060_000], [500_000_000, 174_060_000], [1_000_000_000, 384_060_000]];
for (const [base, tax] of brackets) eq(calc.progressiveTax(base).tax, tax, `기본세율 과세표준 ${base}`);
eq(calc.progressiveTax(0).tax, 0, '과세표준 0');
const cgt = calc.capitalGainsTax({ buyPrice: 2e9, sellPrice: 3.5e9, expenses: 0, holdingYears: 10 });
eq(cgt.lines.find((l) => l.label.startsWith('과세표준')).value, 1_197_500_000, '양도세 과세표준 (장특 20%, 기본공제 250만)');
eq(cgt.total, 520_228_500, '양도세+지방소득세');
eq(calc.capitalGainsTax({ buyPrice: 1e9, sellPrice: 1.1e9, expenses: 0, holdingYears: 0 }).lines.find((l) => l.label === '양도소득세').value, 48_750_000, '1년 미만 50%');
eq(calc.capitalGainsTax({ buyPrice: 1e9, sellPrice: 1.1e9, expenses: 0, holdingYears: 1 }).lines.find((l) => l.label === '양도소득세').value, 39_000_000, '2년 미만 40%');
eq(calc.capitalGainsTax({ buyPrice: 1e9, sellPrice: 9e8, expenses: 0, holdingYears: 5 }).total, 0, '양도차손 0');
eq(calc.capitalGainsTax({ buyPrice: 1e9, sellPrice: 2e9, expenses: 0, holdingYears: 20 }).lines[1].value, 300_000_000, '장특 최대 30%');

// 수익률
eq(calc.rentalYield({ price: 3e9, deposit: 3e8, monthlyRent: 1.2e7, monthlyCost: 0, vacancyMonths: 0, loan: 0, loanRatePercent: 4.5 }).total, 5.33, '수익률 30억/보증금 3억/월 1200만');

// 질문 해석
expect(JSON.stringify(ask.parseAllAmounts('20억에 사서 10년 뒤 35억에 판')) === '[2000000000,3500000000]', '금액 2개 해석');
expect(JSON.stringify(ask.parseAllAmounts('20억 10년')) === '[2000000000]', '"10년"을 금액으로 읽으면 안 됩니다.');
eq(ask.parseKoreanAmount('41억 5천'), 4_150_000_000, '41억 5천');
eq(ask.classifyQuestion('오늘 날씨 어때'), 'unsupported', '관련 없는 질문');

// 음수·NaN·무한대·범위 밖 입력 → 입력 확인 (0으로 대체 금지)
const bad = [
  ['중개보수 음수', calc.brokerageFeeCap(-1)],
  ['중개보수 NaN', calc.brokerageFeeCap(Number.NaN)],
  ['취득세 무한대', calc.acquisitionTax({ price: Infinity, use: 'non-housing', homesAfter: 1, over85: false })],
  ['취득세 주택 수 음수', calc.acquisitionTax({ price: 5e8, use: 'housing', homesAfter: -1, over85: false })],
  ['양도세 취득가 음수', calc.capitalGainsTax({ buyPrice: -1, sellPrice: 1e9, expenses: 0, holdingYears: 3 })],
  ['양도세 보유기간 NaN', calc.capitalGainsTax({ buyPrice: 1e9, sellPrice: 2e9, expenses: 0, holdingYears: Number.NaN })],
  ['양도세 필요경비 음수', calc.capitalGainsTax({ buyPrice: 1e9, sellPrice: 2e9, expenses: -5, holdingYears: 3 })],
  ['수익률 공실 13개월', calc.rentalYield({ price: 3e9, deposit: 0, monthlyRent: 1e7, monthlyCost: 0, vacancyMonths: 13, loan: 0, loanRatePercent: 4 })],
  ['수익률 실투자금 0', calc.rentalYield({ price: 3e9, deposit: 1e9, monthlyRent: 1e7, monthlyCost: 0, vacancyMonths: 0, loan: 2e9, loanRatePercent: 4 })],
  ['수익률 금리 NaN', calc.rentalYield({ price: 3e9, deposit: 0, monthlyRent: 1e7, monthlyCost: 0, vacancyMonths: 0, loan: 0, loanRatePercent: Number.NaN })],
];
for (const [label, r] of bad) expect(r.total === null && r.notComputableKind === 'input' && typeof r.notComputableReason === 'string' && r.notComputableReason.length > 0, `${label}: 입력 확인(null·input)과 이유가 필요합니다.`);
eq(calc.capitalGainsTax({ buyPrice: -1, sellPrice: 1e9, expenses: 0, holdingYears: 3 }).notComputableReason, '취득가는 0 이상으로 입력해 주세요.', '조사 은/는(받침 없음)');
eq(calc.brokerageFeeCap(-1).notComputableReason, '거래 금액은 0 이상으로 입력해 주세요.', '조사 은/는(받침 있음)');
// 경계: 0원 거래·0년 보유는 정상 계산
eq(calc.brokerageFeeCap(0).total, 0, '중개보수 0원');
eq(calc.capitalGainsTax({ buyPrice: 1e9, sellPrice: 1e9, expenses: 0, holdingYears: 0 }).total, 0, '양도차익 0');
eq(calc.capitalGainsTax({ buyPrice: 1e9, sellPrice: 2e9, expenses: 0, holdingYears: 2 }).lines[1].value, 0, '보유 2년 장특 0%');
eq(calc.capitalGainsTax({ buyPrice: 1e9, sellPrice: 2e9, expenses: 0, holdingYears: 3 }).lines[1].value, 60_000_000, '보유 3년 장특 6%');

// 세율 상태: 원문 대조 전 세율은 unverified, 수익률만 formula
for (const r of [calc.brokerageFeeCap(1e9), calc.acquisitionTax({ price: 1e9, use: 'non-housing', homesAfter: 1, over85: false }), cgt]) eq(r.rateStatus, 'unverified', `${r.title} rateStatus`);
eq(calc.rentalYield({ price: 3e9, deposit: 0, monthlyRent: 1e7, monthlyCost: 0, vacancyMonths: 0, loan: 0, loanRatePercent: 0 }).rateStatus, 'formula', '수익률 rateStatus');
for (const [key, source] of Object.entries(calc.RATE_SOURCES)) expect(source.status !== 'verified' || /\d{4}/.test(source.effective), `${key}: verified로 바꾸려면 시행일을 적어야 합니다.`);

// 모든 결과는 미검증 표시
for (const r of [cgt, multi]) expect(r.verified === false && r.basis.every((b) => b.includes('원문 대조 전')), '결과는 원문 대조 전으로 표시해야 합니다.');
const page = readFileSync('src/pages/AskPage.tsx', 'utf8');
for (const marker of ['원문 대조 전', '참고용 계산입니다', '개인정보는 말하지 마세요', '검증 전 시험 계산 · 세무 판단과 고객 안내에 쓰지 마세요', '시험 계산값 보기', '금액을 안내하지 않습니다', '미입력', '입력 확인', '세무사 상담 필요']) expect(page.includes(marker), `AskPage 표시 누락: ${marker}`);
// Unverified amounts must not be spoken: the spoken text for 'unverified' must not interpolate won(...).
// 루치오 11/27: 화면·음성에 '계산 불가'처럼 부정적 표현을 쓰지 않음.
for (const word of ['계산 불가', '계산할 수 없습니다']) expect(!page.includes(word) && !JSON.stringify(bad.map(([, r]) => r.notComputableReason)).includes(word) && !multi.notComputableReason.includes(word), `부정 표현 금지: ${word}`);
const spoken = page.slice(page.indexOf('const spokenSummary'), page.indexOf('};', page.indexOf('const spokenSummary')));
const unverifiedLine = spoken.split('\n').find((line) => line.includes("rateStatus === 'unverified'"));
expect(Boolean(unverifiedLine) && !unverifiedLine.includes('won('), '원문 대조 전 금액을 음성으로 읽으면 안 됩니다.');

console.log(`Advisor calculators validation: PASS (${checks} checks)`);
