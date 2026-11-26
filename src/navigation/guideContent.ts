/*
 * 사용설명서 · 화면별 짧은 설명 (2026-11-24, 루치오: "메인화면을 보면 복잡해서 어떻게 사용해야할지 모르겠어.
 * 사용설명서가 필요해. 그리고 각각의 항목별로 설명팝업이 짧게 나오는 것도 좋지 않을까").
 * PAGE_HELP feeds the ⓘ next to the breadcrumb on every screen; GuidePage (/guide) renders the full manual from the
 * same text so the two never disagree. Text describes how to use a screen only; it states no data and promises
 * nothing that is not built (건물주 자료 제출 = 준비 중).
 */

export interface PageHelp {
  /** Path or path prefix ('/property/' matches every property screen). */
  path: string;
  title: string;
  /** One or two sentences shown in the ⓘ popup. */
  short: string;
}

/** Ordered from most to least specific; the first match wins. */
export const PAGE_HELP: PageHelp[] = [
  { path: '/property/new', title: '새 물건 등록', short: '주소를 넣으면 공적자료를 자동으로 불러와 후보값으로 채웁니다. 저장한 뒤 물건 화면에서 하나씩 확인하세요.' },
  { path: '/property/', title: '물건 상세', short: '탭마다 토지·건물, 실거래, 자료를 봅니다. 오른쪽의 \'보고서 만들기\'로 지금 확인된 자료의 보고서 초안을 만듭니다.' },
  { path: '/listing/', title: '공개 매물 미리보기', short: '구매자에게 보이는 화면을 미리 봅니다. 공개하면 연락처 없이 주소 일부만 보이는 링크가 만들어집니다.' },
  { path: '/agents/', title: '에이전트 작업공간', short: 'AI 에이전트 한 개의 작업 기록과 상태를 봅니다. 사람이 확인하기 전에는 어떤 값도 확정되지 않습니다.' },
  { path: '/explore', title: '탐색', short: '등록된 매물을 신뢰 등급(A~D)과 지도로 비교합니다. 등급은 공적서류와 사람이 확인한 값으로만 계산합니다.' },
  { path: '/properties', title: '물건 목록', short: '내가 관리하는 물건을 목록·지도로 봅니다. \'보완 필요\'는 주소·면적·담당자 중 빠진 값이 있다는 뜻입니다.' },
  { path: '/inquiries', title: '매수 문의함', short: '공개 매물 페이지에서 들어온 문의입니다. 연락한 뒤 상태를 \'답변함\'으로 바꾸면 홈의 할 일에서 빠집니다.' },
  { path: '/import', title: '엑셀 대량 등록', short: '엑셀 파일로 여러 물건을 한 번에 등록합니다. 올리기 전에 미리보기에서 칸이 맞는지 확인하세요.' },
  { path: '/bulk-intake', title: '대량 자료 등록 · 검증', short: '서류·사진을 여러 물건에 한꺼번에 붙이고, 자동으로 읽은 값을 후보로 검토합니다.' },
  { path: '/discover', title: '조회', short: '주소나 지번으로 건축물대장·실거래·토지정보를 바로 조회합니다. 마음에 들면 그대로 물건으로 등록할 수 있습니다.' },
  { path: '/readiness', title: '준비도 센터', short: '물건마다 보고서를 만들 준비가 얼마나 됐는지 봅니다. 빠진 서류와 검토할 후보값을 먼저 처리하세요.' },
  { path: '/risk', title: '리스크 · 규제 검토', short: '용도지역·위반건축물·권리관계처럼 거래 전에 확인할 항목을 물건별로 점검합니다.' },
  { path: '/income', title: '임대 · 수익 분석', short: '임대료·관리비·공실을 넣어 수익률을 계산합니다. 계산값은 입력값에 따라 달라지는 참고값입니다.' },
  { path: '/review-history', title: '검토 이력', short: '누가 언제 어떤 값을 확인·수정했는지 모아 봅니다.' },
  { path: '/digital-twin-intake', title: '도면 · 3D 자료 등록', short: '도면이나 3D 파일을 물건에 붙입니다. 실제 사진이 아닌 자료는 그렇게 표시됩니다.' },
  { path: '/digital-twin', title: '디지털 트윈', short: '등록한 3D 모델을 보고 층·공간 정보를 확인합니다.' },
  { path: '/spatial', title: '공간 분석', short: '층별 면적과 공간 구성을 정리합니다.' },
  { path: '/interior', title: '실내 자료 분석', short: '실내 사진·자료를 정리합니다. 실내 촬영을 하지 않는 물건은 자료가 비어 있는 것이 정상입니다.' },
  { path: '/room-ops', title: '공간 운영', short: '호실별 임대·공실 상태를 관리합니다.' },
  { path: '/report-history', title: '보고서', short: '물건을 골라 보고서를 만들고, 만든 보고서의 버전을 봅니다. 확정한 버전은 바뀌지 않습니다.' },
  { path: '/professional-report/', title: '보고서 미리보기', short: '보고서 초안을 검토합니다. \'확정\'하면 그 시점의 버전으로 고정되고, 자료가 바뀌면 새 버전을 만드세요.' },
  { path: '/document/', title: '1P · 7P 문서', short: '정해진 양식(MASTER)으로 만든 제안서·상세보고서입니다. 인쇄하거나 PDF로 저장할 수 있습니다.' },
  { path: '/external-shares', title: '외부 공유 센터', short: '보고서를 외부에 보낸 링크와 열람 기록을 관리합니다. 필요 없어진 링크는 바로 끌 수 있습니다.' },
  { path: '/settings', title: '회사 설정', short: '회사 정보와 데이터 연결 상태를 봅니다. 연결이 끊긴 자료는 보고서에 \'데이터 미연결\'로 나옵니다.' },
  { path: '/access', title: '사용자 · 권한', short: '함께 쓰는 사람을 초대하고 볼 수 있는 범위(조회·편집·관리)를 정합니다.' },
  { path: '/backup', title: '데이터 백업 · 복원', short: '물건과 자료를 파일로 내려받아 보관하거나, 보관한 파일로 되돌립니다.' },
  { path: '/control-center', title: 'AI 에이전트 관제', short: '자동 수집·검증을 맡은 AI 작업의 상태를 한눈에 봅니다.' },
  { path: '/agents', title: 'AI 운영 상세', short: 'AI 에이전트별 작업 기록과 결과를 봅니다.' },
  { path: '/migration-readiness', title: '원격 이관 준비', short: '이 기기에만 저장된 자료를 서버로 옮길 준비가 됐는지 점검합니다.' },
  { path: '/ask', title: '세무·법률 질문', short: '마이크를 누르고 말하거나 글로 물으면 중개보수·세금을 계산해 근거와 함께 답합니다. 참고용이며 신고·계약 전 전문가 확인이 필요합니다.' },
  { path: '/guide', title: '사용설명서', short: '다온을 처음 쓰는 순서와 메뉴별 쓰임을 한 화면에 모았습니다.' },
];

export function helpForPath(pathname: string): PageHelp | undefined {
  const path = pathname.replace(/\/+$/, '') || '/';
  return PAGE_HELP.find((entry) => entry.path.endsWith('/') ? path.startsWith(entry.path) : path === entry.path || path.startsWith(entry.path + '/'));
}

/** 처음 쓰는 법: the four steps the home page and the manual both show. */
export const START_STEPS: Array<{ step: string; title: string; body: string; to: string; action: string }> = [
  { step: '1', title: '주소로 물건 등록', body: '주소를 넣으면 건축물대장·토지·실거래 자료가 후보값으로 모입니다.', to: '/property/new', action: '새 물건 등록' },
  { step: '2', title: '자료 확인', body: '물건 화면에서 후보값을 서류와 대조해 확인합니다. 확인한 값만 확정됩니다.', to: '/properties', action: '물건 목록' },
  { step: '3', title: '보고서 만들기', body: '보고서 메뉴에서 물건을 골라 1P 제안서·7P 상세보고서 초안을 만들고 확정합니다.', to: '/report-history', action: '보고서 메뉴' },
  { step: '4', title: '공유 · 공개', body: '확정한 보고서를 링크로 보내거나, 매물을 공개해 매수 문의를 받습니다.', to: '/external-shares', action: '외부 공유 센터' },
];
