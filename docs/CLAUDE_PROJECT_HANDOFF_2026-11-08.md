# DA:ON 부동산 리포트 — 작업 인수인계 (2026-11-08)

> 새 채팅(토탈 인텔리전스 프로젝트)에서 이 작업을 이어받는 Claude/루인용 문서입니다.
> 먼저 `CLAUDE.md` → 이 문서 → `docs/CLAUDE_PROJECT_HANDOFF_2026-10-14.md`(사업 취지·아키텍처 원본) 순서로 읽으세요.
> 이 문서의 상태값은 2026-11-08 15시(KST) 기준 **기록**입니다. 작업 전에 반드시 HEAD·Production·PR을 다시 확인하세요.

## 1. 사업 취지와 방향 (왜 하는가)
- DA:ON은 부동산 매물을 **공적자료·현장증거·사람 검증**으로 쌓아 **전문 보고서(1P 요약제안서 + 상세 7P)**를 반복 생산하는 플랫폼입니다. 일회성 PDF가 아니라, 출처(provenance)·검증 이력·버전 스냅샷을 가진 데이터 자산을 만드는 것이 목표입니다.
- 장기 방향: 표준 스키마·품질 관리·감사 이력을 갖춘 재사용 데이터/AI 운영 플랫폼(B2B 구독 가능성). LUIN Intelligence OS의 한 사업으로 공통 기억·품질·승인 계약을 따릅니다.
- 현재 단계: 기능 구축은 대부분 끝났고, **루치오가 실제 휴대폰(아이폰)으로 보고서를 만들어 보며 나오는 품질 문제를 고치는 단계**입니다. 보고서의 정확성(금액·단위·날짜·조건 문구), 빈 값 처리, 휴대폰 화면·PDF 저장 품질이 최근 작업의 중심입니다.

## 2. 절대 지킬 것 (루치오 확정, 변경 시 루치오 승인)
- `DAON_1P_MASTER`·`DAON_DETAIL_7P_MASTER` 디자인 재설계 금지. 빈 값 숨김·글꼴·배율 같은 표시 보정만 가능.
- base 병합·Production 배포·운영 DB 변경은 **건별 루치오 승인**. master 병합 금지. 자동 병합·자동 배포 금지.
- Secret 노출 금지(DATA_GO_KR_SERVICE_KEY, VWORLD_API_KEY, Kakao, Supabase service role, RONE_API_KEY, VERCEL_*). 유료 API 금지. 루치오 비밀번호 대신 입력 금지(로그인은 루치오가 직접).
- 방배동 815-11: 실내 사진 금지. 루치오의 비공개 샘플 사진·원본 1P 이미지·7P PDF는 **공개 저장소에 올리지 않음** — 원본 대비 시각 비교는 비공개 작업 공간에서만.
- 사실(원문)을 자동으로 줄이거나 고쳐 쓰지 않음. 1P에서 잘리면 「1P 짧은 표시 문구」를 루치오가 입력하고, 원문은 상세 보고서에 그대로.
- 실제/샘플/계산/추정/AI 추론/현장확인 필요를 구분. 없는 값을 만들지 않음. 거래 사례는 후보(candidate)이지 동일 건물 확정 아님.
- 루인(ChatGPT)이 독립 검토자. 루인 의견과 루치오 결정이 겹치거나 다르면 Claude가 고르지 않고 루치오 승인.

## 3. 루치오와 일하는 방식
- 한국어, 호칭 '루치오'. 승인 요청은 **선택 팝업(AskUserQuestion)**으로, 링크 없이 내용을 직접 보여 줌.
- 보고 순서: 결론 → 완료 → 검증 → 위험 → 루치오 조치 → 다음. 상태 표기 PASS / FAIL / NOT_TESTED / BLOCKED.
- 문제는 그냥 넘기지 않고 원인을 찾아 고친 뒤 **오답노트**에 기록: `luin-intelligence-os/docs/lessons/projects/daon.md` (형식: 증상 → 근본 원인(VERIFIED/ASSUMPTION/원인 미확정) → 왜 놓쳤나 → 조치 → 검증 → 재발 방지 → 상태). 검사: `node scripts/lessons.mjs check`.
- 루치오는 외출 중 PC를 끌 수 있음 → PC에 의존하지 않는 방법(GitHub Actions·클라우드)을 우선.
- CI 결과 보고 시 continue-on-error 단계까지 포함해 로그의 `: FAIL`을 grep해서 0건 확인(DAON-035). CI 대기가 평소(약 20분)의 2배를 넘으면 단계별 상태 확인(DAON-041).
- 루인과는 PR 댓글로 공유. 루인 브랜치에 push 금지.

## 4. 현재 상태 (2026-11-08 15시 KST 기록 — 재확인 필수)
| 항목 | 값 |
|---|---|
| base `feat/daon-master-code-lock` HEAD | `fcee0d8` (#52 병합) |
| base CI | Validate run 42446677457 attempt 2 success · 로그 `: FAIL` 0 · E2E PASS 96/FAIL 0 · PDF text PASS 23/FAIL 0 |
| **Production** | **`fcdcf3b`** (2026-11-06 반영) — #47~#52 **미반영** |
| 열린 DA:ON PR | 없음 (#43·#46~#52 모두 병합) |
| 루인 사후 검토 | #51 검토 받음·응답함(2번 지적은 #52로 반영). #48·#49·#50·#52 검토 아직 없음 |

### 최근 병합 내역 (모두 루치오 팝업 승인)
- #46 `3855c09`: 표지 단순화·DA:ON 로고 이미지, 1P 짧은 표시 문구 규칙(`reportDisplayRules.ts`).
- #43 `fcdcf3b`: 가격 칸(`priceLayerView.ts`) — 억 경계, 원 단위 정확 표기(`formatExactWon`), 평당/총액 단위, 근거 없는 중개사 가격은 '입력값', 7P 확정일. **현재 운영 버전.**
- #47 `23e3d60`: E2E 5b(스냅샷 재열람 1P=7P)·5c(중개사 확정일), 등록 대기 URL 버그(DAON-038), 확정일 한국 날짜(`koreaDate`, DAON-039).
- #48 `66f2a4b`: 휴대폰 상단 바 불투명.
- #49 `78c402a`: **아이폰 화면 폭 맞춤 + iOS PDF 저장 시 한 장씩**(`src/utils/reportDeviceFit.ts`, `src/hooks/useReportDeviceFit.ts`, `src/report-device-fit.css`, `html.ios-print-fit`, DAON-040).
- #50 `3489e11`: 1P 빈 값(면적 '- (36평)' 제거, 주차 '(입력값)', 빈 핵심 포인트 숨김) + **iOS PDF 한글 빈칸** 대응(Georgia 계열 31개 선택자에 iOS만 번들 한글 글꼴).
- #51 `7dd19a7`: CI `scripts/qa-report-pdf-text.mjs` — PDF 글자 추출 대조(금액 끝자리·KST 날짜·'감정평가 아님'·원문 보존·'…' 0), 9쪽/긴 문구 경고/자료 부족 생략·재번호.
- #52 `fcee0d8`: 위 검사에 핵심 값의 **쪽별 위치** 확인 추가(루인 #51 검토 반영).

## 5. 남은 일 (우선순위 순)
1. **운영 반영(Promote) — BLOCKED(루치오)**: fcee0d8을 Production으로.
   - 방법 A(휴대폰): vercel.com → real-estate-report → Deployments → `fcee0d8` → ⋯ → Promote to Production.
   - 방법 B(PC 불필요, 권장 장기안): GitHub workflow `Deploy DAON Production to Vercel`(`.github/workflows/deploy-vercel-production.yml`, 입력 `DEPLOY DAON PRODUCTION`). 2026-11-08 실행(run 42448676197)은 **Repository secrets `VERCEL_TOKEN`·`VERCEL_ORG_ID`·`VERCEL_PROJECT_ID` 미등록으로 첫 단계 차단**(DAON-042). 루치오가 등록하면 루치오 팝업 승인 후 실행.
   - (참고) 등록돼 있는 secrets: `DAON_PRODUCTION_OWNER_EMAIL/PASSWORD`, `SUPABASE_MANAGEMENT_TOKEN`(9/29 실행 로그 기준). 단, Production Browser Acceptance는 9/29 로그인 실패(Invalid login credentials) 이후 미실행.
   - 방법 C: PC에서 Claude 앱이 열려 있으면 내장 브라우저로 Promote(누르기 직전 팝업 재확인).
2. **반영 후 실기기 확인(NOT_TESTED)**: 루치오가 아이폰에서 보고서를 「최신 데이터로 다시 생성」 후 PDF 저장 → 받은 PDF로 확인: 쪽수(표지+7+마지막=9), 좌우 잘림, 표지 소재지·작성·발행일과 마지막 쪽 한글 빈칸, 1P 빈 값 표기. 시뮬레이션 PASS는 실기기 근거가 아님(루인 #51 지적 1).
3. **운영 키 미등록(루치오)**: Vercel 환경변수에 `DATA_GO_KR_SERVICE_KEY`·`VWORLD_API_KEY` 없음 → 공공 실거래·토지 정보·가격 추정이 운영에서 나오지 않음(코드는 준비됨). 키가 있어도 API별 승인·실응답 검증 필요.
4. **앱 메뉴 로고**: 보고서 표지는 DA:ON 로고 이미지로 바뀌었지만 앱 메뉴는 옛 'D' 아이콘. 루치오 원본 로고 파일 필요.
5. **루인 사후 검토 대응**: #48·#49·#50·#52.
6. 원본 1P 이미지·7P PDF 대비 1:1 시각 비교 — 비공개 작업 공간에서만, NOT_TESTED.
7. 운영 E2E(실제 건물 조회 → 저장 → 보고서 발행·재열람, 실제 가격 출처) — NOT_TESTED.

## 6. 검증 방법 (재현 절차)
- 기본: `npm ci && npm run validate:masters && npm run validate:discovery && npm run typecheck && npm run build`. CI는 `Validate` workflow(validate + e2e-listings job). 브랜치에서 `gh workflow run Validate --ref <branch>`로 수동 실행 가능.
- 표시 규칙 단위 검사: `node scripts/validate-report-display-rules.mjs`(1P 문구, 면적·주차 표기, iOS 한글 글꼴 목록 동기화 포함).
- PDF 대조: `REPORT_QA_BASE_URL=<로컬모드 서버> node scripts/qa-report-pdf-text.mjs` (poppler-utils 필요). 자가시험 `QA_MUTATE_CSS='<css>'`.
- 로컬 모드 정적 빌드로 화면 확인(이 세션에서 쓴 방식, 로컬에 node_modules가 없을 때):
  - 브랜치 `claude/report-shots` = 확인할 커밋 + 맨 위 임시 커밋("임시: 로컬 모드 정적 빌드만 게시", `report-shots.yml`) → push하면 `claude/report-shots-out`에 정적 빌드와 `SOURCE_SHA`가 올라감. 갱신: `git rebase --onto <새 기준> <옛 기준> claude/report-shots && git push -f`. 이 두 브랜치는 **절대 base에 병합하지 않음**.
  - 받기: `git fetch origin +refs/heads/claude/report-shots-out:refs/remotes/origin/claude/report-shots-out && git archive origin/claude/report-shots-out | tar -x -C <dir>`.
  - 서빙: `node scripts/qa-local/serve-static.mjs <dir> 4175`. 아이폰 인쇄 모사: `node scripts/qa-local/ios-print-sim.mjs <out> fit`(근사치, 실기기 근거 아님).
  - 로컬 모드는 방배동 815-11 시드가 IndexedDB에 자동 생성됨. 루치오 비공개 사진을 쓰는 확인 스크립트는 저장소에 두지 않음.
- 운영 버전 확인: `gh api "repos/luinbiotech-lab/real-estate-report/deployments?environment=Production&per_page=1" -q '.[0].sha'`.
- 이 환경 제약: GitHub GraphQL·Actions secrets 목록 API는 프록시에서 403 → REST(`gh api repos/...`) 사용. `git fetch`는 `+refspec` 명시(DAON 오답노트 참조), 새 브랜치는 `git config --add remote.origin.fetch` 추가.

## 7. 오답노트 위치와 상태
- 파일: `luin-intelligence-os/docs/lessons/projects/daon.md`. DAON-023 이후 항목은 브랜치 `claude/daon-lessons-20261103`(PR #72)에만 있고 **main 미병합**(2026-11-08 기준, 충돌 없음).
- 최근 항목: DAON-034~042 (CI 숨은 FAIL, 스타일 덮어쓰기, 가격 단위·반올림, E2E 대기 URL, UTC 날짜, iOS PDF 분할·한글 빈칸, CI 멈춤, Vercel 배포 키 미등록).

## 8. 새 채팅 첫 작업 체크리스트
1. `git fetch` 후 base HEAD, Production SHA, 열린 PR, 루인 새 댓글 확인 → 이 문서 4장과 차이 기록.
2. 오답노트 공통 교훈(`docs/lessons/common/COMMON_LESSONS.md`)과 `daon.md` 확인.
3. 5장 1번(운영 반영)이 아직이면 루치오에게 방법 A/B를 짧게 묻는 팝업.
4. 반영됐으면 운영 번들에 `ios-print-fit` 포함 확인 후 루치오에게 아이폰 PDF 재저장 요청.
