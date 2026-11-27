/*
 * 세무·법률 질의응답 시안 (2026-11-26, 루치오: "다온 세무 법률 음성으로 질문 가능하도록 해").
 * Design: https://claude.ai/artifact/DoHwHZkpK3cJaS7ViQNnAu — answers come from code (formulas) and archived
 * original text, never from a model's memory. This module only reads the question (topic, amounts,
 * years); the formulas live in ./calculators.ts and every rate there is marked 원문 대조 전 until checked.
 */

export type AdvisorTopic = 'brokerage-fee' | 'acquisition-tax' | 'capital-gains-tax' | 'rental-yield' | 'unsupported';

export const TOPIC_LABEL: Record<Exclude<AdvisorTopic, 'unsupported'>, string> = {
  'brokerage-fee': '중개보수',
  'acquisition-tax': '취득세',
  'capital-gains-tax': '양도소득세',
  'rental-yield': '임대 수익률',
};

export const EXAMPLE_QUESTIONS = [
  '41억 5천 상가건물 중개보수 상한은 얼마야?',
  '20억에 사서 10년 뒤 35억에 판 상가 양도세는?',
  '25억 상가 취득세는?',
  '30억 건물 보증금 3억 월세 1200만이면 수익률은?',
];

const UNIT: Array<[RegExp, number]> = [[/억/, 100_000_000], [/천만/, 10_000_000], [/백만/, 1_000_000], [/만/, 10_000], [/천/, 10_000_000]];

/** "41억 5천" → 4_150_000_000. Reads 억 then the remainder; a bare 천 after 억 means 천만 (spoken style). */
export function parseKoreanAmount(text: string): number | null {
  const match = text.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*억(?:\s*(\d+(?:\.\d+)?)\s*(천만|천|백만|만))?|(\d+(?:\.\d+)?)\s*(천만|백만|만)\s*원?/);
  if (!match) return null;
  if (match[1]) {
    let total = Number(match[1]) * 100_000_000;
    if (match[2]) {
      const unit = match[3] ? UNIT.find(([re]) => re.test(match[3]))?.[1] ?? 10_000 : 10_000_000;
      total += Number(match[2]) * unit;
    }
    return Math.round(total);
  }
  const unit = UNIT.find(([re]) => re.test(match[5]))?.[1] ?? 1;
  return Math.round(Number(match[4]) * unit);
}

export function classifyQuestion(text: string): AdvisorTopic {
  if (/중개\s*보수|중개\s*수수료|복비|수수료/.test(text)) return 'brokerage-fee';
  if (/취득세/.test(text)) return 'acquisition-tax';
  if (/양도/.test(text)) return 'capital-gains-tax';
  if (/수익률|임대\s*수익/.test(text)) return 'rental-yield';
  return 'unsupported';
}

export const won = (value: number) => {
  if (!value) return '0원';
  const sign = value < 0 ? '−' : '';
  const abs = Math.abs(value);
  const eok = Math.floor(abs / 100_000_000);
  const man = Math.floor((abs % 100_000_000) / 10_000);
  const rest = Math.round(abs % 10_000);
  const text = [eok ? `${eok.toLocaleString('ko-KR')}억` : '', man ? `${man.toLocaleString('ko-KR')}만` : '', rest ? rest.toLocaleString('ko-KR') : ''].filter(Boolean).join(' ');
  return `${sign}${text || abs.toLocaleString('ko-KR')}원`;
};

/** Every amount in the sentence, in order ("20억에 사서 35억에 팔면" → [20억, 35억]). */
export function parseAllAmounts(text: string): number[] {
  const out: number[] = [];
  const re = /(\d+(?:\.\d+)?)\s*억(?:\s*(\d+(?:\.\d+)?)\s*(천만|천|백만|만))?|(\d+(?:\.\d+)?)\s*(천만|백만|만)\s*원?/g;
  for (const match of text.replace(/,/g, '').matchAll(re)) {
    const value = parseKoreanAmount(match[0]);
    if (value) out.push(value);
  }
  return out;
}

export interface QuestionPrefill { topic: AdvisorTopic; amounts: number[]; years?: number; use?: 'non-housing' | 'housing' }

/** What the spoken question already told us; the calculator form fills these and asks for the rest. */
export function prefillFromQuestion(text: string): QuestionPrefill {
  const years = text.match(/(\d+)\s*년/);
  const use = /아파트|주택|집|빌라|오피스텔/.test(text) ? 'housing' : /상가|건물|빌딩|토지|땅|사무실|근생/.test(text) ? 'non-housing' : undefined;
  return { topic: classifyQuestion(text), amounts: parseAllAmounts(text), years: years ? Number(years[1]) : undefined, use };
}
