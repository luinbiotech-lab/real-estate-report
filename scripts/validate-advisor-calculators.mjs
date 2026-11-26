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
expect(multi.total === 0 && multi.notCovered.length > 0, '2주택 이상은 계산하지 않고 notCovered로 안내해야 합니다.');

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

// 모든 결과는 미검증 표시
for (const r of [cgt, multi]) expect(r.verified === false && r.basis.every((b) => b.includes('원문 대조 전')), '결과는 원문 대조 전으로 표시해야 합니다.');
const page = readFileSync('src/pages/AskPage.tsx', 'utf8');
for (const marker of ['원문 대조 전', '참고용 계산입니다', '개인정보는 말하지 마세요']) expect(page.includes(marker), `AskPage 표시 누락: ${marker}`);

console.log(`Advisor calculators validation: PASS (${checks} checks)`);
