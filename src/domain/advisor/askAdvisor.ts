/*
 * 세무·법률 질의응답 시안 (2026-11-26, 루치오: "다온 세무 법률 음성으로 질문 가능하도록 해").
 * Design: https://claude.ai/artifact/DoHwHZkpK3cJaS7ViQNnAu — answers come from code (formulas) and archived
 * original text, never from a model's memory. This draft wires only the question flow; every rate below is a
 * placeholder marked unverified until the statute text is checked (원문 대조 전), and the UI says so.
 */

export type AdvisorTopic = 'brokerage-fee' | 'acquisition-tax' | 'capital-gains-tax' | 'rental-yield' | 'unsupported';

export interface AdvisorAnswer {
  topic: AdvisorTopic;
  title: string;
  /** Short spoken/written answer. */
  summary: string;
  /** Inputs the calculation used, shown so the user can check them. */
  inputs: Array<{ label: string; value: string }>;
  /** Missing inputs the agent must ask for before answering. */
  needs: string[];
  basis: string[];
  verified: false;
}

export const TOPIC_LABEL: Record<Exclude<AdvisorTopic, 'unsupported'>, string> = {
  'brokerage-fee': '중개보수',
  'acquisition-tax': '취득세',
  'capital-gains-tax': '양도소득세',
  'rental-yield': '임대 수익률',
};

export const EXAMPLE_QUESTIONS = [
  '41억 5천 상가건물 중개보수 상한은 얼마야?',
  '상업용 건물 취득세는 어떻게 계산해?',
  '10년 보유한 건물 팔면 양도세는?',
];

const UNIT: Array<[RegExp, number]> = [[/억/, 100_000_000], [/천만/, 10_000_000], [/백만/, 1_000_000], [/만/, 10_000], [/천/, 10_000_000]];

/** "41억 5천" → 4_150_000_000. Reads 억 then the remainder; a bare 천 after 억 means 천만 (spoken style). */
export function parseKoreanAmount(text: string): number | null {
  const match = text.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*억(?:\s*(\d+(?:\.\d+)?)\s*(천만|천|백만|만)?)?|(\d+(?:\.\d+)?)\s*(천만|백만|만)\s*원?/);
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

const won = (value: number) => {
  const eok = Math.floor(value / 100_000_000);
  const man = Math.round((value % 100_000_000) / 10_000);
  return [eok ? `${eok.toLocaleString('ko-KR')}억` : '', man ? `${man.toLocaleString('ko-KR')}만` : ''].filter(Boolean).join(' ') + '원';
};

const DISCLAIMER = '참고용 계산입니다. 신고·계약 전에는 세무사·변호사 확인이 필요합니다.';

/** Placeholder rate for non-housing brokerage (원문 대조 전). */
const NON_HOUSING_FEE_CAP = 0.009;

export function answerQuestion(text: string): AdvisorAnswer {
  const topic = classifyQuestion(text);
  const amount = parseKoreanAmount(text);
  if (topic === 'brokerage-fee') {
    if (!amount) return { topic, title: '중개보수 상한', summary: '거래 금액을 알려 주시면 상한을 계산하겠습니다. 예: "41억 5천".', inputs: [], needs: ['거래 금액'], basis: ['공인중개사법 시행규칙 중개보수 요율(원문 연결 예정)'], verified: false };
    const cap = Math.floor(amount * NON_HOUSING_FEE_CAP);
    return {
      topic,
      title: '중개보수 상한',
      summary: `주택이 아닌 건물 ${won(amount)} 매매라면, 중개보수 상한은 거래금액의 ${(NON_HOUSING_FEE_CAP * 100).toFixed(1)}%인 ${cap.toLocaleString('ko-KR')}원입니다. 실제 요율은 이 범위 안에서 협의합니다. 부가가치세는 별도입니다. ${DISCLAIMER}`,
      inputs: [{ label: '거래 금액', value: won(amount) }, { label: '건물 종류', value: '주택 외(상업용)' }, { label: '상한 요율', value: `${(NON_HOUSING_FEE_CAP * 100).toFixed(1)}% (원문 대조 전)` }],
      needs: [],
      basis: ['공인중개사법 시행규칙 중개보수 요율 — 원문 연결 예정'],
      verified: false,
    };
  }
  if (topic === 'unsupported') return { topic, title: '아직 답할 수 없는 질문', summary: `지금은 ${Object.values(TOPIC_LABEL).join('·')} 질문만 준비하고 있습니다. 개별 사건 판단이나 신고서 작성은 전문가 연결로 안내합니다.`, inputs: [], needs: [], basis: [], verified: false };
  return { topic, title: TOPIC_LABEL[topic], summary: `${TOPIC_LABEL[topic]} 계산기는 다음 단계에서 만듭니다. 필요한 값: ${topic === 'acquisition-tax' ? '취득가, 용도, 지역' : topic === 'capital-gains-tax' ? '취득가, 양도가, 보유 기간, 필요경비' : '임대료, 관리비, 공실'}.`, inputs: [], needs: [], basis: [], verified: false };
}
