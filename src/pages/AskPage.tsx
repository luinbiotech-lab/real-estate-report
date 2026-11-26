import { useEffect, useRef, useState } from 'react';
import { GavelRounded, MicRounded, SendRounded, StopRounded, VolumeUpRounded } from '@mui/icons-material';
import { answerQuestion, EXAMPLE_QUESTIONS, type AdvisorAnswer } from '../domain/advisor/askAdvisor';
import '../platform.css';

/*
 * 세무·법률 질문 (시안, 2026-11-26). Voice in = the browser's own speech recognition (free; Chrome/Safari send the
 * audio to their vendor's server — said on screen). Voice out = speechSynthesis (on-device). No paid API.
 * `?demo=listening|answer` renders a fixed state for screenshots only.
 */

type Recognition = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onend: (() => void) | null; onerror: ((event: { error: string }) => void) | null };

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

export default function AskPage() {
  const demo = new URLSearchParams(window.location.search).get('demo');
  const [question, setQuestion] = useState(demo === 'answer' ? EXAMPLE_QUESTIONS[0] : demo === 'listening' ? '41억 5천 상가건물 중개' : '');
  const [listening, setListening] = useState(demo === 'listening');
  const [answer, setAnswer] = useState<AdvisorAnswer | null>(demo === 'answer' ? answerQuestion(EXAMPLE_QUESTIONS[0]) : null);
  const [voiceError, setVoiceError] = useState('');
  const recognition = useRef<Recognition | null>(null);
  const supported = demo ? true : Boolean(createRecognition());

  useEffect(() => () => { recognition.current?.stop(); window.speechSynthesis?.cancel(); }, []);

  const ask = (text: string, spoken = false) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const next = answerQuestion(trimmed);
    setAnswer(next);
    if (spoken) speak(`${next.title}. ${next.summary}`);
  };

  const toggleMic = () => {
    if (listening) { recognition.current?.stop(); return; }
    const rec = createRecognition();
    if (!rec) { setVoiceError('이 브라우저는 음성 입력을 지원하지 않습니다. 글로 입력해 주세요.'); return; }
    setVoiceError(''); setQuestion(''); setAnswer(null);
    rec.lang = 'ko-KR'; rec.interimResults = true; rec.continuous = false;
    let finalText = '';
    rec.onresult = (event) => {
      const parts = Array.from(event.results).map((result) => result[0].transcript);
      finalText = parts.join('');
      setQuestion(finalText);
    };
    rec.onerror = (event) => setVoiceError(event.error === 'not-allowed' ? '마이크 사용이 허용되지 않았습니다. 브라우저 설정에서 마이크를 허용해 주세요.' : '음성을 알아듣지 못했습니다. 다시 눌러 말씀해 주세요.');
    rec.onend = () => { setListening(false); if (finalText) ask(finalText, true); };
    recognition.current = rec;
    setListening(true);
    rec.start();
  };

  return <div className="ask-page">
    <header className="ask-hero">
      <p className="eyebrow">세무 · 법률 질문 <span className="ask-draft">시안</span></p>
      <h1>말로 물어보세요</h1>
      <p>중개보수·취득세·양도세·임대 수익률을 계산해 근거와 함께 답합니다. 참고용이며, 신고·계약 전에는 전문가 확인이 필요합니다.</p>
    </header>

    <section className="ask-voice" aria-label="음성 질문">
      <button type="button" className={`ask-mic${listening ? ' on' : ''}`} onClick={toggleMic} aria-pressed={listening} aria-label={listening ? '듣기 멈추기' : '눌러서 말하기'} disabled={!supported}>
        {listening ? <StopRounded /> : <MicRounded />}
      </button>
      <p className="ask-mic-label">{listening ? '듣고 있습니다… 말을 마치면 자동으로 답합니다' : supported ? '눌러서 말하기' : '이 브라우저는 음성 입력 미지원'}</p>
      {voiceError && <p className="ask-error" role="alert">{voiceError}</p>}
      <form className="ask-input" onSubmit={(event) => { event.preventDefault(); ask(question); }}>
        <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="또는 글로 입력: 예) 41억 상가 중개보수 상한은?" aria-label="질문" />
        <button type="submit" aria-label="질문 보내기"><SendRounded /></button>
      </form>
      <div className="ask-examples">{EXAMPLE_QUESTIONS.map((example) => <button type="button" key={example} onClick={() => { setQuestion(example); ask(example); }}>{example}</button>)}</div>
    </section>

    {answer && <section className="ask-answer" aria-label="답변">
      <div className="ask-answer-head"><GavelRounded /><h2>{answer.title}</h2><span className="ask-unverified">원문 대조 전</span>
        <button type="button" className="ask-speak" onClick={() => speak(`${answer.title}. ${answer.summary}`)}><VolumeUpRounded /> 읽어 주기</button></div>
      <p className="ask-summary">{answer.summary}</p>
      {answer.inputs.length > 0 && <dl className="ask-inputs">{answer.inputs.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>}
      {answer.needs.length > 0 && <p className="ask-needs">더 필요한 값: {answer.needs.join(', ')}</p>}
      {answer.basis.length > 0 && <p className="ask-basis">근거: {answer.basis.join(' · ')}</p>}
    </section>}

    <p className="ask-privacy">음성은 휴대폰 브라우저의 무료 음성 인식을 씁니다. 말한 내용은 인식을 위해 브라우저 회사(구글·애플) 서버로 전송될 수 있으니, 이름·주민번호 같은 개인정보는 말하지 마세요.</p>
  </div>;
}
