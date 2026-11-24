import { Link } from 'react-router-dom';
import { ArrowForwardRounded } from '@mui/icons-material';
import { activeBrand } from '../brand/activeBrand';
import { navGroups, primaryNav } from '../navigation/navConfig';
import { helpForPath, START_STEPS } from '../navigation/guideContent';
import { TRUST_GRADES, TRUST_GRADE_HINT, TRUST_GRADE_LABEL } from '../domain/platform/trustGrade';
import '../platform.css';

/*
 * 사용설명서 (2026-11-24, 루치오: "메인화면을 보면 복잡해서 어떻게 사용해야할지 모르겠어. 사용설명서가 필요해").
 * Menu explanations come from guideContent.PAGE_HELP (the same text as each screen's ⓘ), so the manual cannot drift
 * from the menu. Grades come from the trust-grade module itself.
 */

const VALUE_KINDS = [
  { tag: '공식확인', body: '건축물대장·토지대장 같은 공적서류와 대조해 사람이 확인한 값입니다.' },
  { tag: '중개사 입력', body: '중개사·소유주가 입력했지만 아직 서류로 확인하지 않은 값입니다.' },
  { tag: '계산값', body: '다른 값으로 계산한 값입니다(예: 평당가, 수익률). 입력값이 바뀌면 같이 바뀝니다.' },
  { tag: '후보', body: '공공데이터에서 자동으로 불러온 값입니다. 사람이 확인하기 전까지 확정되지 않습니다.' },
  { tag: '샘플', body: '화면을 보여 드리려고 넣은 예시 물건입니다. 현황 숫자에서는 빠집니다.' },
];

const FAQ = [
  { q: '보고서는 어디서 만드나요?', a: '왼쪽 메뉴(휴대폰은 아래 탭)의 \'보고서\'에서 물건을 고르고 \'보고서 만들기\'를 누릅니다. 물건 화면 오른쪽의 \'보고서 만들기\'도 같은 기능입니다.' },
  { q: '보고서를 확정하면 무엇이 달라지나요?', a: '그 시점의 자료로 버전이 고정되어 다시 바뀌지 않습니다. 자료가 바뀐 뒤 옛 버전은 외부 공유가 막히니, 새 버전을 만들어 확정하세요.' },
  { q: '매물을 인터넷에 공개하려면?', a: '물건 화면에서 \'공개 화면 미리보기\'로 확인한 뒤 게시합니다. 게시 전에는 누구에게도 보이지 않습니다.' },
  { q: '매수 문의는 어디서 보나요?', a: '물건 메뉴의 \'매수 문의함\'에서 봅니다. 새 문의가 오면 홈의 \'오늘 할 일\'에도 나옵니다.' },
  { q: '휴대폰에서도 쓸 수 있나요?', a: '네. 아래 탭에서 홈·탐색·물건·보고서로 바로 가고, \'메뉴\'를 누르면 나머지 화면이 모두 나옵니다.' },
  { q: '자동으로 불러온 값이 틀리면?', a: '후보값은 확정 전이므로 물건 화면에서 고치거나 버리면 됩니다. 원래 불러온 값과 출처는 기록으로 남습니다.' },
];

export default function GuidePage() {
  return <div className="guide-page">
    <header className="guide-hero">
      <p className="eyebrow">사용설명서</p>
      <h1>{activeBrand.name} 처음 쓰는 법</h1>
      <p>{activeBrand.name}는 상업용 건물의 공적자료를 모아 사람이 확인하고, 확인된 자료로 신뢰 등급과 1P·7P 보고서를 만드는 서비스입니다. 아래 네 단계만 따라 하면 첫 보고서까지 만들 수 있습니다.</p>
    </header>

    <section className="guide-block" aria-label="처음 쓰는 순서">
      <h2>1. 처음 쓰는 순서</h2>
      <ol className="guide-steps">{START_STEPS.map((step) => <li key={step.step}>
        <b>{step.step}</b><div><strong>{step.title}</strong><p>{step.body}</p><Link to={step.to}>{step.action} <ArrowForwardRounded /></Link></div>
      </li>)}</ol>
    </section>

    <section className="guide-block" aria-label="메뉴 안내">
      <h2>2. 메뉴 안내</h2>
      <p className="guide-note">화면마다 제목 옆의 ⓘ를 누르면 같은 설명이 짧게 나옵니다.</p>
      <div className="guide-menu">{primaryNav.filter((section) => section.id !== 'guide').map((section) => {
        const subs = [section.group, section.advanced].filter(Boolean).flatMap((id) => navGroups.find((group) => group.id === id)?.items ?? []).filter((item) => !item.menuHidden);
        return <article key={section.id}>
          <h3><Link to={section.to}>{section.title}</Link></h3>
          <p>{helpForPath(section.to)?.short ?? section.module}</p>
          {subs.length > 0 && <ul>{subs.map((item) => <li key={item.to}><Link to={item.to}>{item.title}</Link><span>{helpForPath(item.to)?.short ?? ''}</span></li>)}</ul>}
        </article>;
      })}</div>
    </section>

    <section className="guide-block" aria-label="값 표시 읽는 법">
      <h2>3. 값 옆의 표시 읽는 법</h2>
      <dl className="guide-kinds">{VALUE_KINDS.map((row) => <div key={row.tag}><dt>{row.tag}</dt><dd>{row.body}</dd></div>)}</dl>
    </section>

    <section className="guide-block" aria-label="신뢰 등급">
      <h2>4. 신뢰 등급 (A~D)</h2>
      <dl className="guide-grades">{TRUST_GRADES.map((grade) => <div key={grade}><dt><span className={`grade-chip grade-${grade}`}>{grade}</span>{TRUST_GRADE_LABEL[grade]}</dt><dd>{TRUST_GRADE_HINT[grade]}</dd></div>)}</dl>
    </section>

    <section className="guide-block" aria-label="자주 묻는 질문">
      <h2>5. 자주 묻는 질문</h2>
      <div className="guide-faq">{FAQ.map((row) => <details key={row.q}><summary>{row.q}</summary><p>{row.a}</p></details>)}</div>
    </section>
  </div>;
}
