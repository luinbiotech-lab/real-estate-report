import { useEffect, useMemo, useRef, useState } from 'react';
import { GavelRounded, MicRounded, SendRounded, StopRounded, VolumeUpRounded } from '@mui/icons-material';
import { EXAMPLE_QUESTIONS, prefillFromQuestion, TOPIC_LABEL, won, type AdvisorTopic } from '../domain/advisor/askAdvisor';
import { acquisitionTax, brokerageFeeCap, capitalGainsTax, rentalYield, type CalcResult } from '../domain/advisor/calculators';
import '../platform.css';

/*
 * 세무·법률 질문 (2026-11-26, 루치오 시안 승인). Voice in = the browser's own speech recognition (free; Chrome/Safari
 * send the audio to their vendor's server — said on screen). Voice out = speechSynthesis. No paid API.
 * The question only picks the calculator and pre-fills what it heard; the user sees and can correct every input.
 * `?demo=listening|answer` renders a fixed state for screenshots only.
 */

type Recognition = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onend: (() => void) | null; onerror: ((event: { error: string }) => void) | null };
type Topic = Exclude<AdvisorTopic, 'unsupported'>;

function createRecognition(): Recognition | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ko-KR';
  window.speechSynthesis.speak(utterance);
}

/** Form values in 만원 (what people say and type), converted to KRW for the formulas. */
interface Form { price: string; buy: string; sell: string; expenses: string; years: string; use: 'non-housing' | 'housing'; homesAfter: string; over85: boolean; deposit: string; rent: string; cost: string; vacancy: string; loan: string; loanRate: string }
const EMPTY: Form = { price: '', buy: '', sell: '', expenses: '0', years: '', use: 'non-housing', homesAfter: '1', over85: false, deposit: '0', rent: '', cost: '0', vacancy: '0', loan: '0', loanRate: '4.5' };
const man = (v: number) => String(Math.round(v / 10_000));
const krw = (v: string) => Math.round((Number(v.replace(/,/g, '')) || 0) * 10_000);
const num = (v: string) => Number(v.replace(/,/g, '')) || 0;

function applyQuestion(text: string, form: Form): { topic: Topic | null; form: Form } {
  const pre = prefillFromQuestion(text);
  if (pre.topic === 'unsupported') return { topic: null, form };
  const next = { ...form, ...(pre.use ? { use: pre.use } : {}) };
  const [a, b, c] = pre.amounts;
  if (pre.topic === 'capital-gains-tax') { if (a) next.buy = man(a); if (b) next.sell = man(b); }
  else if (pre.topic === 'rental-yield') { if (a) next.price = man(a); if (b) next.deposit = man(b); if (c) next.rent = man(c); }
  else if (a) next.price = man(a);
  if (pre.years !== undefined) next.years = String(pre.years);
  return { topic: pre.topic, form: next };
}

function compute(topic: Topic, f: Form): { result: CalcResult | null; missing: string[] } {
  const missing: string[] = [];
  if (topic === 'brokerage-fee' || topic === 'acquisition-tax') { if (!num(f.price)) missing.push('거래 금액'); }
  if (topic === 'capital-gains-tax') { if (!num(f.buy)) missing.push('취득가'); if (!num(f.sell)) missing.push('양도가'); if (f.years === '') missing.push('보유 기간'); }
  if (topic === 'rental-yield') { if (!num(f.price)) missing.push('매입가'); if (!num(f.rent)) missing.push('월 임대료'); }
  if (missing.length) return { result: null, missing };
  if (topic === 'brokerage-fee') return { result: brokerageFeeCap(krw(f.price)), missing };
  if (topic === 'acquisition-tax') return { result: acquisitionTax({ price: krw(f.price), use: f.use, homesAfter: num(f.homesAfter) || 1, over85: f.over85 }), missing };
  if (topic === 'capital-gains-tax') return { result: capitalGainsTax({ buyPrice: krw(f.buy), sellPrice: krw(f.sell), expenses: krw(f.expenses), holdingYears: num(f.years) }), missing };
  return { result: rentalYield({ price: krw(f.price), deposit: krw(f.deposit), monthlyRent: krw(f.rent), monthlyCost: krw(f.cost), vacancyMonths: num(f.vacancy), loan: krw(f.loan), loanRatePercent: num(f.loanRate) }), missing };
}

const spokenSummary = (r: CalcResult) => r.unit === 'PERCENT'
  ? `${r.title}은 실투자금 기준 연 ${r.total}퍼센트입니다. 참고용 계산입니다.`
  : r.total ? `${r.title}는 ${won(r.total)}입니다. 참고용 계산이며 신고 전에는 세무사 확인이 필요합니다.` : `${r.title}는 이 계산기로 계산하지 않는 경우입니다. 세무사 확인이 필요합니다.`;

export default function AskPage() {
  const demo = new URLSearchParams(window.location.search).get('demo');
  const initial = demo === 'answer' ? applyQuestion(EXAMPLE_QUESTIONS[1], EMPTY) : { topic: null, form: EMPTY };
  const [question, setQuestion] = useState(demo === 'answer' ? EXAMPLE_QUESTIONS[1] : demo === 'listening' ? '20억에 사서 10년 뒤' : '');
  const [listening, setListening] = useState(demo === 'listening');
  const [topic, setTopic] = useState<Topic | null>(initial.topic);
  const [form, setForm] = useState<Form>(initial.form);
  const [notice, setNotice] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const recognition = useRef<Recognition | null>(null);
  const supported = demo ? true : Boolean(createRecognition());
  const { result, missing } = useMemo(() => topic ? compute(topic, form) : { result: null, missing: [] as string[] }, [topic, form]);

  useEffect(() => () => { recognition.current?.stop(); window.speechSynthesis?.cancel(); }, []);

  const ask = (text: string, spoken = false) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const next = applyQuestion(trimmed, form);
    if (!next.topic) {
      setNotice(`지금은 ${Object.values(TOPIC_LABEL).join('·')} 질문만 계산합니다. 개별 사건 판단이나 신고서 작성은 전문가 확인이 필요합니다.`);
      if (spoken) speak('지금은 중개보수, 취득세, 양도세, 임대 수익률만 계산할 수 있습니다.');
      return;
    }
    setNotice(''); setTopic(next.topic); setForm(next.form);
    if (spoken) {
      const computed = compute(next.topic, next.form);
      speak(computed.result ? spokenSummary(computed.result) : `${TOPIC_LABEL[next.topic]}를 계산하려면 ${computed.missing.join(', ')}이 필요합니다. 아래 칸에 입력해 주세요.`);
    }
  };

  const toggleMic = () => {
    if (listening) { recognition.current?.stop(); return; }
    const rec = createRecognition();
    if (!rec) { setVoiceError('이 브라우저는 음성 입력을 지원하지 않습니다. 글로 입력해 주세요.'); return; }
    setVoiceError(''); setQuestion('');
    rec.lang = 'ko-KR'; rec.interimResults = true; rec.continuous = false;
    let finalText = '';
    rec.onresult = (event) => { finalText = Array.from(event.results).map((r) => r[0].transcript).join(''); setQuestion(finalText); };
    rec.onerror = (event) => setVoiceError(event.error === 'not-allowed' ? '마이크 사용이 허용되지 않았습니다. 브라우저 설정에서 마이크를 허용해 주세요.' : '음성을 알아듣지 못했습니다. 다시 눌러 말씀해 주세요.');
    rec.onend = () => { setListening(false); if (finalText) ask(finalText, true); };
    recognition.current = rec;
    setListening(true);
    rec.start();
  };

  const field = (key: keyof Form, label: string, suffix = '만원') => <label className="ask-field" key={key}>
    <span>{label}</span>
    <span className="ask-field-box"><input inputMode="decimal" value={String(form[key])} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /><em>{suffix}</em></span>
    {suffix === '만원' && num(String(form[key])) > 0 && <small>{won(krw(String(form[key])))}</small>}
  </label>;

  return <div className="ask-page">
    <header className="ask-hero">
      <p className="eyebrow">세무 · 법률 질문</p>
      <h1>말로 물어보세요</h1>
      <p>중개보수·취득세·양도세·임대 수익률을 계산해 근거와 함께 답합니다. 참고용이며, 신고·계약 전에는 전문가 확인이 필요합니다.</p>
    </header>

    <section className="ask-voice" aria-label="음성 질문">
      <button type="button" className={`ask-mic${listening ? ' on' : ''}`} onClick={toggleMic} aria-pressed={listening} aria-label={listening ? '듣기 멈추기' : '눌러서 말하기'} disabled={!supported}>
        {listening ? <StopRounded /> : <MicRounded />}
      </button>
      <p className="ask-mic-label">{listening ? '듣고 있습니다… 말을 마치면 자동으로 답합니다' : supported ? '눌러서 말하기' : '이 브라우저는 음성 입력 미지원'}</p>
      {listening && question && <p className="ask-heard">“{question}”</p>}
      {voiceError && <p className="ask-error" role="alert">{voiceError}</p>}
      <form className="ask-input" onSubmit={(event) => { event.preventDefault(); ask(question); }}>
        <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="또는 글로 입력: 예) 41억 상가 중개보수 상한은?" aria-label="질문" />
        <button type="submit" aria-label="질문 보내기"><SendRounded /></button>
      </form>
      <div className="ask-examples">{EXAMPLE_QUESTIONS.map((example) => <button type="button" key={example} onClick={() => { setQuestion(example); ask(example); }}>{example}</button>)}</div>
    </section>

    {notice && <p className="ask-needs" role="status">{notice}</p>}

    <nav className="ask-topics" aria-label="계산기 선택">
      {(Object.keys(TOPIC_LABEL) as Topic[]).map((key) => <button type="button" key={key} className={topic === key ? 'on' : ''} aria-pressed={topic === key} onClick={() => setTopic(key)}>{TOPIC_LABEL[key]}</button>)}
    </nav>

    {topic && <section className="ask-answer" aria-label="계산">
      <div className="ask-answer-head"><GavelRounded /><h2>{result?.title ?? TOPIC_LABEL[topic]}</h2><span className="ask-unverified">원문 대조 전</span>
        {result && <button type="button" className="ask-speak" onClick={() => speak(spokenSummary(result))}><VolumeUpRounded /> 읽어 주기</button>}</div>

      <div className="ask-form">
        {topic === 'brokerage-fee' && field('price', '거래 금액')}
        {topic === 'acquisition-tax' && <>
          {field('price', '취득가')}
          <label className="ask-field"><span>용도</span><select value={form.use} onChange={(e) => setForm({ ...form, use: e.target.value as Form['use'] })}><option value="non-housing">상가·건물·토지</option><option value="housing">주택</option></select></label>
          {form.use === 'housing' && <>{field('homesAfter', '취득 후 주택 수', '채')}<label className="ask-check"><input type="checkbox" checked={form.over85} onChange={(e) => setForm({ ...form, over85: e.target.checked })} /> 전용 85㎡ 초과</label></>}
        </>}
        {topic === 'capital-gains-tax' && <>{field('buy', '취득가')}{field('sell', '양도가')}{field('expenses', '필요경비')}{field('years', '보유 기간', '년')}</>}
        {topic === 'rental-yield' && <>{field('price', '매입가')}{field('deposit', '보증금')}{field('rent', '월 임대료')}{field('cost', '월 운영비')}{field('vacancy', '연 공실', '개월')}{field('loan', '대출')}{field('loanRate', '대출 금리', '%')}</>}
      </div>

      {missing.length > 0 && <p className="ask-needs">입력이 필요합니다: {missing.join(', ')}</p>}
      {result && <>
        <p className="ask-total">{result.unit === 'PERCENT' ? `실투자금 기준 연 ${result.total}%` : result.total ? won(result.total) : '이 계산기로 계산하지 않는 경우'}</p>
        <dl className="ask-inputs">{result.lines.map((line) => <div key={line.label}><dt>{line.label}{line.note && <small> · {line.note}</small>}</dt><dd>{line.label.endsWith('(%)') ? `${line.value}%` : won(line.value)}</dd></div>)}</dl>
        {result.notCovered.length > 0 && <p className="ask-needs">계산에 넣지 않은 것: {result.notCovered.join(' · ')}</p>}
        <p className="ask-basis">근거: {result.basis.join(' · ')}</p>
        <p className="ask-basis">참고용 계산입니다. 신고·계약 전에는 세무사·변호사 확인이 필요합니다.</p>
      </>}
    </section>}

    <p className="ask-privacy">음성은 휴대폰 브라우저의 무료 음성 인식을 씁니다. 말한 내용은 인식을 위해 브라우저 회사(구글·애플) 서버로 전송될 수 있으니, 이름·주민번호 같은 개인정보는 말하지 마세요.</p>
  </div>;
}
